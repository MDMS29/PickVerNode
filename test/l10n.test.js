const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['src/extension.js', 'src/nodeIndex.js', 'src/required.js'];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

// Cadenas pasadas a l10n.t('...') en el codigo
function runtimeStrings() {
  const found = new Set();
  for (const file of SOURCES) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(/l10n\.t\(\s*'((?:[^'\\]|\\.)*)'/g)) {
      found.add(m[1].replace(/\\'/g, "'"));
    }
  }
  return [...found];
}

// %clave% usadas en package.json
function nlsKeys(value, out = new Set()) {
  if (typeof value === 'string') {
    const m = value.match(/^%(.+)%$/);
    if (m) out.add(m[1]);
  } else if (Array.isArray(value)) {
    value.forEach(v => nlsKeys(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(v => nlsKeys(v, out));
  }
  return out;
}

suite('l10n', () => {
  test('cada cadena de runtime esta traducida al espanol', () => {
    const bundle = readJson('l10n/bundle.l10n.es.json');
    const missing = runtimeStrings().filter(k => !bundle[k]);
    assert.deepStrictEqual(missing, [], `sin traducir: ${missing.join(' | ')}`);
  });

  test('el bundle no tiene cadenas huerfanas', () => {
    const bundle = readJson('l10n/bundle.l10n.es.json');
    const used = new Set(runtimeStrings());
    const orphans = Object.keys(bundle).filter(k => !used.has(k));
    assert.deepStrictEqual(orphans, [], `sobran: ${orphans.join(' | ')}`);
  });

  test('los marcadores {0} coinciden entre ingles y espanol', () => {
    const bundle = readJson('l10n/bundle.l10n.es.json');
    for (const [en, es] of Object.entries(bundle)) {
      const a = (en.match(/\{\d+\}/g) || []).sort();
      const b = (es.match(/\{\d+\}/g) || []).sort();
      assert.deepStrictEqual(b, a, `marcadores distintos en: ${en}`);
    }
  });

  test('package.json: toda %clave% existe en ingles y espanol', () => {
    const keys = [...nlsKeys(readJson('package.json'))];
    const en = readJson('package.nls.json');
    const es = readJson('package.nls.es.json');
    assert.ok(keys.length > 20, 'se esperaban claves nls en package.json');
    assert.deepStrictEqual(keys.filter(k => !en[k]), [], 'faltan en package.nls.json');
    assert.deepStrictEqual(keys.filter(k => !es[k]), [], 'faltan en package.nls.es.json');
  });

  test('no quedan cadenas visibles sin l10n.t en extension.js', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/extension.js'), 'utf8');
    const calls = src.match(/show(Information|Warning|Error)Message\(\s*[`'"]/g) || [];
    assert.deepStrictEqual(calls, [], 'hay mensajes con texto literal en vez de l10n.t()');
  });
});
