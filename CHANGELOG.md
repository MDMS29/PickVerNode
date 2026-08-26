# Changelog

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
