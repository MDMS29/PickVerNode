const path = require('path');
const U = require('../util');

function dataDir() {
  if (process.env.FNM_DIR) return process.env.FNM_DIR;
  if (U.IS_WIN) return path.join(process.env.APPDATA || '', 'fnm');
  if (process.platform === 'darwin') return path.join(U.home(), 'Library', 'Application Support', 'fnm');
  return path.join(U.home(), '.local', 'share', 'fnm');
}

function versionsDir() {
  return path.join(dataDir(), 'node-versions');
}

function fnm(args) {
  return U.IS_WIN ? U.run(`fnm ${args}`) : U.runLogin(`fnm ${args}`);
}

module.exports = {
  id: 'fnm',
  name: 'fnm',
  platforms: ['win32', 'darwin', 'linux'],
  needsTerminalEnv: true, // fnm resuelve la version por shell

  async detect() {
    return !!(await U.which('fnm'));
  },

  async list() {
    try {
      const out = await fnm('ls');
      const vs = [...out.matchAll(/v(\d+\.\d+\.\d+)/g)].map(m => m[1]);
      if (vs.length) return [...new Set(vs)].sort(U.cmpDesc);
    } catch { /* fallback al disco */ }
    return U.listVersionDirs(versionsDir());
  },

  // "default" es el alias persistente de fnm
  async current() {
    try {
      const out = await fnm('ls');
      const line = out.split(/\r?\n/).find(l => /default/.test(l));
      const m = line && line.match(/v(\d+\.\d+\.\d+)/);
      if (m) return m[1];
    } catch { /* ignore */ }
    try {
      return U.normalize(await fnm('current'));
    } catch {
      return null;
    }
  },

  async use(version) {
    return fnm(`default ${version}`);
  },

  installCommand(version) {
    return `fnm install ${version}`;
  },

  binDir(version) {
    const base = path.join(versionsDir(), `v${version}`, 'installation');
    return U.IS_WIN ? base : path.join(base, 'bin');
  }
};
