const vscode = require('vscode');
const providers = require('./providers');
const nodeIndex = require('./nodeIndex');
const nvmrc = require('./nvmrc');
const U = require('./util');
const telemetry = require('./telemetry');

const STATE_PROVIDER = 'pickvernode.provider';
let item;
let active = null; // provider en uso
let ctx;

function cfg() {
  return vscode.workspace.getConfiguration('pickvernode');
}

function envKey() {
  return process.platform === 'darwin' ? 'osx' : process.platform === 'win32' ? 'windows' : 'linux';
}

async function resolveProvider({ force = false } = {}) {
  if (active && !force) return active;

  const wanted = cfg().get('provider', 'auto');
  if (wanted !== 'auto') {
    const p = providers.byId(wanted);
    if (p) {
      active = p;
      return active;
    }
  }

  const remembered = ctx.globalState.get(STATE_PROVIDER);
  const found = await providers.detectAll(cfg());
  active = found.find(p => p.id === remembered) || found[0] || null;
  return active;
}

// Prefija el bin de la version en las terminales nuevas de VSCode
async function updateTerminalEnv(version) {
  if (!active || !active.needsTerminalEnv || !cfg().get('updateTerminalEnv', true)) return;
  const dir = active.binDir(version, cfg());
  if (!dir) return;

  const key = `terminal.integrated.env.${envKey()}`;
  const conf = vscode.workspace.getConfiguration();
  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  const sep = U.IS_WIN ? ';' : ':';
  const current = { ...(conf.get(key) || {}) };
  current.PATH = `${dir}${sep}\${env:PATH}`;
  await conf.update(key, current, target);
}

async function refresh() {
  const p = await resolveProvider();
  if (!p) {
    item.text = '$(versions) Node $(warning)';
    item.tooltip = 'PickVerNode: no se detecto ningun gestor (nvm, fnm, volta, asdf)';
    return;
  }
  const v = await p.current(cfg());
  item.text = v ? `$(versions) Node ${v}` : '$(versions) Node ?';
  item.tooltip = `PickVerNode - gestor: ${p.name}\nClick para cambiar la version`;
}

async function pick() {
  const p = await resolveProvider();
  if (!p) {
    const help = 'Instala nvm, fnm, volta o asdf, o elige el gestor manualmente.';
    const action = await vscode.window.showErrorMessage(`PickVerNode: no se detecto ningun gestor. ${help}`, 'Elegir gestor');
    if (action) await selectProvider();
    return;
  }

  let list = [];
  try {
    list = await p.list(cfg());
  } catch (e) {
    vscode.window.showErrorMessage(`PickVerNode (${p.name}): no se pudo listar versiones - ${e.message}`);
    return;
  }

  const cur = await p.current(cfg());
  const items = [
    {
      label: '$(cloud-download) Instalar una version...',
      description: 'descarga e instala una version nueva',
      alwaysShow: true,
      install: true
    }
  ];
  if (cur && nvmrc.folders().length) {
    items.push({
      label: `$(file-code) Guardar .nvmrc (${cur})`,
      description: 'fija la version actual en la raiz del proyecto',
      alwaysShow: true,
      nvmrc: true
    });
  }
  if (list.length) {
    items.push({
      label: '$(trash) Desinstalar una version...',
      description: 'elimina una version instalada',
      alwaysShow: true,
      uninstall: true
    });
    items.push({ label: 'Instaladas', kind: vscode.QuickPickItemKind.Separator });
    items.push(
      ...list.map(v => ({
        label: `${v === cur ? '$(check) ' : ''}${v}`,
        description: v === cur ? 'en uso' : '',
        version: v
      }))
    );
  }

  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: list.length ? `Version de Node (${p.name})` : `Sin versiones instaladas (${p.name})`
  });
  if (!choice) return;
  if (choice.install) return installFlow(p);
  if (choice.uninstall) return uninstallFlow(p);
  if (choice.nvmrc) return writeNvmrc();
  if (choice.version === cur) return;

  await switchTo(p, choice.version);
}

async function switchTo(p, version) {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `PickVerNode: cambiando a ${version}...` },
    async () => {
      try {
        await p.use(version, cfg());
        await updateTerminalEnv(version);
      } catch (e) {
        telemetry.track('switch', { provider: p.id, ok: false });
        vscode.window.showErrorMessage(`PickVerNode (${p.name}): fallo al cambiar - ${e.message}`);
        return;
      }
      telemetry.track('switch', { provider: p.id, ok: true, major: String(version).split('.')[0] });
      await refresh();
      if (cfg().get('autoWriteNvmrc', false)) await writeNvmrc(version, { silent: true });
      vscode.window.showInformationMessage(
        `PickVerNode: Node ${version} activo (${p.name}). Reabre las terminales para que tomen el cambio.`
      );
    }
  );
}

async function installFlow(p) {
  if (!p.installCommand) {
    vscode.window.showErrorMessage(`PickVerNode: ${p.name} no soporta instalar desde la extension`);
    return;
  }

  const input = await vscode.window.showInputBox({
    title: `Instalar Node (${p.name})`,
    prompt: 'Version a instalar',
    placeHolder: '20.18.0, 20, lts o latest',
    ignoreFocusOut: true,
    validateInput: v =>
      !v.trim() || /^v?(latest|lts|\d+(\.\d+){0,2})$/i.test(v.trim())
        ? null
        : 'Formato invalido. Usa 20.18.0, 20, lts o latest'
  });
  if (input === undefined) return;

  const resolved = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'PickVerNode: validando version...' },
    () => nodeIndex.resolve(input)
  );
  if (resolved.error) {
    vscode.window.showErrorMessage(`PickVerNode: ${resolved.error}`);
    return;
  }

  const version = resolved.version;
  const installed = await p.list(cfg()).catch(() => []);
  if (installed.includes(version)) {
    const go = await vscode.window.showInformationMessage(
      `PickVerNode: Node ${version} ya esta instalada.`,
      'Usarla'
    );
    if (go) await switchTo(p, version);
    return;
  }

  if (resolved.unverified) {
    const ok = await vscode.window.showWarningMessage(
      `PickVerNode: no se pudo verificar ${version} contra nodejs.org (${resolved.reason}). Instalar igual?`,
      { modal: true },
      'Instalar'
    );
    if (!ok) return;
  }

  runInstall(p, version, input);
}

function runInstall(p, version, input) {
  const opts = { name: `PickVerNode: install ${version}`, iconPath: new vscode.ThemeIcon('versions') };
  if (p.terminalShell) opts.shellPath = p.terminalShell();
  const term = vscode.window.createTerminal(opts);
  term.show();
  term.sendText(p.installCommand(version, cfg()));
  telemetry.track('install_started', {
    provider: p.id,
    major: String(version).split('.')[0],
    input_kind: /^\d/.test(String(input).trim().replace(/^v/i, '')) ? 'version' : 'alias'
  });

  if (String(input).trim().replace(/^v/i, '').toLowerCase() !== version) {
    vscode.window.showInformationMessage(`PickVerNode: "${input}" se resolvio a Node ${version}`);
  }

  // El instalador corre en la terminal: se espera a que la version aparezca en disco
  waitForVersion(p, version, true).then(async ok => {
    if (!ok) return;
    await refresh();
    const go = await vscode.window.showInformationMessage(
      `PickVerNode: Node ${version} instalada.`,
      'Usarla ahora'
    );
    if (go) await switchTo(p, version);
  });
}

// Espera a que la version aparezca (present=true) o desaparezca (present=false) del disco
function waitForVersion(p, version, present, timeoutMs = 15 * 60 * 1000) {
  const start = Date.now();
  return new Promise(resolve => {
    const tick = async () => {
      if (Date.now() - start > timeoutMs) return resolve(false);
      const list = await p.list(cfg()).catch(() => []);
      if (list.includes(version) === present) return resolve(true);
      setTimeout(tick, 3000);
    };
    setTimeout(tick, 3000);
  });
}

async function uninstallFlow(p) {
  if (!p.uninstallCommand) {
    vscode.window.showErrorMessage(`PickVerNode: ${p.name} no soporta desinstalar versiones de Node`);
    return;
  }

  const list = await p.list(cfg()).catch(() => []);
  if (!list.length) {
    vscode.window.showWarningMessage(`PickVerNode (${p.name}): no hay versiones instaladas`);
    return;
  }

  const cur = await p.current(cfg());
  const choice = await vscode.window.showQuickPick(
    list.map(v => ({
      label: `${v === cur ? '$(check) ' : ''}${v}`,
      description: v === cur ? 'en uso' : '',
      version: v
    })),
    { placeHolder: `Version a desinstalar (${p.name})` }
  );
  if (!choice) return;

  const warn =
    choice.version === cur
      ? `Node ${choice.version} es la version EN USO. Si la desinstalas te quedas sin node activo.`
      : `Se desinstalara Node ${choice.version}.`;
  const ok = await vscode.window.showWarningMessage(
    `PickVerNode: ${warn} Continuar?`,
    { modal: true },
    'Desinstalar'
  );
  if (!ok) return;

  runUninstall(p, choice.version);
}

function runUninstall(p, version) {
  const opts = { name: `PickVerNode: uninstall ${version}`, iconPath: new vscode.ThemeIcon('trash') };
  if (p.terminalShell) opts.shellPath = p.terminalShell();
  const term = vscode.window.createTerminal(opts);
  term.show();
  term.sendText(p.uninstallCommand(version, cfg()));
  telemetry.track('uninstall_started', { provider: p.id, major: String(version).split('.')[0] });

  waitForVersion(p, version, false).then(async ok => {
    if (!ok) return;
    await refresh();
    vscode.window.showInformationMessage(`PickVerNode: Node ${version} desinstalada.`);
  });
}

// Crea o actualiza el .nvmrc de la carpeta abierta con la version en uso
async function writeNvmrc(version, { silent = false } = {}) {
  if (!nvmrc.folders().length) {
    if (!silent) vscode.window.showErrorMessage('PickVerNode: no hay ninguna carpeta abierta');
    return;
  }

  let v = version;
  if (!v) {
    const p = await resolveProvider();
    v = p && (await p.current(cfg()));
  }
  if (!v) {
    if (!silent) vscode.window.showErrorMessage('PickVerNode: no se pudo determinar la version actual');
    return;
  }

  const folder = nvmrc.folders().length === 1 ? nvmrc.folders()[0] : await nvmrc.pickFolder();
  if (!folder) return;

  let result;
  try {
    result = nvmrc.write(folder, v, { prefixV: cfg().get('nvmrcPrefixV', true) });
  } catch (e) {
    if (!silent) vscode.window.showErrorMessage(`PickVerNode: no se pudo escribir ${nvmrc.FILE} - ${e.message}`);
    return;
  }
  telemetry.track('nvmrc_written', {
    updated: Boolean(result.previous),
    auto: silent,
    multiroot: nvmrc.folders().length > 1
  });
  if (silent) return;

  const msg = result.previous
    ? `PickVerNode: ${nvmrc.FILE} actualizado (${result.previous} -> ${result.content})`
    : `PickVerNode: ${nvmrc.FILE} creado con ${result.content}`;
  const open = await vscode.window.showInformationMessage(msg, 'Abrir');
  if (open) {
    const doc = await vscode.workspace.openTextDocument(result.file);
    await vscode.window.showTextDocument(doc);
  }
}

async function selectProvider() {
  const found = await providers.detectAll(cfg());
  const items = providers.forPlatform().map(p => ({
    label: p.name,
    description: found.includes(p) ? 'detectado' : 'no detectado',
    id: p.id
  }));
  const choice = await vscode.window.showQuickPick(items, { placeHolder: 'Gestor de versiones de Node' });
  if (!choice) return;
  await ctx.globalState.update(STATE_PROVIDER, choice.id);
  active = providers.byId(choice.id);
  await refresh();
}

function activate(context) {
  ctx = context;
  telemetry.init(context);

  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'pickvernode.pick';
  item.text = '$(versions) Node ...';
  item.show();

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('pickvernode.pick', () => {
      telemetry.track('command', { name: 'pick' });
      return pick();
    }),
    vscode.commands.registerCommand('pickvernode.refresh', () => {
      telemetry.track('command', { name: 'refresh' });
      return resolveProvider({ force: true }).then(refresh);
    }),
    vscode.commands.registerCommand('pickvernode.selectProvider', () => {
      telemetry.track('command', { name: 'selectProvider' });
      return selectProvider();
    }),
    vscode.commands.registerCommand('pickvernode.writeNvmrc', () => {
      telemetry.track('command', { name: 'writeNvmrc' });
      return writeNvmrc();
    }),
    vscode.commands.registerCommand('pickvernode.uninstall', async () => {
      telemetry.track('command', { name: 'uninstall' });
      const p = await resolveProvider();
      if (!p) {
        vscode.window.showErrorMessage('PickVerNode: no se detecto ningun gestor');
        return;
      }
      await uninstallFlow(p);
    }),
    vscode.commands.registerCommand('pickvernode.install', async () => {
      telemetry.track('command', { name: 'install' });
      const p = await resolveProvider();
      if (!p) {
        vscode.window.showErrorMessage('PickVerNode: no se detecto ningun gestor');
        return;
      }
      await installFlow(p);
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pickvernode')) resolveProvider({ force: true }).then(refresh);
    })
  );

  refresh();
  reportActivation();
}

// Una sola vez por arranque: que gestor hay y como es el workspace.
async function reportActivation() {
  const found = await providers.detectAll(cfg()).catch(() => []);
  const p = await resolveProvider().catch(() => null);
  telemetry.track('activate', {
    provider: p ? p.id : 'none',
    detected: found.map(x => x.id).sort().join(','),
    detected_count: found.length,
    provider_setting: cfg().get('provider', 'auto'),
    folders: (vscode.workspace.workspaceFolders || []).length,
    multiroot: (vscode.workspace.workspaceFolders || []).length > 1
  });
}

function deactivate() {
  return telemetry.flush();
}

module.exports = { activate, deactivate };
