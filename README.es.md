# PickVerNode

> 🇬🇧 English version: [README.md](README.md)

Cambia la version de Node desde la barra de estado de VSCode. Sin terminal, sin recordar comandos.

## ¿Que es?

Extension de VSCode que muestra un item en la barra de estado (abajo a la derecha) con la
version de Node activa: `$(versions) Node 20.18.0`.

Un click abre un QuickPick con todo lo que puedes hacer: cambiar, instalar, desinstalar y
guardar `.nvmrc`.

No es un gestor de versiones: es un mando a distancia para el que ya tienes
(nvm, nvm-windows, fnm, Volta o asdf).

## ¿Para que sirve?

- Ver de un vistazo con que version de Node estas trabajando.
- Saltar entre proyectos que exigen versiones distintas sin abrir terminal.
- Instalar/desinstalar versiones sin buscar la sintaxis de cada gestor.
- Dejar fijada la version del proyecto en `.nvmrc` para el resto del equipo.

## ¿Como funciona?

1. Al arrancar VSCode detecta que gestor tienes instalado (o usas `pickvernode.provider` para forzar uno).
2. Le pregunta a ese gestor la version activa y la lista de instaladas.
3. Cuando eliges una version, ejecuta el comando propio del gestor:

| Gestor | SO | Cambiar | Instalar | Desinstalar | Alcance |
|---|---|---|---|---|---|
| nvm-windows | Windows | `nvm.exe use X` via `cmd.exe` elevado (UAC) | `nvm.exe install X` | `nvm.exe uninstall X` | global al SO |
| fnm | Win/macOS/Linux | `fnm default X` + PATH en terminales de VSCode | `fnm install X` | `fnm uninstall X` | shells nuevas |
| nvm (POSIX) | macOS/Linux | `nvm alias default X && nvm use X` + PATH en terminales de VSCode | `nvm install X` | `nvm uninstall X` | shells nuevas |
| Volta | Win/macOS/Linux | `volta install node@X` | `volta install node@X` | no soportado | global (shims) |
| asdf | macOS/Linux | `asdf set -u nodejs X` (fallback `asdf global nodejs X`) | `asdf install nodejs X` | `asdf uninstall nodejs X` | global (shims) |

Instalar y desinstalar corren en una terminal visible de VSCode (ves el progreso real del gestor);
la extension vigila el disco y avisa cuando la version aparece o desaparece.

> Las terminales ya abiertas conservan la version vieja. **Reabrelas.**

## Funcionalidades

| Accion | Desde el QuickPick | Comando (`Ctrl+Shift+P`) |
|---|---|---|
| Cambiar de version | click en la version | `PickVerNode: Cambiar version de Node` |
| Instalar una version | `Instalar una version...` | `PickVerNode: Instalar una version de Node` |
| Desinstalar una version | `Desinstalar una version...` | `PickVerNode: Desinstalar una version de Node` |
| Guardar `.nvmrc` | `Guardar .nvmrc (X.Y.Z)` | `PickVerNode: Guardar .nvmrc con la version actual` |
| Elegir gestor | - | `PickVerNode: Elegir gestor de versiones` |
| Refrescar el estado | - | `PickVerNode: Refrescar version actual` |

---

## Tutorial

### 0. Requisito previo

Ten instalado uno de: [nvm-windows](https://github.com/coreybutler/nvm-windows),
[nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm),
[Volta](https://volta.sh) o [asdf](https://asdf-vm.com).

Si el item de la barra muestra `Node $(warning)`, no se detecto ninguno.

### 1. Cambiar de version

1. Click en `$(versions) Node X.Y.Z` (barra de estado, abajo a la derecha).
2. En la lista **Instaladas**, elige la version. La actual lleva `$(check)` y dice `en uso`.
3. Sale una notificacion de progreso y luego `Node X.Y.Z activo`.
4. **Reabre las terminales** para que tomen el cambio.

En Windows con nvm-windows saltara el UAC: es obligatorio, `nvm use` necesita admin para el symlink.

### 2. Instalar una version

1. Abre el QuickPick -> **Instalar una version...**
2. Escribe la version. Vale `20.18.0`, `20`, `20.18`, `lts` o `latest`;
   los prefijos se resuelven a la ultima de esa serie (`20` -> `20.19.4`).
3. Se valida contra `https://nodejs.org/dist/index.json`.
   - Si no existe -> avisa y no instala.
   - Si ya la tienes -> te ofrece **Usarla**.
   - Sin red -> solo acepta `X.Y.Z` exacta y pide confirmacion (sin verificar).
4. Se abre una terminal `PickVerNode: install X.Y.Z` con el comando del gestor
   (`nvm install`, `fnm install`, `volta install node@`, `asdf install nodejs`).
5. Al terminar: `Node X.Y.Z instalada` + boton **Usarla ahora**.

### 3. Desinstalar una version

1. QuickPick -> **Desinstalar una version...**
2. Elige de la lista (solo instaladas, no se escribe nada a mano).
3. Confirma en el dialogo modal. Si la version esta **en uso**, avisa de que te quedas sin node activo.
4. Corre en terminal `nvm uninstall`, `fnm uninstall` o `asdf uninstall nodejs`, y avisa al terminar.

> Volta no permite desinstalar versiones de node: la opcion avisa y no hace nada.

### 4. Guardar `.nvmrc`

1. QuickPick -> **Guardar .nvmrc (X.Y.Z)** (solo aparece si hay carpeta abierta).
2. Escribe `.nvmrc` en la raiz con la version en uso.
   - Si ya existe, lo actualiza y el aviso muestra `anterior -> nuevo`, con boton **Abrir**.
   - Multi-root: pregunta en que carpeta escribirlo.
3. Opcional: `pickvernode.autoWriteNvmrc: true` lo actualiza solo cada vez que cambias de version.
4. Opcional: `pickvernode.nvmrcPrefixV: false` escribe `20.18.0` en vez de `v20.18.0`.

### 5. Forzar un gestor

Si tienes varios instalados y quiere usar otro:

- `Ctrl+Shift+P` -> `PickVerNode: Elegir gestor de versiones` (se recuerda entre sesiones), o
- fija `pickvernode.provider` en los settings (`nvm-windows`, `nvm`, `fnm`, `volta`, `asdf`).

---

## Configuracion

| Ajuste | Por defecto | Que hace |
|---|---|---|
| `pickvernode.provider` | `auto` | Gestor a usar; `auto` = deteccion automatica |
| `pickvernode.updateTerminalEnv` | `true` | Prefija el bin de la version en `terminal.integrated.env` (solo nvm POSIX y fnm) |
| `pickvernode.nvmPath` | `""` | Ruta a `nvm.exe` en Windows (vacio = `%APPDATA%\nvm\nvm.exe`) |
| `pickvernode.elevate` | `true` | Windows: ejecutar `nvm use` elevado (nvm-windows lo necesita) |
| `pickvernode.autoWriteNvmrc` | `false` | Actualiza el `.nvmrc` en cada cambio de version |
| `pickvernode.nvmrcPrefixV` | `true` | `.nvmrc` con prefijo `v` (`v20.18.0`) |

## Notas tecnicas

- nvm-windows exige consola real y admin: por eso `cmd.exe` + `Start-Process -Verb RunAs`.
- En POSIX `nvm use` solo afecta a la shell que lo ejecuta; el estado persistente es el alias `default`.
  Para que las terminales de VSCode tomen la version se escribe `terminal.integrated.env.<so>.PATH`
  (desactivable con `pickvernode.updateTerminalEnv`).
- Volta y asdf funcionan con shims: el cambio es global y no toca el PATH de VSCode.
- La espera tras instalar/desinstalar sondea el disco cada 3s, con limite de 15 min.

## Problemas comunes

| Sintoma | Causa / solucion |
|---|---|
| `Node $(warning)` en la barra | No hay gestor detectado. Instala uno o usa `Elegir gestor de versiones` |
| `node -v` sigue viejo en la terminal | Terminal abierta antes del cambio. Cierrala y abre otra |
| El UAC no aparece / falla el cambio en Windows | Revisa `pickvernode.nvmPath`; sin `pickvernode.elevate` nvm-windows no puede rehacer el symlink |
| "no se pudo verificar contra nodejs.org" | Sin red o proxy. Escribe la version exacta `X.Y.Z` y confirma |
| La version no aparece tras instalar | Mira la terminal `PickVerNode: install ...`: el error del gestor esta ahi |

## Licencia

MIT
