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
| Switch version | click the version | `PickVerNode: Cambiar version de Node` |
| Install a version | `Instalar una version...` | `PickVerNode: Instalar una version de Node` |
| Uninstall a version | `Desinstalar una version...` | `PickVerNode: Desinstalar una version de Node` |
| Write `.nvmrc` | `Guardar .nvmrc (X.Y.Z)` | `PickVerNode: Guardar .nvmrc con la version actual` |
| Choose manager | - | `PickVerNode: Elegir gestor de versiones` |
| Refresh state | - | `PickVerNode: Refrescar version actual` |

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

- `Ctrl+Shift+P` -> `PickVerNode: Elegir gestor de versiones` (remembered across sessions), or
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

## Technical notes

- nvm-windows needs a real console and admin rights: hence `cmd.exe` + `Start-Process -Verb RunAs`.
- On POSIX, `nvm use` only affects the shell that runs it; the persistent state is the `default` alias.
  To make VS Code terminals pick up the version, `terminal.integrated.env.<os>.PATH` is written
  (disable with `pickvernode.updateTerminalEnv`).
- Volta and asdf work with shims: the switch is global and does not touch VS Code's PATH.
- After install/uninstall the disk is polled every 3s, with a 15 min cap.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Node $(warning)` in the status bar | No manager detected. Install one or use `Elegir gestor de versiones` |
| `node -v` still old in the terminal | Terminal was opened before the switch. Close it and open a new one |
| No UAC prompt / switch fails on Windows | Check `pickvernode.nvmPath`; without `pickvernode.elevate` nvm-windows cannot rebuild the symlink |
| "could not verify against nodejs.org" | No network or a proxy. Type the exact `X.Y.Z` version and confirm |
| Version does not show up after install | Check the `PickVerNode: install ...` terminal: the manager's error is there |

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
