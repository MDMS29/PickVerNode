// Version de Node que exige el proyecto (.nvmrc, .node-version, .tool-versions,
// package.json#volta.node / #engines.node) y comparacion contra la version activa.
const vscode = require('vscode');
const { l10n } = vscode;
const fs = require('fs');
const path = require('path');
const nodeIndex = require('./nodeIndex');

// Orden de prioridad: el primero que exista gana
const FILES = ['.nvmrc', '.node-version'];

function readFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// Devuelve {spec, source, file} o null
function requirementFor(folderPath) {
  for (const name of FILES) {
    const file = path.join(folderPath, name);
    const txt = readFile(file);
    const spec = txt && txt.split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith('#'));
    if (spec) return { spec, source: name, file };
  }

  const tv = path.join(folderPath, '.tool-versions');
  const tvTxt = readFile(tv);
  if (tvTxt) {
    const line = tvTxt.split(/\r?\n/).find(l => /^\s*(nodejs|node)\s+\S/.test(l));
    if (line) {
      const spec = line.trim().split(/\s+/)[1];
      if (spec && spec !== 'system') return { spec, source: '.tool-versions', file: tv };
    }
  }

  const pkgFile = path.join(folderPath, 'package.json');
  const pkgTxt = readFile(pkgFile);
  if (pkgTxt) {
    try {
      const pkg = JSON.parse(pkgTxt);
      if (pkg.volta && typeof pkg.volta.node === 'string' && pkg.volta.node.trim()) {
        return { spec: pkg.volta.node.trim(), source: 'package.json (volta.node)', file: pkgFile };
      }
      if (pkg.engines && typeof pkg.engines.node === 'string' && pkg.engines.node.trim()) {
        return { spec: pkg.engines.node.trim(), source: 'package.json (engines.node)', file: pkgFile };
      }
    } catch { /* package.json roto: se ignora */ }
  }

  return null;
}

// Carpeta del archivo abierto; si no hay, la primera del workspace
function activeFolder() {
  const ed = vscode.window.activeTextEditor;
  if (ed && ed.document.uri.scheme === 'file') {
    const f = vscode.workspace.getWorkspaceFolder(ed.document.uri);
    if (f) return f;
  }
  const list = vscode.workspace.workspaceFolders || [];
  return list[0] || null;
}

// Requisito de la carpeta activa, con la carpeta incluida
function current() {
  const folder = activeFolder();
  if (!folder) return null;
  const req = requirementFor(folder.uri.fsPath);
  return req ? { ...req, folder } : null;
}

// ---------- comparacion de versiones ----------

function nums(v) {
  return String(v || '')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .reduce((acc, p) => {
      if (acc.stop) return acc;
      if (/^\d+$/.test(p)) acc.out.push(Number(p));
      else acc.stop = true;
      return acc;
    }, { out: [], stop: false }).out;
}

function pad(parts, fill = 0) {
  return [parts[0] ?? fill, parts[1] ?? fill, parts[2] ?? fill];
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0) ? -1 : 1;
  }
  return 0;
}

function matchComparator(actual, token) {
  const t = token.trim();
  if (!t) return true;

  const m = t.match(/^(>=|<=|>|<|=|\^|~)?\s*(.+)$/);
  if (!m) return true;
  const op = m[1] || '';
  const parts = nums(m[2]);
  if (!parts.length) return true; // *, x, vacio -> cualquiera

  const lo = pad(parts, 0);
  switch (op) {
    case '>=': return cmp(actual, lo) >= 0;
    case '>': return cmp(actual, pad(parts, Infinity)) > 0;
    case '<': return cmp(actual, lo) < 0;
    case '<=': return cmp(actual, pad(parts, Infinity)) <= 0;
    case '^': {
      const next = parts[0] === 0 && parts.length > 1
        ? [0, (parts[1] || 0) + 1, 0]
        : [(parts[0] || 0) + 1, 0, 0];
      return cmp(actual, lo) >= 0 && cmp(actual, next) < 0;
    }
    case '~': {
      const next = parts.length > 1
        ? [parts[0], (parts[1] || 0) + 1, 0]
        : [(parts[0] || 0) + 1, 0, 0];
      return cmp(actual, lo) >= 0 && cmp(actual, next) < 0;
    }
    default: // "20", "20.18", "20.18.0", "20.x"
      return parts.every((n, i) => (actual[i] || 0) === n);
  }
}

// Separa ">=18 <21" en comparadores respetando "- " de rangos hyphen (no soportado -> se ignora)
function matchRange(actual, range) {
  return String(range)
    .split('||')
    .some(group =>
      group
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .every(tok => matchComparator(actual, tok))
    );
}

function isAny(spec) {
  const s = String(spec || '').trim().toLowerCase();
  return !s || s === '*' || s === 'x' || s === 'node' || s === 'latest' || s === 'stable';
}

// Resuelve alias lts/*, lts/iron a una version concreta (requiere red; null si falla)
async function resolveLts(spec) {
  const s = String(spec).trim().toLowerCase();
  if (!/^lts(\/.+)?$/.test(s)) return null;
  const name = s.includes('/') ? s.split('/')[1] : '*';
  let list;
  try {
    list = await nodeIndex.releases();
  } catch {
    return null;
  }
  const hit = name === '*' || name === 'latest'
    ? list.find(r => r.lts)
    : list.find(r => r.lts && String(r.lts).toLowerCase() === name);
  return hit ? hit.version : null;
}

// true = cumple, false = no cumple, null = no se pudo determinar
async function satisfies(version, spec) {
  if (!version || isAny(spec)) return true;
  const actual = nums(version);
  if (actual.length < 1) return null;

  const s = String(spec).trim();
  if (/^lts(\/.+)?$/i.test(s)) {
    const target = await resolveLts(s);
    if (!target) return null;
    return cmp(actual, nums(target)) === 0;
  }

  if (!/[\d]/.test(s)) return null; // alias desconocido: no se inventa un fallo
  return matchRange(actual, s);
}

// Mejor version instalada que cumple el spec (la mas alta), o null
async function bestInstalled(list, spec) {
  if (!Array.isArray(list) || !list.length) return null;
  const s = String(spec).trim();
  if (/^lts(\/.+)?$/i.test(s)) {
    const target = await resolveLts(s);
    return target && list.includes(target) ? target : null;
  }
  if (isAny(spec)) return null;
  const ok = list.filter(v => matchRange(nums(v), s));
  if (!ok.length) return null;
  return ok.sort((a, b) => cmp(nums(b), nums(a)))[0];
}

// Que version habria que instalar para cumplir el spec: {version} | {error}
async function resolveInstallTarget(spec) {
  const s = String(spec).trim();
  if (/^lts(\/.+)?$/i.test(s)) {
    const target = await resolveLts(s);
    return target ? { version: target } : { error: l10n.t('Could not resolve "{0}"', String(spec)) };
  }

  // "20.18.0" / "20" / "20.x" -> se le pasa el prefijo numerico a nodeIndex
  const first = s.split('||')[0].trim().split(/\s+/).filter(Boolean);
  const anchor = first.find(t => /\d/.test(t)) || s;
  const parts = nums(anchor.replace(/^(>=|<=|>|<|=|\^|~)/, ''));
  if (!parts.length) return { error: l10n.t('Could not parse "{0}"', String(spec)) };

  const res = await nodeIndex.resolve(parts.join('.'));
  if (res.error) return res;
  // Con rangos tipo ">=18 <21" la ultima de la serie 18 puede no cumplir: se valida
  if (matchRange(nums(res.version), s)) return res;

  try {
    const list = await nodeIndex.releases();
    const hit = list.find(r => matchRange(nums(r.version), s));
    if (hit) return { version: hit.version, lts: hit.lts || undefined };
  } catch { /* sin red */ }
  return res;
}

module.exports = {
  FILES,
  requirementFor,
  activeFolder,
  current,
  satisfies,
  bestInstalled,
  resolveInstallTarget,
  isAny,
  _internals: { nums, cmp, matchRange }
};
