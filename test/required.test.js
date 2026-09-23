const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const required = require('../src/required');

// Casos offline: no tocan nodejs.org (los alias lts/* si lo harian)
const CASES = [
  ['20.18.0', 'v20.18.0', true],
  ['20.18.1', 'v20.18.0', false],
  ['20.18.0', '20', true],
  ['22.1.0', '20', false],
  ['20.18.0', '20.x', true],
  ['20.18.0', '>=18', true],
  ['17.9.0', '>=18', false],
  ['20.18.0', '>=18 <21', true],
  ['21.1.0', '>=18 <21', false],
  ['20.18.0', '^20.10.0', true],
  ['21.0.0', '^20.10.0', false],
  ['20.10.5', '~20.10', true],
  ['20.11.0', '~20.10', false],
  ['18.20.4', '18 || 20', true],
  ['19.0.0', '18 || 20', false],
  ['20.18.0', '*', true],
  ['20.18.0', 'node', true]
];

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pvn-'));
}

suite('required', () => {
  test('satisfies', async () => {
    for (const [version, spec, expected] of CASES) {
      assert.strictEqual(await required.satisfies(version, spec), expected, `${version} vs ${spec}`);
    }
  });

  test('bestInstalled elige la mas alta que cumple', async () => {
    const list = ['22.20.0', '20.19.0', '18.20.4'];
    assert.strictEqual(await required.bestInstalled(list, '>=18 <21'), '20.19.0');
    assert.strictEqual(await required.bestInstalled(list, '^18.0.0'), '18.20.4');
    assert.strictEqual(await required.bestInstalled(list, '^21.0.0'), null);
  });

  test('prioridad .nvmrc > .node-version > .tool-versions > package.json', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ engines: { node: '>=18' } }));
    assert.deepStrictEqual(required.requirementFor(dir).spec, '>=18');

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ volta: { node: '20.1.0' }, engines: { node: '>=18' } }));
    assert.strictEqual(required.requirementFor(dir).spec, '20.1.0');

    fs.writeFileSync(path.join(dir, '.tool-versions'), 'nodejs 20.11.0\npython 3.12.0\n');
    assert.strictEqual(required.requirementFor(dir).spec, '20.11.0');

    fs.writeFileSync(path.join(dir, '.node-version'), '20.12.0\n');
    assert.strictEqual(required.requirementFor(dir).spec, '20.12.0');

    fs.writeFileSync(path.join(dir, '.nvmrc'), '# comentario\nv20.18.0\n');
    const req = required.requirementFor(dir);
    assert.strictEqual(req.spec, 'v20.18.0');
    assert.strictEqual(req.source, '.nvmrc');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('sin archivos no hay requisito', () => {
    const dir = tmpdir();
    assert.strictEqual(required.requirementFor(dir), null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('package.json roto no rompe', () => {
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'package.json'), '{ esto no es json');
    assert.strictEqual(required.requirementFor(dir), null);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
