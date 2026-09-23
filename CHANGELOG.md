# Changelog

## No publicado

- **La extension habla el idioma de VSCode**. Ingles por defecto; con VSCode en espanol
  (`Configure Display Language`) todo sale en espanol: notificaciones, listas, tooltip, guia de
  inicio, titulos de comandos y descripciones de los ajustes.
  - Runtime: `vscode.l10n.t()` en `src/` + `l10n/bundle.l10n.es.json` (111 cadenas).
  - Contribuciones estaticas: `%claves%` en `package.json` + `package.nls.json` (ingles) y
    `package.nls.es.json` (espanol), 44 claves.
  - Anadir otro idioma = un archivo: `l10n/bundle.l10n.<lang>.json` y `package.nls.<lang>.json`.
- `test/l10n.test.js` protege las traducciones: falla si una cadena nueva no esta traducida, si
  sobran cadenas en el bundle, si los marcadores `{0}` no coinciden entre idiomas, si falta una
  `%clave%` o si alguien escribe un mensaje literal en vez de `l10n.t()`.

- Los titulos de los comandos pasan a ingles (`PickVerNode: Switch Node version`, ...): el
  marketplace es global y la paleta de comandos es lo primero que se busca. Los ids no cambian,
  asi que los keybindings existentes siguen funcionando.
- `globals` anadido a `devDependencies`: `npm run lint` fallaba con `ERR_MODULE_NOT_FOUND` desde
  `eslint.config.mjs`. El lint ahora cubre tambien `test/`.
- Los scripts `package`, `publish` y `publish:ovsx` dejan de usar `npx --yes`: `@vscode/vsce` y
  `ovsx` son dependencias de desarrollo. `npx` instalaba paquetes sueltos dentro de `node_modules`
  y `vsce` fallaba despues con `ELSPROBLEMS`.
- Tests por provider (`test/providers.test.js`) con `src/util` sustituido: parseo de `fnm ls`,
  fallback al disco, alias `default` de nvm POSIX, `settings.txt` de nvm-windows, elevacion segun
  `pickvernode.elevate`, fallback de `asdf set -u` a `asdf global` y shims de Volta.
- CI en GitHub Actions: lint + test en Linux (bajo `xvfb`), Windows y macOS, y empaquetado del
  `.vsix` como artefacto.

- **Multi-root de verdad**: con varias carpetas abiertas, el PATH de las terminales se escribe en
  la carpeta activa (`ConfigurationTarget.WorkspaceFolder`), no en el workspace entero, asi cada
  carpeta abre sus terminales con su version (solo gestores por shell: nvm POSIX y fnm).
- Nuevo comando `PickVerNode: Ver la version de Node por carpeta` (`pickvernode.checkFolders`):
  lista cada carpeta con lo que pide, si la activa lo cumple y su `packageManager`. Elegir una
  abre el archivo que fija la version.
- **Perfil de terminal** "Node (PickVerNode)" (`contributes.terminalProfiles`): abre una shell con
  el bin de la version que toca en esa carpeta (la del proyecto si esta instalada), sin tocar
  ajustes ni las terminales ya abiertas.
- **corepack**: si el `package.json` fija `packageManager`, el tooltip lo muestra y aparece
  `Activar pnpm@9.1.0 con corepack`, que corre `corepack enable && corepack prepare <spec>
  --activate` en una terminal. Nuevo comando `pickvernode.enableCorepack`.
- Nuevo comando `PickVerNode: Abrir la carpeta de la version activa` (`pickvernode.revealBinFolder`),
  tambien como enlace del tooltip.
- El tooltip muestra la **carpeta activa** cuando el workspace es multi-root.

- **Aviso de fin de soporte (EOL)**: si la version activa pertenece a una linea que ya no recibe
  parches, la barra de estado se pone naranja y sale un aviso una sola vez por version
  (silenciable con "No avisar de esta", que se recuerda entre ventanas). Fechas del calendario
  oficial `nodejs/Release`.
- Nuevos ajustes `pickvernode.warnEndOfLife` y `pickvernode.notifyEndOfLife`.
  `pickvernode.warnEndOfLife: false` apaga **todo** el tema del soporte: barra naranja, aviso, la
  fecha en la lista de versiones y la fila del tooltip, y ni siquiera se consulta el calendario de
  `nodejs/Release`.
- **Instalar la version del proyecto en un click**: si ninguna instalada cumple el requisito, el
  boton del aviso pasa a ser `Instalar la que pide` y la primera opcion de la lista a
  `Instalar la version del proyecto (>=20 <21)`. Si si hay una instalada, el boton dice a cual
  cambia (`Cambiar a 20.18.0`).

- **Lista de versiones con contexto**: cada version muestra si es `LTS <codename>` o `Current` y
  hasta cuando tiene soporte (`Soporte hasta 2027-04-30`, `Solo mantenimiento`, `Sin soporte desde
  ...`, esta ultima con `$(warning)`). Los datos salen de `nodejs.org/dist/index.json` y del
  calendario oficial `nodejs/Release` (cache de 1h y 24h).
- La lista se separa en **En uso / Instaladas / Disponibles para instalar**. Las disponibles son la
  Current y la ultima de cada linea aun soportada: se instalan con un click, sin escribir la version.
- La busqueda del QuickPick tambien mira description y detail: escribir `iron` o `2027` filtra.
- La lista de desinstalar marca igual las versiones sin soporte.
- El tooltip de la barra de estado incluye la fila **Soporte**.
- Nuevo ajuste `pickvernode.showAvailableVersions` para no consultar nodejs.org al abrir la lista.
- Si nodejs.org tarda mas de 1,5s la lista se abre igual, solo con las instaladas.

- **Guia de inicio** (`contributes.walkthroughs`): se abre sola tras instalar, con 5 pasos que se
  tachan al ejecutar el comando real (gestor, cambiar version, `.nvmrc`, aviso de desajuste y el
  UAC de Windows, este ultimo solo en Windows). Ilustraciones SVG animadas en `images/walkthrough/`.
- Nuevo comando `PickVerNode: Abrir la guia de inicio` (`pickvernode.openWalkthrough`), enlazado
  tambien desde el tooltip cuando no se detecta ningun gestor.

- **Tooltip informativo**: la barra de estado muestra en markdown la version activa (con LTS/Current
  de nodejs.org), el gestor, el origen de la version (requisito del proyecto o default del gestor),
  la carpeta `bin` y botones para cambiar, instalar, guardar `.nvmrc`, copiar el bin, refrescar y
  elegir gestor.
- Nuevo comando `PickVerNode: Copiar la ruta bin de la version activa` (`pickvernode.copyBinPath`).
  nvm, nvm-windows y fnm tienen carpeta por version; Volta y asdf usan shims, ahi se omite.

- **Aviso de version incorrecta**: si el proyecto fija una version (`.nvmrc`, `.node-version`,
  `.tool-versions`, `package.json#volta.node` o `package.json#engines.node`) y la activa no la
  cumple, la barra de estado se pone naranja con `$(warning)` y aparece un aviso con un boton
  para cambiar. Nunca cambia la version sola.
- Se soportan rangos semver en `engines.node` (`>=18 <21`, `^20.10.0`, `~20.10`, `18 || 20`, `20.x`)
  y los alias `lts/*` y `lts/iron` de `.nvmrc`.
- Si ninguna version instalada cumple, ofrece instalar la que corresponde.
- Nuevo comando `PickVerNode: Usar la version que pide el proyecto` (`pickvernode.useRequired`),
  tambien como primera opcion del QuickPick cuando hay desajuste.
- Nuevos ajustes `pickvernode.checkRequiredVersion` y `pickvernode.notifyRequiredVersion`.
  El aviso se puede silenciar por carpeta desde la propia notificacion ("No avisar aqui").

- La barra de estado se refresca al recuperar el foco la ventana y cada `pickvernode.pollSeconds`
  (20s por defecto) mientras lo tiene: antes solo se leia la version al arrancar, asi que un cambio
  hecho desde otra ventana dejaba la barra desactualizada frente a `node -v`.
- Nuevo ajuste `pickvernode.pollSeconds` (`0` = revisar solo al recuperar el foco).

## 0.5.0

- Telemetria anonima y opt-out para saber que gestores y comandos se usan de verdad.
- Nunca se envian rutas, nombres de proyecto ni contenido de archivos: solo un id anonimo de
  instalacion, SO, version de VSCode/extension, gestor detectado y nombre del comando.
- Se respeta el ajuste global `telemetry.telemetryLevel` de VSCode.
- Nuevo ajuste `pickvernode.telemetry` para desactivarla solo en esta extension.

## 0.4.2

- README en ingles (`README.md`) + version en espanol (`README.es.md`) con enlaces cruzados.
- Metadatos del marketplace corregidos: `repository`, `bugs`, `homepage`, `qna` apuntan al repo real.
- Boton de patrocinio (`sponsor`) en la pagina del marketplace.
- Keywords ampliadas y categoria `Programming Languages` para mejorar la busqueda.
- `.vscodeignore` ampliado: el paquete ya no incluye `node_modules`, `.github` ni `.claude`.
- Scripts `package` / `publish` via `npx`; nuevo script `publish:ovsx` para Open VSX.

## 0.4.0

- Opcion "Guardar .nvmrc" en el QuickPick: crea o actualiza `.nvmrc` en la raiz de la carpeta abierta
  con la version de Node en uso.
- En workspaces multi-root pregunta en que carpeta escribirlo.
- Si el archivo ya existe, se actualiza y el aviso muestra el valor anterior.
- Config `pickvernode.autoWriteNvmrc` para actualizarlo automaticamente al cambiar de version.
- Config `pickvernode.nvmrcPrefixV` para elegir `v20.18.0` o `20.18.0`.
- Comando `PickVerNode: Guardar .nvmrc con la version actual`.

## 0.3.0

- Opcion "Desinstalar una version..." en el QuickPick: se elige de las instaladas, sin escribir nada.
- Confirmacion modal; aviso extra si la version elegida es la que esta en uso.
- Corre en una terminal de VSCode y avisa cuando la version desaparece del disco.
- Volta no soporta desinstalar versiones de node: se avisa en vez de intentarlo.
- Comando `PickVerNode: Desinstalar una version de Node`.

## 0.2.0

- Opcion "Instalar una version..." dentro del listado del QuickPick.
- Entrada libre: `20.18.0`, `20`, `20.18`, `lts` o `latest` (los prefijos se resuelven).
- Validacion contra nodejs.org/dist/index.json: si la version no existe, se avisa y no se instala.
- La instalacion corre en una terminal de VSCode; al terminar ofrece cambiar a esa version.
- Comando `PickVerNode: Instalar una version de Node`.

## 0.1.0

- Item en la barra de estado con la version de Node activa.
- Cambio de version desde un QuickPick.
- Soporte de nvm-windows, nvm (POSIX), fnm, Volta y asdf con deteccion automatica.
- Comando para elegir el gestor manualmente.
- Inyeccion opcional del PATH en las terminales de VSCode (nvm POSIX / fnm).
