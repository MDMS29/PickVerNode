const nvmWindows = require('./nvmWindows');
const fnm = require('./fnm');
const nvmPosix = require('./nvmPosix');
const volta = require('./volta');
const asdf = require('./asdf');

// Orden de preferencia en la deteccion automatica
const ALL = [nvmWindows, fnm, nvmPosix, volta, asdf];

function forPlatform() {
  return ALL.filter(p => p.platforms.includes(process.platform));
}

function byId(id) {
  return ALL.find(p => p.id === id) || null;
}

async function detectAll(cfg) {
  const found = [];
  for (const p of forPlatform()) {
    try {
      if (await p.detect(cfg)) found.push(p);
    } catch { /* provider roto: se ignora */ }
  }
  return found;
}

module.exports = { ALL, forPlatform, byId, detectAll };
