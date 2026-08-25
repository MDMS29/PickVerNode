const fs = require('fs');
const path = require('path');
const U = require('../util');

function exePath(cfgPath) {
  if (cfgPath) return cfgPath;
  const base = process.env.NVM_HOME || path.join(process.env.APPDATA || '', 'nvm');
  return path.join(base, 'nvm.exe');
}

function settings(cfgPath) {
  const exe = exePath(cfgPath);
  const root = process.env.NVM_HOME || path.dirname(exe);
  const out = { exe, root, symlink: process.env.NVM_SYMLINK || 'C:\\Program Files\\nodejs' };
  try {
    const txt = fs.readFileSync(path.join(root, 'settings.txt'), 'utf8');
    const r = txt.match(/^\s*root\s*:\s*(.+?)\s*$/m);
    const p = txt.match(/^\s*path\s*:\s*(.+?)\s*$/m);
    if (r) out.root = r[1];
    if (p) out.symlink = p[1];
  } catch { /* defaults */ }
  return out;
}

module.exports = {
  id: 'nvm-windows',
  name: 'nvm-windows',
  platforms: ['win32'],
  needsTerminalEnv: false, // reescribe un symlink global

  async detect(cfg) {
    return U.exists(exePath(cfg.get('nvmPath', '')));
  },

  // nvm.exe se niega a correr sin consola real: se lee el root del disco
  async list(cfg) {
    return U.listVersionDirs(settings(cfg.get('nvmPath', '')).root);
  },

  async current() {
    try {
      return U.normalize(await U.run('node -v'));
    } catch {
      return null;
    }
  },

  // El symlink global exige admin
  async use(version, cfg) {
    const { exe } = settings(cfg.get('nvmPath', ''));
    if (cfg.get('elevate', true)) return U.runWinElevated(exe, `use ${version}`);
    return U.runWinConsole(exe, `use ${version}`);
  },

  binDir(version, cfg) {
    return path.join(settings(cfg.get('nvmPath', '')).root, `v${version}`);
  }
};
