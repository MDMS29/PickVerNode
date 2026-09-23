const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const U = require('../src/util');
const fnm = require('../src/providers/fnm');
const volta = require('../src/providers/volta');
const asdf = require('../src/providers/asdf');
const nvmPosix = require('../src/providers/nvmPosix');
const nvmWindows = require('../src/providers/nvmWindows');

// Los providers llaman a U.<fn> en tiempo de ejecucion: se pueden sustituir
function stub(fns) {
  const orig = {};
  for (const k of Object.keys(fns)) {
    orig[k] = U[k];
    U[k] = fns[k];
  }
  return () => Object.assign(U, orig);
}

// Imita vscode.WorkspaceConfiguration
function cfgOf(values = {}) {
  return { get: (key, def) => (values[key] !== undefined ? values[key] : def) };
}

function tmpdir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

suite('providers', () => {
  let restore = null;
  teardown(() => {
    if (restore) restore();
    restore = null;
  });

  test('fnm.list: dedup + orden descendente', async () => {
    restore = stub({
      run: async () => 'v18.20.4\n* v20.18.0 default\nv20.18.0\nv22.20.0\n',
      runLogin: async () => 'v18.20.4\n* v20.18.0 default\nv20.18.0\nv22.20.0\n'
    });
    assert.deepStrictEqual(await fnm.list(), ['22.20.0', '20.18.0', '18.20.4']);
  });

  test('fnm.list: si el binario falla, cae al disco', async () => {
    restore = stub({
      run: async () => { throw new Error('fnm no esta'); },
      runLogin: async () => { throw new Error('fnm no esta'); },
      listVersionDirs: () => ['21.7.3']
    });
    assert.deepStrictEqual(await fnm.list(), ['21.7.3']);
  });

  test('fnm.current: gana el alias default', async () => {
    restore = stub({
      run: async () => 'v18.20.4\nv20.18.0 default\n',
      runLogin: async () => 'v18.20.4\nv20.18.0 default\n'
    });
    assert.strictEqual(await fnm.current(), '20.18.0');
  });

  test('fnm.current: sin default, usa fnm current', async () => {
    let call = 0;
    const out = async () => {
      call += 1;
      if (call === 1) return 'v18.20.4\nv20.18.0\n'; // ls sin "default"
      return 'v20.18.0\n'; // fnm current
    };
    restore = stub({ run: out, runLogin: out });
    assert.strictEqual(await fnm.current(), '20.18.0');
  });

  test('volta: parsea node@x y el default', async () => {
    const out = async () => 'node@20.18.0 (default)\nnode@18.20.4\n';
    restore = stub({ run: out, runLogin: out });
    assert.deepStrictEqual(await volta.list(), ['20.18.0', '18.20.4']);
    assert.strictEqual(await volta.current(), '20.18.0');
    assert.strictEqual(volta.installCommand('20.18.0'), 'volta install node@20.18.0');
    assert.strictEqual(volta.uninstallCommand, null); // Volta no desinstala node
    assert.strictEqual(volta.binDir(), null); // usa shims
  });

  test('asdf.use: cae a "global" si "set -u" falla', async () => {
    const seen = [];
    const out = async args => {
      seen.push(args);
      if (/^asdf set /.test(args)) throw new Error('unknown command: set');
      return 'ok';
    };
    restore = stub({ run: out, runLogin: out });
    await asdf.use('20.18.0');
    assert.strictEqual(seen.length, 2);
    assert.ok(seen[0].includes('set -u nodejs 20.18.0'), seen[0]);
    assert.ok(seen[1].includes('global nodejs 20.18.0'), seen[1]);
  });

  test('nvm POSIX.current: alias default con version exacta', async () => {
    const dir = tmpdir('pvn-nvm-');
    fs.mkdirSync(path.join(dir, 'alias'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'alias', 'default'), 'v20.18.0\n');
    process.env.NVM_DIR = dir;
    try {
      assert.strictEqual(await nvmPosix.current(), '20.18.0');
    } finally {
      delete process.env.NVM_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('nvm POSIX.current: alias por major se resuelve contra lo instalado', async () => {
    const dir = tmpdir('pvn-nvm-');
    fs.mkdirSync(path.join(dir, 'alias'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'alias', 'default'), 'lts/iron\n');
    process.env.NVM_DIR = dir;
    restore = stub({ listVersionDirs: () => ['22.20.0', '20.18.0', '18.20.4'] });
    try {
      // "lts/iron" no trae numero de linea: se queda con la mas alta instalada
      assert.strictEqual(await nvmPosix.current(), '22.20.0');
      fs.writeFileSync(path.join(dir, 'alias', 'default'), '20\n');
      assert.strictEqual(await nvmPosix.current(), '20.18.0');
    } finally {
      delete process.env.NVM_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('nvm-windows: lee root de settings.txt', async () => {
    const dir = tmpdir('pvn-nvmw-');
    const root = path.join(dir, 'versions');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(dir, 'settings.txt'), `root: ${root}\npath: C:\\\\Program Files\\\\nodejs\n`);
    const prev = process.env.NVM_HOME;
    delete process.env.NVM_HOME;
    restore = stub({ listVersionDirs: d => (d === root ? ['20.18.0'] : []) });
    try {
      const cfg = cfgOf({ nvmPath: path.join(dir, 'nvm.exe') });
      assert.deepStrictEqual(await nvmWindows.list(cfg), ['20.18.0']);
      assert.strictEqual(nvmWindows.binDir('20.18.0', cfg), path.join(root, 'v20.18.0'));
      assert.strictEqual(
        nvmWindows.installCommand('20.18.0', cfg),
        `"${path.join(dir, 'nvm.exe')}" install 20.18.0`
      );
    } finally {
      if (prev !== undefined) process.env.NVM_HOME = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('nvm-windows.use: elevate decide el camino', async () => {
    const calls = [];
    restore = stub({
      runWinElevated: async (exe, args) => calls.push(['elevated', args]),
      runWinConsole: async (exe, args) => calls.push(['console', args])
    });
    await nvmWindows.use('20.18.0', cfgOf({ elevate: true, nvmPath: 'C:\\nvm\\nvm.exe' }));
    await nvmWindows.use('20.18.0', cfgOf({ elevate: false, nvmPath: 'C:\\nvm\\nvm.exe' }));
    assert.deepStrictEqual(calls, [['elevated', 'use 20.18.0'], ['console', 'use 20.18.0']]);
  });
});
