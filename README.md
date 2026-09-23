# PickVerNode

> 🇪🇸 Versión en español: [README.es.md](README.es.md)

Switch your Node version from the VS Code status bar. No terminal, no memorizing commands.

## What is it?

A VS Code extension that shows a status bar item (bottom right) with the active Node version:
`$(versions) Node 20.18.0`.

One click opens a QuickPick with everything you can do: switch, install, uninstall and write `.nvmrc`.

It is **not** a version manager: it is a remote control for the one you already have
(nvm, nvm-windows, fnm, Volta or asdf).

## Why?

- See at a glance which Node version you are working with.
- Jump between projects that require different versions without opening a terminal.
- Install/uninstall versions without looking up each manager's syntax.
- Pin the project version in `.nvmrc` for the rest of the team.
- Get warned when the active version does not match what the project requires.

## How it works

1. On startup it detects which manager you have installed (or force one with `pickvernode.provider`).
2. It asks that manager for the active version and the list of installed ones.
3. When you pick a version, it runs that manager's own command:

| Manager | OS | Switch | Install | Uninstall | Scope |
|---|---|---|---|---|---|
| nvm-windows | Windows | `nvm.exe use X` via elevated `cmd.exe` (UAC) | `nvm.exe install X` | `nvm.exe uninstall X` | OS-wide |
| fnm | Win/macOS/Linux | `fnm default X` + PATH in VS Code terminals | `fnm install X` | `fnm uninstall X` | new shells |
| nvm (POSIX) | macOS/Linux | `nvm alias default X && nvm use X` + PATH in VS Code terminals | `nvm install X` | `nvm uninstall X` | new shells |
| Volta | Win/macOS/Linux | `volta install node@X` | `volta install node@X` | not supported | global (shims) |
| asdf | macOS/Linux | `asdf set -u nodejs X` (fallback `asdf global nodejs X`) | `asdf install nodejs X` | `asdf uninstall nodejs X` | global (shims) |

Install and uninstall run in a visible VS Code terminal (you see the manager's real progress);
the extension watches the disk and notifies when the version appears or disappears.

> Already-open terminals keep the old version. **Reopen them.**

## Features

| Action | From the QuickPick | Command (`Ctrl+Shift+P`) |
|---|---|---|
| Switch version | click the version | `PickVerNode: Switch Node version` |
| Install a version | `Instalar una version...` | `PickVerNode: Install a Node version` |
| Uninstall a version | `Desinstalar una version...` | `PickVerNode: Uninstall a Node version` |
| Write `.nvmrc` | `Guardar .nvmrc (X.Y.Z)` | `PickVerNode: Write .nvmrc with the current version` |
| Use the version the project requires | `Usar la version del proyecto (X)` | `PickVerNode: Use the version the project requires` |
| Copy the bin path | tooltip -> `Copiar bin` | `PickVerNode: Copy the active version bin path` |
| Open the version folder | tooltip -> `Abrir carpeta` | `PickVerNode: Reveal the active version folder` |
| Node version per folder (multi-root) | `Ver la version por carpeta...` | `PickVerNode: Show the Node version per folder` |
| Activate the project's package manager | `Activar pnpm@9.1.0 con corepack` | `PickVerNode: Activate the project package manager (corepack)` |
| Open the getting-started guide | - | `PickVerNode: Open the getting started guide` |
| Choose manager | - | `PickVerNode: Choose the version manager` |
| Refresh state | - | `PickVerNode: Refresh the current version` |

### The version list

One click on the status bar opens a QuickPick split into three sections:

```
$(warning) Usar la version del proyecto (>=20 <21)    lo pide package.json (engines.node)
$(cloud-download) Instalar otra version...
$(file-code) Guardar .nvmrc (20.18.0)
$(trash) Desinstalar una version...
--- En uso ---
$(check) 20.18.0            LTS Iron - en uso        $(pass) Soporte hasta 2026-04-30
--- Instaladas ---
$(warning) 18.20.4          LTS Hydrogen             $(error) Sin soporte desde 2025-04-30
--- Disponibles para instalar ---
$(cloud-download) 24.9.0    LTS Krypton              $(pass) Soporte hasta 2028-04-30
$(cloud-download) 22.20.0   LTS Jod                  $(pass) Soporte hasta 2027-04-30
```

"Disponibles" = the Current release plus the newest release of every line still under support,
so you install with one click instead of typing a version. Support dates come from the official
`nodejs/Release` schedule; releases and codenames from `nodejs.org/dist/index.json`. Both are
cached (1h / 24h) and the list opens anyway if the network takes more than 1.5s - just without the
extra data. Turn the lookup off with `pickvernode.showAvailableVersions`.

Typing in the QuickPick also matches the description and detail: `iron` or `2027` filters the list.

### Multi-root workspaces

With several folders open, the status bar follows **the folder of the file you are editing**: it
reads that folder's `.nvmrc`/`engines.node` and warns against it. When PickVerNode prefixes the
terminal `PATH` it writes it to that folder's own settings, so each folder opens its terminals with
its own Node version (shell-scoped managers only: nvm POSIX and fnm - `nvm-windows`, Volta and asdf
are machine-wide by design).

`PickVerNode: Show the Node version per folder` lists every folder, what it requires, whether the
active version satisfies it and its `packageManager`. Picking one opens the file that pins it.

### Terminal profile

The terminal dropdown gets a **Node (PickVerNode)** profile: it opens a shell whose `PATH` already
points at the version this folder needs (the project's one if it is installed, otherwise the active
one). Nothing is written to settings and already-open terminals are untouched - useful for a
one-off command on a different version.

### Package manager (corepack)

If the folder's `package.json` pins `"packageManager": "pnpm@9.1.0"`, the tooltip shows it and the
list offers `Activar pnpm@9.1.0 con corepack`, which runs
`corepack enable && corepack prepare pnpm@9.1.0 --activate` in a visible terminal. Node version and
package manager version get pinned together, which is what the project actually needs.

### Language

PickVerNode follows VS Code's display language. English by default; switch VS Code to Spanish
(`Configure Display Language`) and everything follows - notifications, lists, tooltip, walkthrough,
command titles and setting descriptions.

Adding a language is two files and no code: `l10n/bundle.l10n.<lang>.json` (runtime strings, keyed
by the English text) and `package.nls.<lang>.json` (command titles, settings, walkthrough). PRs
welcome.

### Status bar tooltip

Hovering the status bar item shows everything at a glance and acts as a menu:

| | |
|:--|:--|
| **Node** | **20.18.0** · LTS Iron |
| **Gestor** | fnm |
| **Proyecto** | `>=18 <21` ✓ cumple · `package.json (engines.node)` |
| **Bin** | `~/.local/share/fnm/node-versions/v20.18.0/installation/bin` |

Plus clickable links: switch, install, write `.nvmrc`, copy bin path, refresh, choose manager.
When there is no project requirement the third row shows `default de <manager>` instead - so you
always know *why* you are on that version. LTS/Current comes from `nodejs.org/dist/index.json`
(cached 1h); with no network that part is simply omitted. Volta and asdf use shims, so they have no
per-version bin folder and that row is hidden.

### End-of-life warning

When the active version belongs to a Node line that no longer gets patches, the status bar turns
orange and a notification fires **once per version** (`No avisar de esta` remembers the choice
across windows). Dates come from the official `nodejs/Release` schedule, so no guessing: Node 18
ended on 2025-04-30, Node 20 on 2026-04-30.

Settings: `pickvernode.warnEndOfLife` (status bar) and `pickvernode.notifyEndOfLife`
(notification).

### Version mismatch warning

If the folder pins a Node version and the active one does not satisfy it, the status bar turns
orange (`$(versions) Node 18.20.4 $(warning)`) and a notification offers to switch. **Nothing is
switched automatically** - it only tells you, so it does not fight `fnm`/`nvm` shell hooks.

Where the required version is read from, in order:

1. `.nvmrc` - `20.18.0`, `20`, `lts/*`, `lts/iron`
2. `.node-version`
3. `.tool-versions` (asdf) - `nodejs 20.18.0`
4. `package.json` -> `volta.node`
5. `package.json` -> `engines.node` - semver ranges supported: `>=18 <21`, `^20.10.0`, `~20.10`,
   `18 || 20`, `20.x`

If no installed version satisfies the requirement, PickVerNode offers to install one that does:
the notification button becomes `Instalar la que pide` and the first QuickPick entry becomes
`Instalar la version del proyecto (>=20 <21)` - one click, no typing. When a suitable version is
already installed the button names it (`Cambiar a 20.18.0`).

Settings: `pickvernode.checkRequiredVersion` (status bar warning, default `true`) and
`pickvernode.notifyRequiredVersion` (notification, default `true`). The notification can also be
muted per folder with its "No avisar aqui" button.

---

## Tutorial

### 0. Requirement

Have one of these installed: [nvm-windows](https://github.com/coreybutler/nvm-windows),
[nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm),
[Volta](https://volta.sh) or [asdf](https://asdf-vm.com).

If the status bar shows `Node $(warning)`, none was detected.

### 1. Switch version

1. Click `$(versions) Node X.Y.Z` in the status bar (bottom right).
2. In the **Instaladas** list, pick a version. The current one has `$(check)` and says `en uso`.
3. A progress notification appears, then `Node X.Y.Z activo`.
4. **Reopen your terminals** so they pick up the change.

On Windows with nvm-windows a UAC prompt appears: it is required, `nvm use` needs admin to rebuild the symlink.

### 2. Install a version

1. Open the QuickPick -> **Instalar una version...**
2. Type the version. `20.18.0`, `20`, `20.18`, `lts` or `latest` all work;
   prefixes resolve to the latest of that line (`20` -> `20.19.4`).
3. It is validated against `https://nodejs.org/dist/index.json`.
   - Not found -> warns and does not install.
   - Already installed -> offers to **switch to it**.
   - Offline -> only exact `X.Y.Z` is accepted, with a confirmation (unverified).
4. A terminal `PickVerNode: install X.Y.Z` opens with the manager's command
   (`nvm install`, `fnm install`, `volta install node@`, `asdf install nodejs`).
5. When done: `Node X.Y.Z instalada` + **Usarla ahora** button.

### 3. Uninstall a version

1. QuickPick -> **Desinstalar una version...**
2. Pick from the list (installed only, nothing to type by hand).
3. Confirm in the modal dialog. If the version is **in use**, it warns you will be left with no active node.
4. Runs in a terminal (`nvm uninstall`, `fnm uninstall`, `asdf uninstall nodejs`) and notifies when finished.

> Volta cannot uninstall node versions: the option warns and does nothing.

### 4. Write `.nvmrc`

1. QuickPick -> **Guardar .nvmrc (X.Y.Z)** (only shown when a folder is open).
2. Writes `.nvmrc` at the root with the version in use.
   - If it exists, it is updated and the notice shows `old -> new`, with an **Abrir** button.
   - Multi-root: asks which folder to write it in.
3. Optional: `pickvernode.autoWriteNvmrc: true` updates it automatically on every switch.
4. Optional: `pickvernode.nvmrcPrefixV: false` writes `20.18.0` instead of `v20.18.0`.

### 5. Force a manager

If you have several installed and want a specific one:

- `Ctrl+Shift+P` -> `PickVerNode: Choose the version manager` (remembered across sessions), or
- set `pickvernode.provider` in your settings (`nvm-windows`, `nvm`, `fnm`, `volta`, `asdf`).

---

## Settings

| Setting | Default | What it does |
|---|---|---|
| `pickvernode.provider` | `auto` | Manager to use; `auto` = autodetect |
| `pickvernode.updateTerminalEnv` | `true` | Prepends the version's bin to `terminal.integrated.env` (nvm POSIX and fnm only) |
| `pickvernode.nvmPath` | `""` | Path to `nvm.exe` on Windows (empty = `%APPDATA%\nvm\nvm.exe`) |
| `pickvernode.elevate` | `true` | Windows: run `nvm use` elevated (nvm-windows requires it) |
| `pickvernode.autoWriteNvmrc` | `false` | Update `.nvmrc` on every version switch |
| `pickvernode.nvmrcPrefixV` | `true` | Write `.nvmrc` with the `v` prefix (`v20.18.0`) |
| `pickvernode.pollSeconds` | `20` | How often to re-check for switches made outside this window (only while focused). `0` = on focus only |

## Technical notes

- nvm-windows needs a real console and admin rights: hence `cmd.exe` + `Start-Process -Verb RunAs`.
- On POSIX, `nvm use` only affects the shell that runs it; the persistent state is the `default` alias.
  To make VS Code terminals pick up the version, `terminal.integrated.env.<os>.PATH` is written
  (disable with `pickvernode.updateTerminalEnv`).
- Volta and asdf work with shims: the switch is global and does not touch VS Code's PATH.
- After install/uninstall the disk is polled every 3s, with a 15 min cap.
- Managers with a global scope (nvm-windows, Volta, asdf) affect every VS Code window. The status bar
  re-checks whenever the window regains focus, and every `pickvernode.pollSeconds` while focused, so a
  switch made from another window shows up here too.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Node $(warning)` in the status bar | No manager detected. Install one or use `PickVerNode: Choose the version manager` |
| `node -v` still old in the terminal | Terminal was opened before the switch. Close it and open a new one |
| No UAC prompt / switch fails on Windows | Check `pickvernode.nvmPath`; without `pickvernode.elevate` nvm-windows cannot rebuild the symlink |
| "could not verify against nodejs.org" | No network or a proxy. Type the exact `X.Y.Z` version and confirm |
| Version does not show up after install | Check the `PickVerNode: install ...` terminal: the manager's error is there |
| Status bar disagrees with `node -v` | Another window switched the version globally. Focus this window (it re-checks) or run `PickVerNode: Refresh the current version`. If you use nvm POSIX/fnm, this workspace may pin its own PATH via `terminal.integrated.env` — clear it or disable `pickvernode.updateTerminalEnv` |

## Telemetry

PickVerNode collects **anonymous, opt-out** usage data to decide what to build next.

**What is sent:** an anonymous install id (`vscode.env.machineId`), OS and architecture,
VS Code and extension version, which version manager was detected, the name of the command you ran,
and whether the workspace is multi-root.

**What is never sent:** file paths, folder or repository names, file contents, environment variables,
your Node versions' install locations, or anything typed into an input box.

**How to turn it off** (either one is enough):

- VS Code's global setting: `telemetry.telemetryLevel` -> `off`
- This extension only: `pickvernode.telemetry` -> `false`

## Support

If PickVerNode saves you time, you can [sponsor the project](https://github.com/sponsors/MDMS29).

## License

MIT
