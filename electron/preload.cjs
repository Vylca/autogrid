const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (json) => ipcRenderer.invoke('data:save', json),
  backupData: (tag) => ipcRenderer.invoke('data:backup', tag),
  saveDataSync: (json) => ipcRenderer.sendSync('data:saveSync', json),
  appInfo: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openCsv: () => ipcRenderer.invoke('csv:open'),
  exportPdf: (req) => ipcRenderer.invoke('pdf:export', req),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  onPrintJob: (cb) => ipcRenderer.on('print:job', (_e, job) => cb(job)),
  printReady: (id, info) => ipcRenderer.send('print:ready', id, info),
  selftestInfo: () => ipcRenderer.invoke('selftest:info'),
  selftestScreenshot: (name) => ipcRenderer.invoke('selftest:screenshot', name),
  selftestLog: (name, data) => ipcRenderer.invoke('selftest:log', name, data),
  selftestResize: (w, h) => ipcRenderer.invoke('selftest:resize', w, h),
  selftestDone: () => ipcRenderer.invoke('selftest:done'),
});
