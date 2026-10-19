const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

if (process.env.AUTOGRID_USERDATA) app.setPath('userData', process.env.AUTOGRID_USERDATA);

// French first: date pickers and number formats follow this locale.
app.commandLine.appendSwitch('lang', 'fr-FR');

const SELFTEST_DIR = process.env.AUTOGRID_SELFTEST || '';
const ICON = path.join(__dirname, 'icon.png');

let mainWindow = null;
let printWindow = null;
let backedUp = false;
const printWaiters = new Map();

function webFile(name) {
  return path.join(__dirname, '..', 'dist-web', name);
}

function dataFile() {
  return path.join(app.getPath('userData'), 'autogrid-data.json');
}

// ---- Data -----------------------------------------------------------------

function readData() {
  try {
    return fs.readFileSync(dataFile(), 'utf-8');
  } catch {
    return null;
  }
}

function writeData(json) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!backedUp && fs.existsSync(file)) {
    // One backup per session, taken before the first write.
    fs.copyFileSync(file, path.join(path.dirname(file), 'autogrid-data.backup.json'));
    backedUp = true;
  }
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, json, 'utf-8');
  fs.renameSync(tmp, file);
}

ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_e, json) => {
  writeData(json);
  return true;
});
ipcMain.on('data:saveSync', (e, json) => {
  try {
    writeData(json);
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});

ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataPath: dataFile() }));

// ---- CSV import -------------------------------------------------------------

ipcMain.handle('csv:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CSV', extensions: ['csv', 'txt'] },
      { name: '*', extensions: ['*'] },
    ],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const file = res.filePaths[0];
  return { name: path.basename(file), bytes: new Uint8Array(fs.readFileSync(file)) };
});

ipcMain.handle('shell:open', (_e, p) => shell.openPath(p));

// ---- PDF export -------------------------------------------------------------

function getPrintWindow() {
  if (printWindow && !printWindow.isDestroyed()) return Promise.resolve(printWindow);
  printWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  return printWindow.loadFile(webFile('print.html')).then(() => printWindow);
}

ipcMain.on('print:ready', (_e, id, info) => {
  const waiter = printWaiters.get(id);
  if (waiter) {
    printWaiters.delete(id);
    waiter(info);
  }
});

async function renderPdf(doc, opts) {
  const win = await getPrintWindow();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      printWaiters.delete(id);
      reject(new Error('print timeout'));
    }, 60000);
    printWaiters.set(id, (info) => {
      clearTimeout(timer);
      resolve(info);
    });
  });
  win.webContents.send('print:job', {
    id,
    blocks: doc.blocks,
    layout: opts.layout,
    orientation: opts.orientation,
    color: opts.color,
    title: doc.title || '',
  });
  await ready;
  return win.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    landscape: opts.orientation === 'landscape',
    pageSize: 'A4',
  });
}

function safeFileName(name) {
  return (
    String(name || 'grille')
      .replace(/[\/\\:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'grille'
  );
}

ipcMain.handle('pdf:export', async (_e, req) => {
  const opts = { layout: req.layout, orientation: req.orientation, color: req.color };
  try {
    if (req.kind === 'perStudent') {
      let dir = req.outputDir || (SELFTEST_DIR ? SELFTEST_DIR : null);
      if (!dir) {
        const res = await dialog.showOpenDialog(mainWindow, {
          title: req.dialogTitle,
          properties: ['openDirectory', 'createDirectory'],
        });
        if (res.canceled || !res.filePaths[0]) return { canceled: true };
        dir = res.filePaths[0];
      }
      if (req.subfolder) {
        dir = path.join(dir, safeFileName(req.subfolder));
        fs.mkdirSync(dir, { recursive: true });
      }
      const used = new Set();
      for (const doc of req.documents) {
        let base = safeFileName(doc.fileName);
        let name = `${base}.pdf`;
        let n = 2;
        while (used.has(name)) name = `${base} (${n++}).pdf`;
        used.add(name);
        const pdf = await renderPdf(doc, { ...opts, layout: 'perPage' });
        fs.writeFileSync(path.join(dir, name), pdf);
      }
      return { ok: true, path: dir, count: req.documents.length };
    }
    let file = req.outputPath || (SELFTEST_DIR ? path.join(SELFTEST_DIR, `${safeFileName(req.defaultName)}.pdf`) : null);
    if (!file) {
      const res = await dialog.showSaveDialog(mainWindow, {
        title: req.dialogTitle,
        defaultPath: path.join(app.getPath('documents'), `${safeFileName(req.defaultName)}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (res.canceled || !res.filePath) return { canceled: true };
      file = res.filePath.endsWith('.pdf') ? res.filePath : `${res.filePath}.pdf`;
    }
    const pdf = await renderPdf(req.documents[0], opts);
    fs.writeFileSync(file, pdf);
    return { ok: true, path: file, count: 1 };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    printWindow = null;
  }
});

// ---- Self test (development only) ------------------------------------------

ipcMain.handle('selftest:info', () => (SELFTEST_DIR ? { dir: SELFTEST_DIR } : null));
ipcMain.handle('selftest:screenshot', async (_e, name) => {
  if (!SELFTEST_DIR || !mainWindow) return false;
  const img = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(SELFTEST_DIR, `${name}.png`), img.toPNG());
  return true;
});
ipcMain.handle('selftest:log', (_e, name, data) => {
  if (SELFTEST_DIR) fs.writeFileSync(path.join(SELFTEST_DIR, `${name}.json`), JSON.stringify(data, null, 2));
});
ipcMain.handle('selftest:done', () => {
  if (SELFTEST_DIR) setTimeout(() => app.quit(), 200);
});

// ---- Window -------------------------------------------------------------------

function buildMenu() {
  const template = [
    { role: 'editMenu' },
    {
      label: 'Affichage',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    title: 'AutoGrid',
    icon: ICON,
    autoHideMenuBar: true,
    backgroundColor: '#FBFCFE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.loadFile(webFile('index.html'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = SELFTEST_DIR ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    buildMenu();
    createMainWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
