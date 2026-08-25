const U = require('../util');

function asdf(args) {
  return U.IS_WIN ? U.run(`asdf ${args}`) : U.runLogin(`asdf ${args}`);
}

module.exports = {
  id: 'asdf',
  name: 'asdf',
  platforms: ['darwin', 'linux'],
  needsTerminalEnv: false, // shims ya en el PATH

  async detect() {
    return !!(await U.which('asdf'));
  },

  async list() {
    const out = await asdf('list nodejs');
    const vs = [...out.matchAll(/(\d+\.\d+\.\d+)/g)].map(m => m[1]);
    return [...new Set(vs)].sort(U.cmpDesc);
  },

  async current() {
    try {
      const out = await asdf('current nodejs');
      const m = out.match(/(\d+\.\d+\.\d+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  },

  // asdf >= 0.16 usa "set -u"; versiones previas, "global"
  async use(version) {
    try {
      return await asdf(`set -u nodejs ${version}`);
    } catch {
      return asdf(`global nodejs ${version}`);
    }
  },

  binDir() {
    return null;
  }
};
