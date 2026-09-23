const vscode = require('vscode');
const providers = require('./providers');
const nodeIndex = require('./nodeIndex');
const nvmrc = require('./nvmrc');
const required = require('./required');
const pkgManager = require('./pkgManager');

// Los textos de la UI van en ingles y VSCode los traduce con l10n/bundle.l10n.<lang>.json
const { l10n } = vscode;
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
function pathEntry(dir) {
  const sep = U.IS_WIN ? ';' : ':';
  return `${dir}${sep}\${env:PATH}`;
}

// En multi-root el PATH se escribe en la carpeta activa (.vscode/settings.json de esa carpeta),
// asi cada carpeta abre sus terminales con su propia version.
async function updateTerminalEnv(version) {
  if (!active || !active.needsTerminalEnv || !cfg().get('updateTerminalEnv', true)) return;
  const dir = active.binDir(version, cfg());
  if (!dir) return;

  const key = `terminal.integrated.env.${envKey()}`;
  const folders = vscode.workspace.workspaceFolders || [];
  const folder = folders.length > 1 ? required.activeFolder() : null;

  const conf = vscode.workspace.getConfiguration(undefined, folder ? folder.uri : undefined);
  const target = folder
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : folders.length
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;

  const current = { ...(conf.get(key) || {}) };
  current.PATH = pathEntry(dir);
  await conf.update(key, current, target);
}

// ---------- tooltip ----------

// Interruptor unico de todo lo relacionado con el soporte de la version
function supportOf(version) {
  if (!version || !cfg().get('warnEndOfLife', true)) return null;
  return nodeIndex.supportPeek(version);
}

function binPathOf(p, version) {
  if (!p || !version || typeof p.binDir !== 'function') return null;
  try {
    return p.binDir(version, cfg()) || null;
  } catch {
    return null;
  }
}

function releaseLabel(version) {
  const info = nodeIndex.peek(version);
  if (!info) return '';
  const tags = [];
  if (info.lts) tags.push(`LTS ${info.lts}`);
  else if (info.isLatest) tags.push('Current');
  return tags.length ? ` &nbsp;·&nbsp; ${tags.join(', ')}` : '';
}

// Un "|" sin escapar (ej. el rango "18 || 20") rompe la tabla del tooltip
function cell(txt) {
  return String(txt).replace(/\|/g, '\\|');
}

// De donde sale la version activa: del requisito del proyecto o del default del gestor
function originRow(p, req, ok) {
  if (!req) return `| **${l10n.t('Source')}** | ${l10n.t('{0} default', p.name)} |`;
  const mark = ok ? '$(check)' : '$(warning)';
  const state = ok ? l10n.t('satisfied') : l10n.t('NOT satisfied');
  return `| **${l10n.t('Project')}** | \`${cell(req.spec)}\` ${mark} ${state} &nbsp;·&nbsp; \`${req.source}\` |`;
}

function tooltip(p, version, req, ok) {
  const rows = [
    '| | |',
    '|:--|:--|',
    `| **Node** | **${version || '?'}**${releaseLabel(version)} |`,
    `| **Gestor** | ${p.name} |`,
    originRow(p, req, ok)
  ];

  const sup = supportOf(version);
  if (sup) {
    const txt = sup.eol
      ? `$(error) ${l10n.t('end of life since {0}', sup.end)}`
      : sup.phase === 'maintenance'
        ? `$(clock) ${l10n.t('maintenance, until {0}', sup.end)}`
        : `$(pass) ${l10n.t('until {0}', sup.end)}`;
    rows.push(`| **${l10n.t('Support')}** | ${txt} |`);
  }

  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length > 1) {
    const f = required.activeFolder();
    if (f) rows.push(`| **${l10n.t('Folder')}** | ${cell(f.name)} |`);
  }

  const pm = activePkgManager();
  if (pm) rows.push(`| **${l10n.t('Packages')}** | \`${cell(pm.spec)}\` (corepack) |`);

  const bin = binPathOf(p, version);
  if (bin) rows.push(`| **${l10n.t('Bin')}** | \`${cell(bin)}\` |`);

  const links = [
    `[$(versions) ${l10n.t('Switch')}](command:pickvernode.pick)`,
    `[$(cloud-download) ${l10n.t('Install')}](command:pickvernode.install)`,
    `[$(file-code) ${l10n.t('Write .nvmrc')}](command:pickvernode.writeNvmrc)`
  ];
  if (req && !ok) {
    links.unshift(`[$(arrow-right) ${l10n.t('Use {0}', req.spec)}](command:pickvernode.useRequired)`);
  }
  if (bin) {
    links.push(`[$(clippy) ${l10n.t('Copy bin')}](command:pickvernode.copyBinPath)`);
    links.push(`[$(folder-opened) ${l10n.t('Reveal folder')}](command:pickvernode.revealBinFolder)`);
  }
  if (pm) links.push(`[$(package) ${l10n.t('Activate {0}', pm.spec)}](command:pickvernode.enableCorepack)`);
  if ((vscode.workspace.workspaceFolders || []).length > 1) {
    links.push(`[$(list-tree) ${l10n.t('All folders')}](command:pickvernode.checkFolders)`);
  }
  links.push(`[$(refresh) ${l10n.t('Refresh')}](command:pickvernode.refresh)`);
  links.push(`[$(gear) ${l10n.t('Manager')}](command:pickvernode.selectProvider)`);

  const md = new vscode.MarkdownString(
    `**PickVerNode**\n\n${rows.join('\n')}\n\n${links.join(' &nbsp;·&nbsp; ')}`
  );
  md.isTrusted = true;
  md.supportThemeIcons = true;
  return md;
}

// Perfil de terminal "Node (PickVerNode)": abre una shell con el bin de la version que
// toca en esta carpeta, sin tocar los ajustes ni las demas terminales.
function terminalProfileProvider() {
  return vscode.window.registerTerminalProfileProvider('pickvernode.terminal', {
    async provideTerminalProfile() {
      const p = await resolveProvider();
      let version = p ? await p.current(cfg()) : null;

      const req = required.current();
      if (p && req) {
        const list = await p.list(cfg()).catch(() => []);
        const target = await required.bestInstalled(list, req.spec);
        if (target) version = target;
      }

      const options = {
        name: version ? `Node ${version}` : 'Node',
        iconPath: new vscode.ThemeIcon('versions')
      };

      const dir = binPathOf(p, version);
      if (dir) {
        // En TerminalOptions.env no hay sustitucion ${env:PATH}: se resuelve aqui
        const sep = U.IS_WIN ? ';' : ':';
        options.env = { PATH: `${dir}${sep}${process.env.PATH || ''}` };
      }
      return new vscode.TerminalProfile(options);
    }
  });
}

// packageManager de la carpeta activa (corepack)
function activePkgManager() {
  const f = required.activeFolder();
  return f ? pkgManager.read(f.uri.fsPath) : null;
}

// Activa pnpm/yarn de la version exacta que fija el proyecto
async function enableCorepack() {
  const pm = activePkgManager();
  if (!pm) {
    vscode.window.showInformationMessage(
      l10n.t('PickVerNode: this folder does not pin a package manager ("packageManager" in package.json)')
    );
    return;
  }

  const term = vscode.window.createTerminal({
    name: `PickVerNode: corepack ${pm.spec}`,
    iconPath: new vscode.ThemeIcon('package')
  });
  term.show();
  term.sendText(`corepack enable && corepack prepare ${pm.spec} --activate`);
  telemetry.track('corepack', { manager: pm.name, major: String(pm.version).split('.')[0] });
}

// Multi-root: estado de cada carpeta de un vistazo
async function checkFolders() {
  const folders = vscode.workspace.workspaceFolders || [];
  if (!folders.length) {
    vscode.window.showInformationMessage(l10n.t('PickVerNode: no folder is open'));
    return;
  }

  const p = await resolveProvider();
  const cur = p ? await p.current(cfg()) : null;
  const items = [];
  for (const folder of folders) {
    const req = required.requirementFor(folder.uri.fsPath);
    const ok = req ? (await required.satisfies(cur, req.spec)) !== false : true;
    const pm = pkgManager.read(folder.uri.fsPath);
    items.push({
      label: `${req ? (ok ? '$(check)' : '$(warning)') : '$(dash)'} ${folder.name}`,
      description: req ? l10n.t('requires {0} - {1}', req.spec, req.source) : l10n.t('no version pinned'),
      detail: [
        ok ? '' : l10n.t('active: {0}', String(cur)),
        pm ? l10n.t('packages: {0}', pm.spec) : ''
      ].filter(Boolean).join('  -  '),
      folder,
      req
    });
  }

  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: l10n.t('Node version per folder (active: {0})', cur || '?'),
    matchOnDescription: true
  });
  if (!choice || !choice.req) return;

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(choice.req.file));
  await vscode.window.showTextDocument(doc);
}

async function revealBinFolder() {
  const p = await resolveProvider();
  const v = p && (await p.current(cfg()));
  const bin = binPathOf(p, v);
  if (!bin) {
    vscode.window.showWarningMessage(
      l10n.t('PickVerNode: {0} has no per-version bin folder (it uses shims on the PATH)', p ? p.name : l10n.t('the manager'))
    );
    return;
  }
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(bin));
}

async function copyBinPath() {
  const p = await resolveProvider();
  const v = p && (await p.current(cfg()));
  const bin = binPathOf(p, v);
  if (!bin) {
    vscode.window.showWarningMessage(
      l10n.t('PickVerNode: {0} has no per-version bin folder (it uses shims on the PATH)', p ? p.name : l10n.t('the manager'))
    );
    return;
  }
  await vscode.env.clipboard.writeText(bin);
  vscode.window.showInformationMessage(l10n.t('PickVerNode: copied {0}', bin));
}

let refreshing = false;
let pendingRequirement = null; // requisito incumplido por la carpeta activa, o null
const warnedMismatch = new Set();
const MUTED_KEY = 'pickvernode.mutedMismatch';

function isMuted(folderPath) {
  return (ctx.workspaceState.get(MUTED_KEY) || []).includes(folderPath);
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const p = await resolveProvider();
    if (!p) {
      item.text = '$(versions) Node $(warning)';
      item.backgroundColor = undefined;
      const help = new vscode.MarkdownString(
        `**PickVerNode**\n\n$(warning) ${l10n.t('No version manager detected.')}\n\n` +
          `[$(book) ${l10n.t('Getting started')}](command:pickvernode.openWalkthrough) &nbsp;·&nbsp; ` +
          `[$(gear) ${l10n.t('Choose manager')}](command:pickvernode.selectProvider)`
      );
      help.isTrusted = true;
      help.supportThemeIcons = true;
      item.tooltip = help;
      return;
    }
    const v = await p.current(cfg());
    const req = v && cfg().get('checkRequiredVersion', true) ? required.current() : null;
    const ok = req ? (await required.satisfies(v, req.spec)) !== false : true;
    pendingRequirement = ok ? null : req;

    if (!ok) {
      item.text = `$(versions) Node ${v} $(warning)`;
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      item.tooltip = tooltip(p, v, req, false);
      notifyMismatch(req, v, p);
      return;
    }

    const sup = supportOf(v);
    if (sup && sup.eol) {
      item.text = `$(versions) Node ${v} $(warning)`;
      item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      item.tooltip = tooltip(p, v, req, true);
      notifyEndOfLife(v, sup, p);
      return;
    }

    item.text = v ? `$(versions) Node ${v}` : '$(versions) Node ?';
    item.backgroundColor = undefined;
    item.tooltip = tooltip(p, v, req, true);
  } finally {
    refreshing = false;
  }
}

const EOL_MUTED_KEY = 'pickvernode.mutedEol';
const warnedEol = new Set();

// Un aviso por version: el soporte de Node no cambia de un dia para otro
async function notifyEndOfLife(version, sup, p) {
  if (!cfg().get('notifyEndOfLife', true)) return;
  if (warnedEol.has(version)) return;
  if ((ctx.globalState.get(EOL_MUTED_KEY) || []).includes(version)) return;
  warnedEol.add(version);

  telemetry.track('eol', { provider: p.id, major: sup.major });

  const SEE = l10n.t('Show versions');
  const MUTE = l10n.t('Do not warn for this one');
  const line = sup.codename ? `Node ${sup.major} (${sup.codename})` : `Node ${sup.major}`;
  const choice = await vscode.window.showWarningMessage(
    l10n.t('PickVerNode: {0} reached end of life on {1}. It no longer gets security patches.', line, sup.end),
    SEE,
    MUTE
  );
  if (choice === SEE) await pick();
  else if (choice === MUTE) {
    const list = new Set(ctx.globalState.get(EOL_MUTED_KEY) || []);
    list.add(version);
    await ctx.globalState.update(EOL_MUTED_KEY, [...list]);
  }
}

// Un aviso por combinacion archivo+requisito+version activa, y solo si no esta silenciado
async function notifyMismatch(req, version, p) {
  if (!cfg().get('notifyRequiredVersion', true)) return;
  if (isMuted(req.folder.uri.fsPath)) return;

  const key = `${req.file}|${req.spec}|${version}`;
  if (warnedMismatch.has(key)) return;
  warnedMismatch.add(key);

  telemetry.track('mismatch', {
    provider: p.id,
    source: req.source.split(' ')[0],
    major_current: String(version).split('.')[0],
    multiroot: (vscode.workspace.workspaceFolders || []).length > 1
  });

  // Si ya hay una instalada que cumple, el boton cambia; si no, instala
  const list = await p.list(cfg()).catch(() => []);
  const ready = await required.bestInstalled(list, req.spec);
  const CHANGE = ready ? l10n.t('Switch to {0}', ready) : l10n.t('Install the required one');
  const OPEN = l10n.t('Show file');
  const MUTE = l10n.t('Do not warn here');
  const choice = await vscode.window.showWarningMessage(
    l10n.t('PickVerNode: this project requires Node {0} ({1}) and {2} is active.', req.spec, req.source, String(version)),
    CHANGE,
    OPEN,
    MUTE
  );
  if (choice === CHANGE) await useRequired();
  else if (choice === OPEN) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(req.file));
    await vscode.window.showTextDocument(doc);
  } else if (choice === MUTE) {
    const list = new Set(ctx.workspaceState.get(MUTED_KEY) || []);
    list.add(req.folder.uri.fsPath);
    await ctx.workspaceState.update(MUTED_KEY, [...list]);
  }
}

// Cambia a la version que pide el proyecto; ofrece instalarla si no hay ninguna que cumpla
async function useRequired() {
  const req = required.current();
  if (!req) {
    vscode.window.showInformationMessage(
      l10n.t('PickVerNode: this folder does not pin a version ({0}, .tool-versions or engines.node)', required.FILES.join(', '))
    );
    return;
  }

  const p = await resolveProvider();
  if (!p) {
    vscode.window.showErrorMessage(l10n.t('PickVerNode: no version manager detected'));
    return;
  }

  const list = await p.list(cfg()).catch(() => []);
  const installed = await required.bestInstalled(list, req.spec);
  if (installed) {
    const cur = await p.current(cfg());
    if (installed === cur) {
      vscode.window.showInformationMessage(l10n.t('PickVerNode: Node {0} already satisfies {1}', cur, req.spec));
      return;
    }
    await ctx.workspaceState.update(MUTED_KEY, (ctx.workspaceState.get(MUTED_KEY) || []).filter(f => f !== req.folder.uri.fsPath));
    return switchTo(p, installed);
  }

  const res = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: l10n.t('PickVerNode: resolving the project version...') },
    () => required.resolveInstallTarget(req.spec)
  );
  if (res.error) {
    vscode.window.showErrorMessage(l10n.t('PickVerNode: {0}', res.error));
    return;
  }
  if (!p.installCommand) {
    vscode.window.showErrorMessage(
      l10n.t('PickVerNode: no installed version satisfies {0} and {1} cannot install from the extension', req.spec, p.name)
    );
    return;
  }

  const go = await vscode.window.showWarningMessage(
    l10n.t('PickVerNode: no installed version satisfies {0} ({1}). Install Node {2}?', req.spec, req.source, res.version),
    l10n.t('Install')
  );
  if (!go) return;
  runInstall(p, res.version, req.spec);
}

// Otra ventana (u otra terminal) pudo cambiar la version de forma global:
// se revisa al recuperar el foco y cada X segundos mientras la ventana lo tiene.
function watchExternalChanges(context) {
  let timer = null;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const start = () => {
    stop();
    const secs = Math.max(0, cfg().get('pollSeconds', 20));
    if (secs) timer = setInterval(refresh, secs * 1000);
  };

  const sync = focused => {
    if (!focused) return stop();
    refresh();
    start();
  };

  sync(vscode.window.state.focused);
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState(s => sync(s.focused)),
    { dispose: stop }
  );
  return { restart: () => sync(vscode.window.state.focused) };
}

// Promesa con techo de espera: nodejs.org no puede bloquear el QuickPick
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

// "LTS Iron", "Current", "" + estado de soporte para el detail
function describe(version, { installed = true } = {}) {
  const rel = nodeIndex.peek(version);
  const sup = supportOf(version);
  const tags = [];

  if (rel && rel.lts) tags.push(`LTS ${rel.lts}`);
  else if (sup && sup.codename && sup.phase !== 'current') tags.push(`LTS ${sup.codename}`);
  else if (rel && rel.isLatest) tags.push('Current');
  else if (sup && sup.phase === 'current') tags.push('Current');

  let detail = '';
  if (sup) {
    if (sup.eol) detail = `$(error) ${l10n.t('End of life since {0}', sup.end)}`;
    else if (sup.phase === 'maintenance') detail = `$(clock) ${l10n.t('Maintenance only - supported until {0}', sup.end)}`;
    else detail = `$(pass) ${l10n.t('Supported until {0}', sup.end)}`;
  } else if (!installed) {
    detail = '';
  }
  return { tags, detail, eol: !!(sup && sup.eol) };
}

async function pick() {
  const p = await resolveProvider();
  if (!p) {
    const help = l10n.t('Install nvm, fnm, volta or asdf, or choose the manager by hand.');
    const action = await vscode.window.showErrorMessage(
      l10n.t('PickVerNode: no version manager detected. {0}', help),
      l10n.t('Choose manager')
    );
    if (action) await selectProvider();
    return;
  }

  let list = [];
  try {
    list = await p.list(cfg());
  } catch (e) {
    vscode.window.showErrorMessage(l10n.t('PickVerNode ({0}): could not list versions - {1}', p.name, e.message));
    return;
  }

  const cur = await p.current(cfg());

  // Catalogo de nodejs.org: si tarda mas de 1.5s se abre el QuickPick sin el
  const catalog = cfg().get('showAvailableVersions', true)
    ? await withTimeout(nodeIndex.available({ useSchedule: cfg().get('warnEndOfLife', true) }), 1500, [])
    : [];

  const items = [];
  const req = required.current();
  if (req && cur && (await required.satisfies(cur, req.spec)) === false) {
    const ready = await required.bestInstalled(list, req.spec);
    items.push({
      label: ready
        ? `$(warning) ${l10n.t('Use the project version ({0})', ready)}`
        : `$(cloud-download) ${l10n.t('Install the project version ({0})', req.spec)}`,
      description: l10n.t('required by {0}', req.source),
      alwaysShow: true,
      useRequired: true
    });
    items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
  }

  items.push({
    label: `$(cloud-download) ${l10n.t('Install another version...')}`,
    description: l10n.t('type the version (20.18.0, 20, lts, latest)'),
    alwaysShow: true,
    install: true
  });
  if (cur && nvmrc.folders().length) {
    items.push({
      label: `$(file-code) ${l10n.t('Write .nvmrc ({0})', cur)}`,
      description: l10n.t('pins the current version at the project root'),
      alwaysShow: true,
      nvmrc: true
    });
  }
  if (list.length) {
    items.push({
      label: `$(trash) ${l10n.t('Uninstall a version...')}`,
      description: l10n.t('removes an installed version'),
      alwaysShow: true,
      uninstall: true
    });
  }
  const pm = activePkgManager();
  if (pm) {
    items.push({
      label: `$(package) ${l10n.t('Activate {0} with corepack', pm.spec)}`,
      description: l10n.t('pinned by "packageManager" in package.json'),
      alwaysShow: true,
      corepack: true
    });
  }
  if ((vscode.workspace.workspaceFolders || []).length > 1) {
    items.push({
      label: `$(list-tree) ${l10n.t('Show the version per folder...')}`,
      description: l10n.t('what each workspace folder requires'),
      alwaysShow: true,
      folders: true
    });
  }

  if (cur) {
    const d = describe(cur);
    items.push({ label: l10n.t('In use'), kind: vscode.QuickPickItemKind.Separator });
    items.push({
      label: `$(check) ${cur}`,
      description: [...d.tags, l10n.t('in use')].join(' - '),
      detail: d.detail,
      version: cur
    });
  }

  const others = list.filter(v => v !== cur);
  if (others.length) {
    items.push({ label: l10n.t('Installed'), kind: vscode.QuickPickItemKind.Separator });
    items.push(
      ...others.map(v => {
        const d = describe(v);
        return {
          label: `${d.eol ? '$(warning) ' : ''}${v}`,
          description: d.tags.join(' - '),
          detail: d.detail,
          version: v
        };
      })
    );
  }

  const installable = catalog.filter(r => !list.includes(r.version));
  if (installable.length) {
    items.push({ label: l10n.t('Available to install'), kind: vscode.QuickPickItemKind.Separator });
    items.push(
      ...installable.map(r => {
        const d = describe(r.version, { installed: false });
        return {
          label: `$(cloud-download) ${r.version}`,
          description: d.tags.join(' - '),
          detail: d.detail,
          installVersion: r.version
        };
      })
    );
  }

  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: list.length
      ? l10n.t('Node version ({0})', p.name)
      : l10n.t('No versions installed ({0})', p.name),
    matchOnDescription: true,
    matchOnDetail: true
  });
  if (!choice) return;
  if (choice.useRequired) return useRequired();
  if (choice.install) return installFlow(p);
  if (choice.uninstall) return uninstallFlow(p);
  if (choice.nvmrc) return writeNvmrc();
  if (choice.corepack) return enableCorepack();
  if (choice.folders) return checkFolders();
  if (choice.installVersion) {
    if (!p.installCommand) {
      vscode.window.showErrorMessage(l10n.t('PickVerNode: {0} cannot install from the extension', p.name));
      return;
    }
    return runInstall(p, choice.installVersion, choice.installVersion);
  }
  if (choice.version === cur) return;

  await switchTo(p, choice.version);
}

async function switchTo(p, version) {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: l10n.t('PickVerNode: switching to {0}...', version) },
    async () => {
      try {
        await p.use(version, cfg());
        await updateTerminalEnv(version);
      } catch (e) {
        telemetry.track('switch', { provider: p.id, ok: false });
        vscode.window.showErrorMessage(l10n.t('PickVerNode ({0}): could not switch - {1}', p.name, e.message));
        return;
      }
      telemetry.track('switch', { provider: p.id, ok: true, major: String(version).split('.')[0] });
      await refresh();
      if (cfg().get('autoWriteNvmrc', false)) await writeNvmrc(version, { silent: true });
      vscode.window.showInformationMessage(
        l10n.t('PickVerNode: Node {0} is active ({1}). Reopen your terminals to pick up the change.', version, p.name)
      );
    }
  );
}

async function installFlow(p) {
  if (!p.installCommand) {
    vscode.window.showErrorMessage(l10n.t('PickVerNode: {0} cannot install from the extension', p.name));
    return;
  }

  const input = await vscode.window.showInputBox({
    title: l10n.t('Install Node ({0})', p.name),
    prompt: l10n.t('Version to install'),
    placeHolder: l10n.t('20.18.0, 20, lts or latest'),
    ignoreFocusOut: true,
    validateInput: v =>
      !v.trim() || /^v?(latest|lts|\d+(\.\d+){0,2})$/i.test(v.trim())
        ? null
        : l10n.t('Invalid format. Use 20.18.0, 20, lts or latest')
  });
  if (input === undefined) return;

  const resolved = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: l10n.t('PickVerNode: validating version...') },
    () => nodeIndex.resolve(input)
  );
  if (resolved.error) {
    vscode.window.showErrorMessage(l10n.t('PickVerNode: {0}', resolved.error));
    return;
  }

  const version = resolved.version;
  const installed = await p.list(cfg()).catch(() => []);
  if (installed.includes(version)) {
    const go = await vscode.window.showInformationMessage(
      l10n.t('PickVerNode: Node {0} is already installed.', version),
      l10n.t('Use it')
    );
    if (go) await switchTo(p, version);
    return;
  }

  if (resolved.unverified) {
    const ok = await vscode.window.showWarningMessage(
      l10n.t('PickVerNode: could not verify {0} against nodejs.org ({1}). Install anyway?', version, resolved.reason),
      { modal: true },
      l10n.t('Install')
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
    vscode.window.showInformationMessage(l10n.t('PickVerNode: "{0}" resolved to Node {1}', String(input), version));
  }

  // El instalador corre en la terminal: se espera a que la version aparezca en disco
  waitForVersion(p, version, true).then(async ok => {
    if (!ok) return;
    await refresh();
    const go = await vscode.window.showInformationMessage(
      l10n.t('PickVerNode: Node {0} installed.', version),
      l10n.t('Use it now')
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
    vscode.window.showErrorMessage(l10n.t('PickVerNode: {0} cannot uninstall Node versions', p.name));
    return;
  }

  const list = await p.list(cfg()).catch(() => []);
  if (!list.length) {
    vscode.window.showWarningMessage(l10n.t('PickVerNode ({0}): no versions installed', p.name));
    return;
  }

  const cur = await p.current(cfg());
  const choice = await vscode.window.showQuickPick(
    list.map(v => {
      const d = describe(v);
      return {
        label: `${v === cur ? '$(check) ' : d.eol ? '$(warning) ' : ''}${v}`,
        description: [...d.tags, v === cur ? l10n.t('in use') : ''].filter(Boolean).join(' - '),
        detail: d.detail,
        version: v
      };
    }),
    {
      placeHolder: l10n.t('Version to uninstall ({0})', p.name),
      matchOnDescription: true,
      matchOnDetail: true
    }
  );
  if (!choice) return;

  const warn =
    choice.version === cur
      ? l10n.t('Node {0} is the version IN USE. If you remove it you are left without an active node.', choice.version)
      : l10n.t('Node {0} will be uninstalled.', choice.version);
  const ok = await vscode.window.showWarningMessage(
    l10n.t('PickVerNode: {0} Continue?', warn),
    { modal: true },
    l10n.t('Uninstall')
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
    vscode.window.showInformationMessage(l10n.t('PickVerNode: Node {0} uninstalled.', version));
  });
}

// Crea o actualiza el .nvmrc de la carpeta abierta con la version en uso
async function writeNvmrc(version, { silent = false } = {}) {
  if (!nvmrc.folders().length) {
    if (!silent) vscode.window.showErrorMessage(l10n.t('PickVerNode: no folder is open'));
    return;
  }

  let v = version;
  if (!v) {
    const p = await resolveProvider();
    v = p && (await p.current(cfg()));
  }
  if (!v) {
    if (!silent) vscode.window.showErrorMessage(l10n.t('PickVerNode: could not determine the current version'));
    return;
  }

  const folder = nvmrc.folders().length === 1 ? nvmrc.folders()[0] : await nvmrc.pickFolder();
  if (!folder) return;

  let result;
  try {
    result = nvmrc.write(folder, v, { prefixV: cfg().get('nvmrcPrefixV', true) });
  } catch (e) {
    if (!silent) vscode.window.showErrorMessage(l10n.t('PickVerNode: could not write {0} - {1}', nvmrc.FILE, e.message));
    return;
  }
  telemetry.track('nvmrc_written', {
    updated: Boolean(result.previous),
    auto: silent,
    multiroot: nvmrc.folders().length > 1
  });
  if (silent) return;

  const msg = result.previous
    ? l10n.t('PickVerNode: {0} updated ({1} -> {2})', nvmrc.FILE, result.previous, result.content)
    : l10n.t('PickVerNode: {0} created with {1}', nvmrc.FILE, result.content);
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
    description: found.includes(p) ? l10n.t('detected') : l10n.t('not detected'),
    id: p.id
  }));
  const choice = await vscode.window.showQuickPick(items, { placeHolder: l10n.t('Node version manager') });
  if (!choice) return;
  await ctx.globalState.update(STATE_PROVIDER, choice.id);
  active = providers.byId(choice.id);
  await refresh();
}

// Reevalua cuando cambia el archivo que fija la version del proyecto
function watchRequirementFiles() {
  const w = vscode.workspace.createFileSystemWatcher('**/{.nvmrc,.node-version,.tool-versions,package.json}');
  const onChange = () => {
    warnedMismatch.clear();
    refresh();
  };
  w.onDidChange(onChange);
  w.onDidCreate(onChange);
  w.onDidDelete(onChange);
  return w;
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
    vscode.commands.registerCommand('pickvernode.useRequired', () => {
      telemetry.track('command', { name: 'useRequired' });
      return useRequired();
    }),
    vscode.commands.registerCommand('pickvernode.openWalkthrough', () => {
      telemetry.track('command', { name: 'openWalkthrough' });
      return vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        `${ctx.extension.id}#pickvernode.setup`,
        false
      );
    }),
    vscode.commands.registerCommand('pickvernode.revealBinFolder', () => {
      telemetry.track('command', { name: 'revealBinFolder' });
      return revealBinFolder();
    }),
    vscode.commands.registerCommand('pickvernode.enableCorepack', () => {
      telemetry.track('command', { name: 'enableCorepack' });
      return enableCorepack();
    }),
    vscode.commands.registerCommand('pickvernode.checkFolders', () => {
      telemetry.track('command', { name: 'checkFolders' });
      return checkFolders();
    }),
    vscode.commands.registerCommand('pickvernode.copyBinPath', () => {
      telemetry.track('command', { name: 'copyBinPath' });
      return copyBinPath();
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
        vscode.window.showErrorMessage(l10n.t('PickVerNode: no version manager detected'));
        return;
      }
      await uninstallFlow(p);
    }),
    vscode.commands.registerCommand('pickvernode.install', async () => {
      telemetry.track('command', { name: 'install' });
      const p = await resolveProvider();
      if (!p) {
        vscode.window.showErrorMessage(l10n.t('PickVerNode: no version manager detected'));
        return;
      }
      await installFlow(p);
    }),
    vscode.window.onDidChangeActiveTextEditor(() => refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => refresh()),
    watchRequirementFiles(),
    terminalProfileProvider(),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('pickvernode')) return;
      if (e.affectsConfiguration('pickvernode.pollSeconds')) watcher.restart();
      warnedMismatch.clear();
      warnedEol.clear();
      resolveProvider({ force: true }).then(refresh);
    })
  );

  refresh();
  const watcher = watchExternalChanges(context);
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
