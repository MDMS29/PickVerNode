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
- Enterarte cuando la version activa no es la que exige el proyecto.

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
| Cambiar de version | click en la version | `PickVerNode: Switch Node version` |
| Instalar una version | `Instalar una version...` | `PickVerNode: Install a Node version` |
| Desinstalar una version | `Desinstalar una version...` | `PickVerNode: Uninstall a Node version` |
| Guardar `.nvmrc` | `Guardar .nvmrc (X.Y.Z)` | `PickVerNode: Write .nvmrc with the current version` |
| Usar la version del proyecto | `Usar la version del proyecto (X)` | `PickVerNode: Use the version the project requires` |
| Copiar la ruta bin | tooltip -> `Copiar bin` | `PickVerNode: Copy the active version bin path` |
| Abrir la carpeta de la version | tooltip -> `Abrir carpeta` | `PickVerNode: Reveal the active version folder` |
| Version por carpeta (multi-root) | `Ver la version por carpeta...` | `PickVerNode: Show the Node version per folder` |
| Activar el gestor de paquetes | `Activar pnpm@9.1.0 con corepack` | `PickVerNode: Activate the project package manager (corepack)` |
| Abrir la guia de inicio | - | `PickVerNode: Open the getting started guide` |
| Elegir gestor | - | `PickVerNode: Choose the version manager` |
| Refrescar el estado | - | `PickVerNode: Refresh the current version` |

### La lista de versiones

Un click en la barra de estado abre un QuickPick dividido en tres secciones:

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

"Disponibles" = la Current mas la ultima de cada linea que siga con soporte, para instalar de un
click sin escribir la version. Las fechas salen del calendario oficial `nodejs/Release`; los
releases y codenames de `nodejs.org/dist/index.json`. Ambos se cachean (1h / 24h) y la lista se
abre igual si la red tarda mas de 1,5s, solo que sin esos datos. Se desactiva la consulta con
`pickvernode.showAvailableVersions`.

Al escribir tambien se filtra por description y detail: `iron` o `2027` acotan la lista.

### Workspaces multi-root

Con varias carpetas abiertas, la barra de estado sigue **a la carpeta del archivo que estas
editando**: lee el `.nvmrc`/`engines.node` de esa carpeta y avisa contra eso. Cuando PickVerNode
prefija el `PATH` de las terminales lo escribe en los ajustes de esa carpeta, asi cada una abre sus
terminales con su version (solo gestores por shell: nvm POSIX y fnm; `nvm-windows`, Volta y asdf
son globales de la maquina por diseno).

`PickVerNode: Show the Node version per folder` lista cada carpeta, que pide, si la version
activa lo cumple y su `packageManager`. Al elegir una se abre el archivo que fija la version.

### Perfil de terminal

En el desplegable de terminales aparece **Node (PickVerNode)**: abre una shell cuyo `PATH` ya
apunta a la version que necesita esa carpeta (la del proyecto si esta instalada; si no, la activa).
No escribe nada en los ajustes ni toca las terminales ya abiertas: sirve para un comando puntual en
otra version.

### Gestor de paquetes (corepack)

Si el `package.json` de la carpeta fija `"packageManager": "pnpm@9.1.0"`, el tooltip lo muestra y
la lista ofrece `Activar pnpm@9.1.0 con corepack`, que corre
`corepack enable && corepack prepare pnpm@9.1.0 --activate` en una terminal visible. Version de
Node y version del gestor de paquetes quedan fijadas juntas, que es lo que el proyecto necesita de
verdad.

### Idioma

PickVerNode sigue el idioma de VSCode. Por defecto ingles; con VSCode en espanol
(`Configure Display Language`) todo sale en espanol: notificaciones, listas, tooltip, guia de
inicio, titulos de comandos y descripciones de los ajustes.

Anadir un idioma son dos archivos y cero codigo: `l10n/bundle.l10n.<lang>.json` (cadenas de
runtime, indexadas por el texto en ingles) y `package.nls.<lang>.json` (titulos de comandos,
ajustes, guia de inicio). Se aceptan PRs.

### Tooltip de la barra de estado

Al pasar el raton por el item se ve todo de un golpe, y ademas funciona como menu:

| | |
|:--|:--|
| **Node** | **20.18.0** · LTS Iron |
| **Gestor** | fnm |
| **Proyecto** | `>=18 <21` ✓ cumple · `package.json (engines.node)` |
| **Bin** | `~/.local/share/fnm/node-versions/v20.18.0/installation/bin` |

Mas enlaces clicables: cambiar, instalar, guardar `.nvmrc`, copiar la ruta bin, refrescar y elegir
gestor. Si el proyecto no fija version, la tercera fila dice `default de <gestor>`, asi siempre
sabes *por que* estas en esa version. El LTS/Current sale de `nodejs.org/dist/index.json` (cache de
1h); sin red esa parte simplemente no aparece. Volta y asdf usan shims: no tienen carpeta bin por
version y esa fila se oculta.

### Aviso de fin de soporte (EOL)

Si la version activa pertenece a una linea de Node que ya no recibe parches, la barra de estado se
pone naranja y sale un aviso **una sola vez por version** (`No avisar de esta` se recuerda entre
ventanas). Las fechas salen del calendario oficial `nodejs/Release`, sin adivinar: Node 18 termino
el 2025-04-30 y Node 20 el 2026-04-30.

Ajustes: `pickvernode.warnEndOfLife` es el interruptor general - ponlo en `false` y desaparece
todo rastro del fin de soporte: barra naranja, notificacion, la linea de soporte en la lista de
versiones y la fila **Soporte** del tooltip. Ni siquiera se consulta el calendario de
`nodejs/Release`. `pickvernode.notifyEndOfLife` apaga solo la notificacion y deja lo demas.

### Aviso de version incorrecta

Si la carpeta fija una version de Node y la activa no la cumple, la barra de estado se pone naranja
(`$(versions) Node 18.20.4 $(warning)`) y sale un aviso con un boton para cambiar. **No cambia nada
solo**: solo te avisa, asi no pelea con los hooks de shell de `fnm`/`nvm`.

De donde se lee la version exigida, en este orden:

1. `.nvmrc` - `20.18.0`, `20`, `lts/*`, `lts/iron`
2. `.node-version`
3. `.tool-versions` (asdf) - `nodejs 20.18.0`
4. `package.json` -> `volta.node`
5. `package.json` -> `engines.node` - admite rangos: `>=18 <21`, `^20.10.0`, `~20.10`, `18 || 20`, `20.x`

Si ninguna version instalada cumple, PickVerNode ofrece instalar una que si: el boton del aviso
pasa a `Instalar la que pide` y la primera opcion de la lista a
`Instalar la version del proyecto (>=20 <21)`, de un click y sin escribir nada. Si ya hay una
instalada que cumple, el boton dice a cual cambia (`Cambiar a 20.18.0`).

Ajustes: `pickvernode.checkRequiredVersion` (marca en la barra, por defecto `true`) y
`pickvernode.notifyRequiredVersion` (notificacion, por defecto `true`). El aviso tambien se puede
silenciar por carpeta con el boton "No avisar aqui" de la propia notificacion.

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

- `Ctrl+Shift+P` -> `PickVerNode: Choose the version manager` (se recuerda entre sesiones), o
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
| `pickvernode.pollSeconds` | `20` | Cada cuanto revisar si la version cambio fuera de esta ventana (solo con el foco puesto). `0` = solo al recuperar el foco |

## Notas tecnicas

- nvm-windows exige consola real y admin: por eso `cmd.exe` + `Start-Process -Verb RunAs`.
- En POSIX `nvm use` solo afecta a la shell que lo ejecuta; el estado persistente es el alias `default`.
  Para que las terminales de VSCode tomen la version se escribe `terminal.integrated.env.<so>.PATH`
  (desactivable con `pickvernode.updateTerminalEnv`).
- Volta y asdf funcionan con shims: el cambio es global y no toca el PATH de VSCode.
- La espera tras instalar/desinstalar sondea el disco cada 3s, con limite de 15 min.
- Los gestores de alcance global (nvm-windows, Volta, asdf) afectan a todas las ventanas de VSCode.
  La barra se revisa cada vez que la ventana recupera el foco, y cada `pickvernode.pollSeconds`
  mientras lo tiene, asi que un cambio hecho desde otra ventana tambien aparece aqui.

## Problemas comunes

| Sintoma | Causa / solucion |
|---|---|
| `Node $(warning)` en la barra | No hay gestor detectado. Instala uno o usa `PickVerNode: Choose the version manager` |
| `node -v` sigue viejo en la terminal | Terminal abierta antes del cambio. Cierrala y abre otra |
| El UAC no aparece / falla el cambio en Windows | Revisa `pickvernode.nvmPath`; sin `pickvernode.elevate` nvm-windows no puede rehacer el symlink |
| "no se pudo verificar contra nodejs.org" | Sin red o proxy. Escribe la version exacta `X.Y.Z` y confirma |
| La version no aparece tras instalar | Mira la terminal `PickVerNode: install ...`: el error del gestor esta ahi |
| La barra no coincide con `node -v` | Otra ventana cambio la version de forma global. Da foco a esta ventana (se revisa sola) o usa `PickVerNode: Refresh the current version`. Con nvm POSIX/fnm, este workspace puede tener su propio PATH fijado en `terminal.integrated.env`: limpialo o desactiva `pickvernode.updateTerminalEnv` |

## Telemetria

PickVerNode recoge datos de uso **anonimos y desactivables** para decidir que construir despues.

**Que se envia:** un id anonimo de instalacion (`vscode.env.machineId`), SO y arquitectura,
version de VSCode y de la extension, que gestor se detecto, el nombre del comando ejecutado
y si el workspace es multi-root.

**Que no se envia nunca:** rutas, nombres de carpeta o de repositorio, contenido de archivos,
variables de entorno, ubicacion de tus versiones de Node, ni nada que escribas en un input.

**Como desactivarla** (con cualquiera de las dos basta):

- Ajuste global de VSCode: `telemetry.telemetryLevel` -> `off`
- Solo esta extension: `pickvernode.telemetry` -> `false`

## Licencia

MIT
