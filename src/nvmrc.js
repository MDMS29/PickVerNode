// Manejo del .nvmrc en la raiz de la carpeta abierta.
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const FILE = '.nvmrc';

function folders() {
  return vscode.workspace.workspaceFolders || [];
}

function filePath(folder) {
  return path.join(folder.uri.fsPath, FILE);
}

// Devuelve el contenido actual del .nvmrc de esa carpeta, o null
function read(folder) {
  try {
    const txt = fs.readFileSync(filePath(folder), 'utf8').trim();
    return txt || null;
  } catch {
    return null;
  }
}

// Elige la carpeta destino: unica, o la que pida el usuario en multi-root
async function pickFolder() {
  const list = folders();
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  const choice = await vscode.window.showQuickPick(
    list.map(f => ({
      label: f.name,
      description: read(f) ? `${FILE}: ${read(f)}` : `sin ${FILE}`,
      detail: f.uri.fsPath,
      folder: f
    })),
    { placeHolder: `Carpeta donde escribir ${FILE}` }
  );
  return choice ? choice.folder : null;
}

// Escribe/actualiza el archivo. Devuelve {file, previous, content}
function write(folder, version, { prefixV = true } = {}) {
  const previous = read(folder);
  const content = `${prefixV ? 'v' : ''}${String(version).replace(/^v/, '')}\n`;
  const file = filePath(folder);
  fs.writeFileSync(file, content, 'utf8');
  return { file, previous, content: content.trim() };
}

module.exports = { FILE, folders, filePath, read, pickFolder, write };
