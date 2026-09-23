// Indice oficial de releases de Node, para validar/resolver versiones antes de instalar.
const https = require('https');
const { l10n } = require('vscode');

const URL = 'https://nodejs.org/dist/index.json';
// Calendario oficial de soporte (repo nodejs/Release). Solo se lee, no se envia nada.
const SCHEDULE_URL = 'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json';
const TTL = 60 * 60 * 1000; // 1h
const SCHEDULE_TTL = 24 * 60 * 60 * 1000; // 1 dia

let cache = null;
let cachedAt = 0;
let scheduleCache = null;
let scheduleAt = 0;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000, headers: { 'user-agent': 'pickvernode' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// [{version:'22.19.0', lts:'Jod'|false, date}]
async function releases() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  const raw = await fetchJson(URL);
  cache = raw.map(r => ({ version: r.version.replace(/^v/, ''), lts: r.lts, date: r.date }));
  cachedAt = Date.now();
  return cache;
}

function isFullVersion(input) {
  return /^v?\d+\.\d+\.\d+$/.test(input.trim());
}

// Acepta "20.18.0", "20", "20.18", "lts", "latest"
// Devuelve {version} o {error}
async function resolve(input) {
  const q = String(input || '').trim().replace(/^v/, '').toLowerCase();
  if (!q) return { error: l10n.t('Type a version (e.g. 20.18.0, 20, lts, latest)') };
  if (!/^(latest|lts|\d+(\.\d+){0,2})$/.test(q)) {
    return { error: l10n.t('Invalid format: "{0}". Use 20.18.0, 20, lts or latest', String(input)) };
  }

  let list;
  try {
    list = await releases();
  } catch (e) {
    // Sin red: solo se puede aceptar una version completa, sin verificar
    if (isFullVersion(q)) return { version: q, unverified: true, reason: e.message };
    return { error: l10n.t('Could not reach nodejs.org ({0}). Type the exact version, e.g. 20.18.0', e.message) };
  }

  if (q === 'latest') return { version: list[0].version };
  if (q === 'lts') {
    const lts = list.find(r => r.lts);
    return lts ? { version: lts.version, lts: lts.lts } : { error: l10n.t('No LTS version found') };
  }

  const exact = list.find(r => r.version === q);
  if (exact) return { version: exact.version, lts: exact.lts || undefined };

  // Prefijo: "20" o "20.18" -> ultima de esa serie
  const parts = q.split('.');
  const match = list.find(r => {
    const rp = r.version.split('.');
    return parts.every((p, i) => rp[i] === p);
  });
  if (match) return { version: match.version, lts: match.lts || undefined, resolvedFrom: q };

  return { error: l10n.t('Version {0} does not exist on nodejs.org', String(input)) };
}

// Lectura no bloqueante del indice: si aun no esta en cache, lo pide de fondo y
// devuelve null (el tooltip se completa en el siguiente refresh).
function peek(version) {
  if (!cache) {
    releases().catch(() => { /* sin red: el tooltip va sin estos datos */ });
    return null;
  }
  const v = String(version || '').trim().replace(/^v/, '');
  const hit = cache.find(r => r.version === v);
  if (!hit) return null;
  const latestLts = cache.find(r => r.lts);
  return {
    version: hit.version,
    lts: hit.lts || null,
    date: hit.date,
    isLatest: cache[0].version === hit.version,
    isLatestLts: !!(latestLts && latestLts.version === hit.version)
  };
}

// { "v20": { start, lts, maintenance, end, codename } }
async function schedule() {
  if (scheduleCache && Date.now() - scheduleAt < SCHEDULE_TTL) return scheduleCache;
  scheduleCache = await fetchJson(SCHEDULE_URL);
  scheduleAt = Date.now();
  return scheduleCache;
}

// Igual que peek: usa lo que haya en cache y pide de fondo si falta
function supportPeek(version) {
  if (!scheduleCache) {
    schedule().catch(() => { /* sin red: se vive sin fechas de soporte */ });
    return null;
  }
  const major = String(version || '').trim().replace(/^v/, '').split('.')[0];
  const row = scheduleCache[`v${major}`];
  if (!row || !row.end) return null;

  const today = new Date().toISOString().slice(0, 10);
  const phase = today >= row.end
    ? 'eol'
    : row.maintenance && today >= row.maintenance
      ? 'maintenance'
      : row.lts && today >= row.lts
        ? 'lts'
        : 'current';
  return { major, end: row.end, codename: row.codename || null, phase, eol: phase === 'eol' };
}

// Candidatas a instalar: la Current + la ultima de cada linea aun soportada
async function available({ limit = 8 } = {}) {
  const [list, sched] = await Promise.all([releases(), schedule().catch(() => ({}))]);
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const out = [];

  for (const r of list) {
    const major = r.version.split('.')[0];
    if (seen.has(major)) continue;
    seen.add(major);
    const row = sched[`v${major}`];
    if (row && row.end && today >= row.end) continue; // linea sin soporte
    out.push({ version: r.version, lts: r.lts || null, major, end: row ? row.end : null });
    if (out.length >= limit) break;
  }
  return out;
}

module.exports = { releases, resolve, isFullVersion, peek, schedule, supportPeek, available };
