# PickVerNode

Item en la barra de estado (abajo derecha) con la version de Node activa.
Click -> lista de versiones instaladas -> cambia.

## Gestores soportados

| Gestor | SO | Como cambia | Alcance |
|---|---|---|---|
| nvm-windows | Windows | `nvm use X` via `cmd.exe` elevado (UAC) | global al SO |
| fnm | Win/macOS/Linux | `fnm default X` + PATH en terminales de VSCode | shells nuevas |
| nvm (POSIX) | macOS/Linux | `nvm alias default X` + PATH en terminales de VSCode | shells nuevas |
| Volta | Win/macOS/Linux | `volta install node@X` | global (shims) |
| asdf | macOS/Linux | `asdf set -u nodejs X` (o `global`) | global (shims) |

Deteccion automatica; `vNode: Elegir gestor de versiones` para forzar uno.

## Notas

- nvm-windows exige consola real y admin: por eso `cmd.exe` + `Start-Process -Verb RunAs`.
- En POSIX `nvm use` solo afecta a la shell que lo ejecuta; el estado persistente es el alias `default`.
  Para que las terminales de VSCode tomen la version se escribe `terminal.integrated.env.<so>.PATH`
  (desactivable con `vnode.updateTerminalEnv`).
- Las terminales ya abiertas conservan la version vieja. Reabrelas.

## Config

`vnode.provider`, `vnode.updateTerminalEnv`, `vnode.nvmPath`, `vnode.elevate`.

## Dev

Probar: F5 (Extension Development Host).
Empaquetar: `npx @vscode/vsce package` -> `code --install-extension vnode-0.1.0.vsix`.
