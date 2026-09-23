const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pkgManager = require('../src/pkgManager');

suite('pkgManager', () => {
  test('parse', () => {
    assert.deepStrictEqual(pkgManager.parse('pnpm@9.1.0').spec, 'pnpm@9.1.0');
    assert.deepStrictEqual(pkgManager.parse('pnpm@9.1.0+sha512.abc').version, '9.1.0');
    assert.deepStrictEqual(pkgManager.parse('yarn@4.2.2').name, 'yarn');
    assert.strictEqual(pkgManager.parse('pnpm'), null);
    assert.strictEqual(pkgManager.parse(''), null);
    assert.strictEqual(pkgManager.parse(undefined), null);
  });

  test('read', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvn-pm-'));
    assert.strictEqual(pkgManager.read(dir), null);

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x' }));
    assert.strictEqual(pkgManager.read(dir), null);

    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.1.0' }));
    assert.strictEqual(pkgManager.read(dir).spec, 'pnpm@9.1.0');

    fs.writeFileSync(path.join(dir, 'package.json'), '{ roto');
    assert.strictEqual(pkgManager.read(dir), null);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
