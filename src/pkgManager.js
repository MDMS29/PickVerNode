// Lectura del campo packageManager (corepack) del package.json de la carpeta.
const fs = require('fs');
const path = require('path');

// "pnpm@9.1.0+sha512..." -> {name:'pnpm', version:'9.1.0', spec:'pnpm@9.1.0'}
function parse(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^([a-z][\w-]*)@([^+\s]+)/i);
  if (!m) return null;
  return { name: m[1], version: m[2], spec: `${m[1]}@${m[2]}`, raw };
}

// Devuelve {name, version, spec, file} o null
function read(folderPath) {
  const file = path.join(folderPath, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const parsed = parse(pkg.packageManager);
  return parsed ? { ...parsed, file } : null;
}

module.exports = { parse, read };
