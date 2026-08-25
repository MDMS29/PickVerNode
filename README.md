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

## Instalar una version

En el QuickPick, la primera opcion es **Instalar una version...** (o comando
`PickVerNode: Instalar una version de Node`).

- Acepta `20.18.0`, `20`, `20.18`, `lts` o `latest`; los prefijos se resuelven a la ultima de esa serie.
- La version se valida contra `https://nodejs.org/dist/index.json`. Si no existe, avisa y no instala.
- Sin red solo se acepta una version exacta `X.Y.Z`, pidiendo confirmacion (sin verificar).
- La instalacion corre en una terminal de VSCode (igual que el cmd), con el comando del gestor
  (`nvm install`, `fnm install`, `volta install node@`, `asdf install nodejs`).
- Al terminar avisa y ofrece **Usarla ahora**.

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
