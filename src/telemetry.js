// Telemetria anonima y opt-out. Sirve para decidir que features valen la pena.
//
// Se respeta, en este orden:
//   1. vscode.env.isTelemetryEnabled  (ajuste global del usuario, lo aplica el propio logger)
//   2. pickvernode.telemetry          (ajuste propio de la extension)
//   3. ENDPOINT vacio                 (kill switch: sin endpoint no se envia nada)
//
// NO se envia: rutas, nombres de carpeta, nombres de repo, contenido de archivos, ni nada del usuario.
// Solo: id anonimo de instalacion (vscode.env.machineId), SO, version de VSCode/extension,
// gestor detectado, comando usado y resultado.
const https = require('https');
const vscode = require('vscode');

// PostHog (o cualquier endpoint que acepte JSON). Vacio = telemetria desactivada.
const ENDPOINT = 'https://us.i.posthog.com';            // ej: 'https://us.i.posthog.com/i/v0/e/'
const API_KEY = 'phc_uTa7ZJUYyKcg5yVowppW8mUTN96sBMPQexPaPdZRKs62';             // ej: 'phc_xxx'

const FLUSH_MS = 30 * 1000;
const MAX_QUEUE = 20;
const TIMEOUT_MS = 5000;

let logger = null;
let queue = [];
let timer = null;
let common = {};

function enabled() {
  if (!ENDPOINT || !API_KEY) return false;
  return vscode.workspace.getConfiguration('pickvernode').get('telemetry', true);
}

function post(batch) {
  return new Promise(resolve => {
    const body = JSON.stringify(
      batch.map(e => ({
        api_key: API_KEY,
        event: e.name,
        distinct_id: vscode.env.machineId,
        properties: { ...common, ...e.props }
      }))
    );
    const url = new URL(ENDPOINT);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        timeout: TIMEOUT_MS,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'user-agent': 'pickvernode'
        }
      },
      res => {
        res.resume();
        res.on('end', resolve);
      }
    );
    // La telemetria nunca puede romper la extension: todo error se traga.
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve());
    req.write(body);
    req.end();
  });
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return Promise.resolve();
  const batch = queue;
  queue = [];
  return post(batch);
}

function schedule() {
  if (queue.length >= MAX_QUEUE) return flush();
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

// El sender que recibe lo que emite el TelemetryLogger de VSCode.
const sender = {
  sendEventData(name, data) {
    if (!enabled()) return;
    queue.push({ name: String(name).split('/').pop(), props: data || {} });
    schedule();
  },
  sendErrorData() {
    // No se envian errores: pueden traer rutas del usuario.
  },
  flush
};

function init(context) {
  common = {
    ext_version: context.extension.packageJSON.version,
    vscode_version: vscode.version,
    platform: process.platform,
    arch: process.arch,
    ui_language: vscode.env.language,
    remote: vscode.env.remoteName || 'local'
  };

  logger = vscode.env.createTelemetryLogger(sender);
  context.subscriptions.push(logger, { dispose: () => flush() });
  return logger;
}

// track('command', { name: 'pick', provider: 'fnm' })
function track(name, props = {}) {
  if (!logger) return;
  try {
    logger.logUsage(name, props);
  } catch {
    /* nunca romper por telemetria */
  }
}

module.exports = { init, track, flush };
