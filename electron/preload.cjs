const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (json) => ipcRenderer.invoke('data:save', json),
  saveDataSync: (json) => ipcRenderer.sendSync('data:saveSync', json),
  appInfo: () => ipcRenderer.invoke('app:info'),
  openCsv: () => ipcRenderer.invoke('csv:open'),
  exportPdf: (req) => ipcRenderer.invoke('pdf:export', req),
  openPath: (p) => ipcRenderer.invoke('shell:open', p),
  onPrintJob: (cb) => ipcRenderer.on('print:job', (_e, job) => cb(job)),
  printReady: (id, info) => ipcRenderer.send('print:ready', id, info),
  selftestInfo: () => ipcRenderer.invoke('selftest:info'),
  selftestScreenshot: (name) => ipcRenderer.invoke('selftest:screenshot', name),
  selftestLog: (name, data) => ipcRenderer.invoke('selftest:log', name, data),
  selftestDone: () => ipcRenderer.invoke('selftest:done'),
});
