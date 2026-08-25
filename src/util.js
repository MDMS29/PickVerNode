const { exec, execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';

function run(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).toString().trim()));
      else resolve(stdout.toString());
    });
  });
}

function runFile(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).toString().trim()));
      else resolve(stdout.toString());
    });
  });
}

// Ejecuta en una shell de login POSIX (necesario para funciones como nvm)
function runLogin(script) {
  const shell = process.env.SHELL && /zsh|bash/.test(process.env.SHELL) ? process.env.SHELL : '/bin/bash';
  return runFile(shell, ['-lc', script]);
}

// Windows: nvm.exe exige una consola real -> siempre via cmd.exe
function runWinConsole(exe, args) {
  return run(`cmd.exe /c ""${exe}" ${args}"`);
}

function runWinElevated(exe, args) {
  const inner = `'/c','\\"\\"${exe}\\" ${args}\\"'`;
  return run(
    `powershell -NoProfile -NonInteractive -Command ` +
      `"$p = Start-Process -FilePath 'cmd.exe' -ArgumentList ${inner} -Verb RunAs -Wait -WindowStyle Hidden -PassThru; exit $p.ExitCode"`
  );
}

async function which(cmd) {
  try {
    const out = IS_WIN ? await run(`where ${cmd}`) : await runLogin(`command -v ${cmd}`);
    const first = out.split(/\r?\n/).map(s => s.trim()).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function home() {
  return os.homedir();
}

function normalize(v) {
  return String(v || '').trim().replace(/^v/, '');
}

function cmpDesc(a, b) {
  const A = normalize(a).split('.').map(Number);
  const B = normalize(b).split('.').map(Number);
  return B[0] - A[0] || B[1] - A[1] || B[2] - A[2];
}

// Lista carpetas vX.Y.Z dentro de dir
function listVersionDirs(dir) {
  if (!exists(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(d => (d.isDirectory() || d.isSymbolicLink()) && /^v?\d+\.\d+\.\d+$/.test(d.name))
    .map(d => normalize(d.name))
    .sort(cmpDesc);
}

module.exports = {
  IS_WIN,
  run,
  runFile,
  runLogin,
  runWinConsole,
  runWinElevated,
  which,
  exists,
  home,
  normalize,
  cmpDesc,
  listVersionDirs,
  path
};
