const U = require('../util');

function volta(args) {
  return U.IS_WIN ? U.run(`volta ${args}`) : U.runLogin(`volta ${args}`);
}

module.exports = {
  id: 'volta',
  name: 'Volta',
  platforms: ['win32', 'darwin', 'linux'],
  needsTerminalEnv: false, // shims ya en el PATH

  async detect() {
    return !!(await U.which('volta'));
  },

  async list() {
    const out = await volta('list node --format=plain');
    const vs = [...out.matchAll(/node@(\d+\.\d+\.\d+)/g)].map(m => m[1]);
    return [...new Set(vs)].sort(U.cmpDesc);
  },

  async current() {
    try {
      const out = await volta('list node --format=plain');
      const line = out.split(/\r?\n/).find(l => /default|current/.test(l)) || out;
      const m = line.match(/node@(\d+\.\d+\.\d+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  },

  // volta install fija el default (y descarga si falta)
  async use(version) {
    return volta(`install node@${version}`);
  },

  installCommand(version) {
    return `volta install node@${version}`;
  },

  // Volta no expone desinstalar versiones de node (solo paquetes)
  uninstallCommand: null,

  binDir() {
    return null;
  }
};
