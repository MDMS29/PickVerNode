// Indice oficial de releases de Node, para validar/resolver versiones antes de instalar.
const https = require('https');

const URL = 'https://nodejs.org/dist/index.json';
const TTL = 60 * 60 * 1000; // 1h

let cache = null;
let cachedAt = 0;

function fetchIndex() {
  return new Promise((resolve, reject) => {
    const req = https.get(URL, { timeout: 10000, headers: { 'user-agent': 'pickvernode' } }, res => {
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
  const raw = await fetchIndex();
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
  if (!q) return { error: 'Escribe una version (ej: 20.18.0, 20, lts, latest)' };
  if (!/^(latest|lts|\d+(\.\d+){0,2})$/.test(q)) {
    return { error: `Formato invalido: "${input}". Usa 20.18.0, 20, lts o latest` };
  }

  let list;
  try {
    list = await releases();
  } catch (e) {
    // Sin red: solo se puede aceptar una version completa, sin verificar
    if (isFullVersion(q)) return { version: q, unverified: true, reason: e.message };
    return { error: `No se pudo consultar nodejs.org (${e.message}). Escribe la version exacta, ej: 20.18.0` };
  }

  if (q === 'latest') return { version: list[0].version };
  if (q === 'lts') {
    const lts = list.find(r => r.lts);
    return lts ? { version: lts.version, lts: lts.lts } : { error: 'No se encontro una version LTS' };
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

  return { error: `La version ${input} no existe en nodejs.org` };
}

module.exports = { releases, resolve, isFullVersion };
