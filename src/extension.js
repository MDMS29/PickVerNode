const vscode = require('vscode');
const providers = require('./providers');
const U = require('./util');

const STATE_PROVIDER = 'vnode.provider';
let item;
let active = null; // provider en uso
let ctx;

function cfg() {
  return vscode.workspace.getConfiguration('vnode');
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

  let list;
  try {
    list = await p.list(cfg());
  } catch (e) {
    vscode.window.showErrorMessage(`PickVerNode (${p.name}): no se pudo listar versiones - ${e.message}`);
    return;
  }
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
    { placeHolder: `Version de Node (${p.name})` }
  );
  if (!choice || choice.version === cur) return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `PickVerNode: cambiando a ${choice.version}...` },
    async () => {
      try {
        await p.use(choice.version, cfg());
        await updateTerminalEnv(choice.version);
      } catch (e) {
        vscode.window.showErrorMessage(`PickVerNode (${p.name}): fallo al cambiar - ${e.message}`);
        return;
      }
      await refresh();
      vscode.window.showInformationMessage(
        `PickVerNode: Node ${choice.version} activo (${p.name}). Reabre las terminales para que tomen el cambio.`
      );
    }
  );
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

  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'vnode.pick';
  item.text = '$(versions) Node ...';
  item.show();

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand('vnode.pick', pick),
    vscode.commands.registerCommand('vnode.refresh', () => resolveProvider({ force: true }).then(refresh)),
    vscode.commands.registerCommand('vnode.selectProvider', selectProvider),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('vnode')) resolveProvider({ force: true }).then(refresh);
    })
  );

  refresh();
}

function deactivate() {}

module.exports = { activate, deactivate };
