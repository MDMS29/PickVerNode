# Changelog

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
