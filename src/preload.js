const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickFiles: (lang) => ipcRenderer.invoke('pick-files', lang),
  inspect: (paths) => ipcRenderer.invoke('inspect', paths),
  probe: (file) => ipcRenderer.invoke('probe', file),
  stream: (job) => ipcRenderer.invoke('stream', job),
  stop: () => ipcRenderer.invoke('stop'),
  waveform: (job) => ipcRenderer.invoke('waveform', job),
  cover: (file) => ipcRenderer.invoke('cover', file),
  snapshot: (job) => ipcRenderer.invoke('snapshot', job),
  reveal: (file) => ipcRenderer.invoke('reveal', file),
  platform: () => ipcRenderer.invoke('platform'),
  version: () => ipcRenderer.invoke('version'),
  title: (t) => ipcRenderer.invoke('title', t),
  pathForFile: (f) => webUtils.getPathForFile(f),
  onOpenFiles: (cb) => ipcRenderer.on('open-files', (_e, list) => cb(list)),
  onStreamError: (cb) => ipcRenderer.on('stream-error', (_e, d) => cb(d)),
  update: {
    state: () => ipcRenderer.invoke('rp:update-state'),
    check: () => ipcRenderer.invoke('rp:update-check'),
    install: () => ipcRenderer.invoke('rp:update-install'),
    auto: (on) => ipcRenderer.invoke('rp:update-auto', on),
    on: (cb) => ipcRenderer.on('rp:update', (_e, s) => cb(s)),
  },
});
