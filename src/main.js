const { app, BrowserWindow, ipcMain, dialog, screen, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { PassThrough, Readable } = require('stream');
const { pathToFileURL } = require('url');
const media = require('./media');
const updater = require('./updater');

app.setName('RoarPlay');

if (app.isPackaged) {
  media.setFfmpegPath(path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'));
}

// rp://play/<id>: what ffmpeg makes while it plays, read by the page and handed to its <video> piece by piece
protocol.registerSchemesAsPrivileged([{ scheme: 'rp', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }]);

let win;
let quitting = false;
// files to open that came before the window was ready (Finder's Open With, a double click, the command line)
let waiting = [];

function startSize() {
  const a = screen.getPrimaryDisplay().workAreaSize;
  return { width: Math.min(1280, a.width - 40), height: Math.min(820, a.height - 40) };
}

function createWindow() {
  const frame = process.platform === 'darwin'
    ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 21 } }
    : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#2b3038', symbolColor: '#eef0f3', height: 58 } };
  win = new BrowserWindow({
    ...startSize(), center: true, minWidth: 760, minHeight: 520, show: false, backgroundColor: '#1b1e23', autoHideMenuBar: true, ...frame,
    title: 'RoarPlay',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.once('did-finish-load', () => { if (waiting.length) { win.webContents.send('open-files', waiting); waiting = []; } });
  const outside = (url) => { if (/^https:\/\//i.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { outside(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); outside(url); } });
  win.on('closed', () => { win = null; });
}

// the files on a command line (Windows' Open With and a double click give them so); flags and the app itself left out
const filesIn = (argv) => argv.slice(1).filter((a) => !a.startsWith('-') && fs.existsSync(a) && ![process.execPath, app.getAppPath()].includes(path.resolve(a)));
function openFiles(list) {
  if (!list.length) return;
  if (win && !win.webContents.isLoading()) { win.webContents.send('open-files', list); if (win.isMinimized()) win.restore(); win.focus(); }
  else waiting.push(...list);
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_e, argv) => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  openFiles(filesIn(argv));
});
// a Mac gives a double-clicked file this way, also before the app is ready
app.on('open-file', (e, file) => { e.preventDefault(); openFiles([file]); });

/* As in the other Roar apps: RoarPlay can update itself only where it may replace itself, in Applications, not opened
   straight from the .dmg or from Downloads. Started from anywhere else, it offers to move itself there once per start. */
function offerApplications() {
  if (process.platform !== 'darwin' || !app.isPackaged || app.isInApplicationsFolder()) return false;
  const r = dialog.showMessageBoxSync({
    type: 'question', buttons: ['Move to Applications', 'Not now'], defaultId: 0, cancelId: 1,
    message: 'Move RoarPlay to Applications?',
    detail: 'From there RoarPlay updates itself, with nothing to download or install by hand. It opens again by itself.',
  });
  if (r !== 0) return false;
  try {
    return app.moveToApplicationsFolder({ conflictHandler: () => true });
  } catch (e) {
    dialog.showErrorBox('RoarPlay could not move itself', `${e?.message || e}\n\nDrag RoarPlay into the Applications folder yourself and open it from there.`);
    return false;
  }
}

// ---------- playing what the window cannot play: ffmpeg into rp://play/<id> ----------

const sessions = new Map(); // id -> { file, info, mode, start, track, part }
const running = new Set();  // ffmpeg processes now playing
let lastId = 0;

function stopAll() { for (const p of running) { try { p.kill('SIGKILL'); } catch {} } running.clear(); }

// ffmpeg's output as the response's body. On a Mac the picture is made with the Mac's own encoder first; if that
// cannot start (no output at all), the same again with x264. An ffmpeg that fails before any output is told to the page.
function playStream(s) {
  const out = new PassThrough({ highWaterMark: 1 << 20 });
  let proc = null;
  const run = (hw) => {
    const args = media.streamArgs(s.file, s.info, s.mode, s.start, { track: s.track, hw, part: s.part });
    const p = spawn(media.ffmpegPath(), args, { windowsHide: true });
    proc = p;
    running.add(p);
    let got = false, err = '';
    p.stdout.on('data', () => { got = true; });
    p.stdout.pipe(out, { end: false });
    p.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    p.on('error', (e) => { err = e.message; });
    p.on('close', (code) => {
      running.delete(p);
      if (out.destroyed) return;
      if (!got && hw && code !== 0) return run(false);
      if (!got && code !== 0) win?.webContents.send('stream-error', { id: s.id, error: err.trim().split('\n').pop() || `ffmpeg ${code}` });
      out.end();
    });
  };
  run(s.part === 'video' && s.mode === 'transcode' && process.platform === 'darwin');
  // the page let go (another file, a seek, closed): ffmpeg stops
  out.on('close', () => { if (proc) { try { proc.kill('SIGKILL'); } catch {} running.delete(proc); } });
  return Readable.toWeb(out);
}

function registerProtocol() {
  protocol.handle('rp', (req) => {
    const id = +new URL(req.url).pathname.replace(/\D/g, '');
    const s = sessions.get(id);
    if (!s) return new Response('gone', { status: 404 });
    sessions.delete(id);
    return new Response(playStream(s), { status: 200, headers: { 'Content-Type': s.part === 'audio' ? 'audio/mp4' : 'video/mp4', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  });
}

app.whenReady().then(() => {
  if (offerApplications()) return;
  registerProtocol();
  waiting.push(...filesIn(process.argv));
  createWindow();
  updater.start(ipcMain, () => { quitting = true; });
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { stopAll(); app.quit(); });
app.on('activate', () => { if (!win && app.isReady()) createWindow(); });

// ---------- IPC ----------

const ALL = [...media.VIDEO_EXT, ...media.AUDIO_EXT, ...Object.keys(media.RAW)];

ipcMain.handle('pick-files', async (_e, lang) => {
  const el = lang === 'el';
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: el ? 'Βίντεο και ήχος' : 'Video and sound', extensions: ALL },
      { name: el ? 'Όλα τα αρχεία' : 'All files', extensions: ['*'] },
    ],
  });
  return r.canceled ? [] : r.filePaths;
});

// what was dropped or chosen, folders opened, in name order; anything that is not video or sound is named, not dropped silently
ipcMain.handle('inspect', (_e, paths) => {
  const files = [], skipped = [];
  const walk = (p, top) => {
    let st; try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      const names = fs.readdirSync(p).filter((f) => !f.startsWith('.')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      for (const f of names) walk(path.join(p, f), false);
      return;
    }
    const kind = media.kindOf(p);
    if (kind) files.push({ file: p, name: path.basename(p), kind, size: st.size });
    else if (top) files.push({ file: p, name: path.basename(p), kind: 'unknown', size: st.size }); // ffmpeg may read it anyway
    else skipped.push(path.basename(p));
  };
  for (const p of paths) walk(p, true);
  return { files, skipped };
});

ipcMain.handle('probe', async (_e, file) => {
  const info = await media.probe(file);
  // where the first frame sits: the frames, the steps and the timecode count from there
  info.phase = info.video ? Math.max(0, (await media.firstPacket(file, info, 0)).pts) : 0;
  // what the page tells its Media Source each part is, for each way of playing it
  const mime = info.video || info.audio.length ? {
    'remux/video': info.video ? media.mimeOf(info, 'remux', 'video') : '', 'transcode/video': info.video ? media.mimeOf(info, 'transcode', 'video') : '',
    'film/audio': media.mimeOf(info, 'remux', 'audio'), 'audio/audio': media.mimeOf(info, 'audio', 'audio'),
  } : {};
  return { info, plan: media.plan(info, file), url: pathToFileURL(file).href, mime };
});

// one part ('video' or 'audio') of `file` from `start`: its address, and where its zero is in the file
ipcMain.handle('stream', async (_e, { file, info, mode, start = 0, track = 0, part = 'video' }) => {
  const id = ++lastId;
  const from = Math.max(0, info.duration ? Math.min(start, info.duration - 0.05) : start);
  const offset = part === 'video' && mode === 'remux' ? (await media.firstPacket(file, info, from)).dts : from;
  for (const k of sessions.keys()) if (k < id - 8) sessions.delete(k);
  sessions.set(id, { id, file, info, mode, start: from, track, part });
  return { id, url: `rp://play/${id}`, offset };
});
ipcMain.handle('stop', () => stopAll());

ipcMain.handle('waveform', (_e, { file, track, duration }) => media.waveform(file, track, 1600, duration));
ipcMain.handle('cover', async (_e, file) => { const b = await media.cover(file); return b ? `data:image/jpeg;base64,${b.toString('base64')}` : null; });

// the frame on screen as a PNG beside the file (on the Desktop when that folder cannot be written)
ipcMain.handle('snapshot', async (_e, { file, at, label }) => {
  const name = `${path.parse(file).name} ${label}.png`;
  let dir = path.dirname(file);
  try { fs.accessSync(dir, fs.constants.W_OK); } catch { dir = app.getPath('desktop'); }
  let out = path.join(dir, name);
  for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, `${path.parse(file).name} ${label} ${i}.png`);
  try { await media.frameAt(file, at, out); return { ok: true, out }; } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('reveal', (_e, file) => shell.showItemInFolder(file));
ipcMain.handle('platform', () => process.platform);
ipcMain.handle('version', () => app.getVersion());
ipcMain.handle('title', (_e, t) => { if (win) win.setTitle(t || 'RoarPlay'); });
