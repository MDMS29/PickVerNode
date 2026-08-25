const fs = require('fs');
const path = require('path');
const U = require('../util');

function nvmDir() {
  return process.env.NVM_DIR || path.join(U.home(), '.nvm');
}

function versionsDir() {
  return path.join(nvmDir(), 'versions', 'node');
}

module.exports = {
  id: 'nvm',
  name: 'nvm (POSIX)',
  platforms: ['darwin', 'linux'],
  needsTerminalEnv: true, // nvm use solo afecta a la shell que lo ejecuta

  async detect() {
    return U.exists(path.join(nvmDir(), 'nvm.sh'));
  },

  async list() {
    return U.listVersionDirs(versionsDir());
  },

  // El unico estado persistente de nvm es el alias default
  async current() {
    try {
      const alias = fs.readFileSync(path.join(nvmDir(), 'alias', 'default'), 'utf8').trim();
      if (/^v?\d+\.\d+\.\d+$/.test(alias)) return U.normalize(alias);
      const all = U.listVersionDirs(versionsDir());
      const major = alias.match(/(\d+)/); // alias tipo "18" o "lts/hydrogen"
      if (major) return all.find(v => v.split('.')[0] === major[1]) || null;
      return all[0] || null;
    } catch {
      try {
        return U.normalize(await U.runLogin('node -v'));
      } catch {
        return null;
      }
    }
  },

  async use(version) {
    return U.runLogin(
      `. "${nvmDir()}/nvm.sh" >/dev/null 2>&1 && nvm alias default ${version} && nvm use ${version}`
    );
  },

  installCommand(version) {
    return `nvm install ${version}`;
  },

  binDir(version) {
    return path.join(versionsDir(), `v${version}`, 'bin');
  }
};
