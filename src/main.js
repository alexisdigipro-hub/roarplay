const { app, BrowserWindow, ipcMain, dialog, screen, shell, protocol, clipboard } = require('electron');
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
  // the Blackmagic RAW reader and the SDK's libraries beside it (a Mac build only)
  media.setBrawPath(path.join(process.resourcesPath, 'bin', 'roarplay-braw'));
} else if (process.env.ROARPLAY_BRAW) media.setBrawPath(process.env.ROARPLAY_BRAW);

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
    ...startSize(), center: true, minWidth: 640, minHeight: 360, show: false, backgroundColor: '#1b1e23', autoHideMenuBar: true, ...frame,
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
const running = new Map();  // session id -> ffmpeg process now playing
let lastId = 0;

function stopAll(ids = null) {
  for (const [id, p] of running) { if (ids && !ids.includes(id)) continue; try { p.kill('SIGKILL'); p.reader?.kill('SIGKILL'); } catch {} running.delete(id); }
}

// ffmpeg's output as the response's body. On a Mac the picture is made with the Mac's own encoder first; if that
// cannot start (no output at all), the same again with x264. An ffmpeg that fails before any output is told to the page.
function playStream(s) {
  const out = new PassThrough({ highWaterMark: 1 << 20 });
  let proc = null;
  const run = (hw) => {
    const args = media.streamArgs(s.file, s.info, s.mode, s.start, { track: s.track, hw, part: s.part, maxH: s.maxH });
    const p = spawn(media.ffmpegPath(), args, { windowsHide: true });
    proc = p;
    running.set(s.id, p);
    let got = false, err = '';
    // a BRAW clip: the reader decodes, its frames or its sound go into this ffmpeg's stdin
    if (s.info.braw) {
      const src = media.brawSource(s.file, s.info, s.part, s.start, s.maxH);
      const r = spawn(process.env.ROARPLAY_BRAW || path.join(process.resourcesPath, 'bin', 'roarplay-braw'), src.cmd, { windowsHide: true });
      r.stdout.pipe(p.stdin);
      r.stdout.on('error', () => {}); p.stdin.on('error', () => {});
      r.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
      p.on('close', () => { try { r.kill('SIGKILL'); } catch {} });
      p.reader = r;
    }
    p.stdout.on('data', () => { got = true; });
    p.stdout.pipe(out, { end: false });
    p.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    p.on('error', (e) => { err = e.message; });
    p.on('close', (code) => {
      if (running.get(s.id) === p) running.delete(s.id);
      if (out.destroyed) return;
      if (!got && hw && code !== 0) return run(false);
      if (!got && code !== 0) win?.webContents.send('stream-error', { id: s.id, error: err.trim().split('\n').pop() || `ffmpeg ${code}` });
      out.end();
    });
  };
  run(s.part === 'video' && s.mode === 'transcode' && process.platform === 'darwin');
  // the page let go (another file, a seek, closed): ffmpeg stops
  out.on('close', () => { if (proc) { try { proc.kill('SIGKILL'); proc.reader?.kill('SIGKILL'); } catch {} if (running.get(s.id) === proc) running.delete(s.id); } });
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
  for (const p of paths) {
    if (media.isUrl(p)) { files.push({ file: p, name: p.replace(/^https?:\/\//, '').split('?')[0].split('/').pop() || p, kind: 'url', size: 0 }); continue; }
    // a saved list (.m3u / .m3u8): its files, in its order
    if (/\.m3u8?$/i.test(p)) { for (const f of readList(p)) walk(f, true); continue; }
    walk(p, true);
  }
  // one frame of an image sequence stands for the whole sequence; the rest of its frames are left out
  const seen = new Set();
  const out = [];
  for (const f of files) {
    const seq = f.kind === 'unknown' || f.kind === 'sequence' ? media.sequenceOf(f.file) : null;
    if (seq) { if (seen.has(seq.pattern)) continue; seen.add(seq.pattern); out.push({ ...f, file: seq.first, name: `${path.basename(seq.pattern).replace(/%0\d+d/, '#')} (${seq.count})`, kind: 'sequence' }); }
    else out.push(f);
  }
  return { files: out, skipped };
});

ipcMain.handle('probe', async (_e, file, opts = {}) => {
  const info = await media.probe(file, opts);
  try { const st = fs.statSync(file); info.file = { size: st.size, created: st.birthtimeMs || st.ctimeMs, modified: st.mtimeMs }; } catch {}
  // where the first frame sits: the frames, the steps and the timecode count from there
  if (!info.braw) info.phase = info.video ? Math.max(0, (await media.firstPacket(file, info, 0)).pts) : 0;
  // what the page tells its Media Source each part is, for each way of playing it
  const mime = info.video || info.audio.length ? {
    'remux/video': info.video ? media.mimeOf(info, 'remux', 'video') : '', 'transcode/video': info.video ? media.mimeOf(info, 'transcode', 'video') : '',
    'film/audio': media.mimeOf(info, 'remux', 'audio'), 'audio/audio': media.mimeOf(info, 'audio', 'audio'),
  } : {};
  return { info, plan: media.plan(info, file), url: media.isUrl(file) ? file : pathToFileURL(file).href, mime };
});

// one part ('video' or 'audio') of `file` from `start`: its address, and where its zero is in the file
ipcMain.handle('stream', async (_e, { file, info, mode, start = 0, track = 0, part = 'video', maxH = 1080 }) => {
  const id = ++lastId;
  const from = Math.max(0, info.duration ? Math.min(start, info.duration - 0.05) : start);
  const offset = part === 'video' && mode === 'remux' ? (await media.firstPacket(file, info, from)).dts : from;
  for (const k of sessions.keys()) if (k < id - 8) sessions.delete(k);
  sessions.set(id, { id, file, info, mode, start: from, track, part, maxH });
  return { id, url: `rp://play/${id}`, offset };
});
ipcMain.handle('stop', (_e, ids) => stopAll(Array.isArray(ids) ? ids : null));

ipcMain.handle('waveform', (_e, { file, track, duration }) => media.waveform(file, track, 1600, duration));
ipcMain.handle('cover', async (_e, file) => { const b = await media.cover(file); return b ? `data:image/jpeg;base64,${b.toString('base64')}` : null; });

// the frame on screen as a picture: beside the file, on the Desktop or in a chosen folder (Settings > Saved frames)
ipcMain.handle('snapshot', async (_e, { file, at, label, info, format = 'png', where = 'beside', folder = '' }) => {
  const ext = format === 'jpg' ? 'jpg' : 'png';
  const stem = media.isUrl(file) ? 'RoarPlay' : path.parse(file).name;
  let dir = where === 'folder' && folder ? folder : where === 'desktop' || media.isUrl(file) ? app.getPath('desktop') : path.dirname(file);
  try { fs.accessSync(dir, fs.constants.W_OK); } catch { dir = app.getPath('desktop'); }
  let out = path.join(dir, `${stem} ${label}.${ext}`);
  for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, `${stem} ${label} ${i}.${ext}`);
  try { await media.frameAt(file, at, out, info); return { ok: true, out }; } catch (e) { return { ok: false, error: e.message }; }
});

// a small frame for the bar's thumbnail
ipcMain.handle('thumb', async (_e, { file, at, info }) => { const b = await media.thumb(file, at, info); return b ? `data:image/jpeg;base64,${b.toString('base64')}` : null; });

// subtitles: the tracks inside the file and the files beside it, each as WebVTT text when asked
ipcMain.handle('sub-files', (_e, file) => media.subtitleFilesBeside(file));
ipcMain.handle('subtitles', async (_e, job) => { try { return { ok: true, vtt: await media.subtitles(job.file, job) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('pick-sub', async (_e, lang) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: lang === 'el' ? 'Υπότιτλοι' : 'Subtitles', extensions: media.SUB_EXT }] });
  return r.canceled ? null : r.filePaths[0];
});

// the queue as an M3U list, and an M3U read back
ipcMain.handle('save-list', async (_e, { files, lang }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), lang === 'el' ? 'Λίστα.m3u8' : 'List.m3u8'), filters: [{ name: 'M3U', extensions: ['m3u8', 'm3u'] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, '#EXTM3U\n' + files.map((f) => `#EXTINF:-1,${path.basename(f)}\n${f}`).join('\n') + '\n');
  return r.filePath;
});
function readList(p) {
  try {
    const dir = path.dirname(p);
    return fs.readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      .map((l) => (media.isUrl(l) || path.isAbsolute(l) ? l : path.join(dir, l)));
  } catch { return []; }
}
ipcMain.handle('pick-folder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('on-top', (_e, on) => { if (win) win.setAlwaysOnTop(!!on, 'floating'); });

// Open with RoarPlay (Alex, 31 Oct): on a Mac the helper tells the system; on Windows the system's own page opens,
// where the person picks RoarPlay (Windows lets no app do that for itself)
ipcMain.handle('file-kinds', () => ({ video: media.VIDEO_EXT, audio: media.AUDIO_EXT }));
// the helper that talks to the Mac about file kinds (helper/setdefault.swift); `mode` is '--status', '--broad' or ''
function runHelper(mode, exts) {
  const helper = path.join(process.resourcesPath, 'bin', 'setdefault');
  if (!app.isPackaged || !fs.existsSync(helper)) return Promise.resolve({ ok: false, error: 'The helper is missing (it comes with the installed app)' });
  return new Promise((resolve) => {
    require('child_process').execFile(helper, ['com.themadlions.roarplay', ...(mode ? [mode] : []), ...exts], { timeout: 120000, maxBuffer: 1 << 20 }, (e, out) => {
      if (e && !out) return resolve({ ok: false, error: e.message });
      const map = {};
      for (const l of String(out).trim().split('\n')) { const i = l.indexOf('='); if (i > 0) map[l.slice(0, i)] = l.slice(i + 1); }
      resolve({ ok: true, map });
    });
  });
}
// which app opens each kind now (a Mac only): ext -> bundle id
ipcMain.handle('default-status', async (_e, exts) => {
  if (process.platform !== 'darwin') return { ok: false };
  return runHelper('--status', exts);
});
ipcMain.handle('set-default', async (_e, { exts, broad }) => {
  if (process.platform === 'win32') { shell.openExternal('ms-settings:defaultapps?registeredAppUser=RoarPlay').catch(() => shell.openExternal('ms-settings:defaultapps')); return { ok: true, opened: true }; }
  if (process.platform !== 'darwin') return { ok: false, error: 'Only on a Mac or Windows' };
  if (broad) return runHelper('--broad', []);
  if (!Array.isArray(exts) || !exts.length) return { ok: false, error: 'Nothing ticked' };
  const r = await runHelper('', exts);
  if (!r.ok) return r;
  const vals = Object.values(r.map);
  return { ok: true, done: vals.filter((x) => x === 'ok').length, same: vals.filter((x) => x === 'same').length, of: exts.length, map: r.map, detail: Object.entries(r.map).filter(([, v]) => !['ok', 'same'].includes(v)).map(([k, v]) => `${k}: ${v}`).join(', ') };
});

ipcMain.handle('reveal', (_e, file) => shell.showItemInFolder(file));
ipcMain.handle('copy', (_e, text) => clipboard.writeText(String(text || '')));

// the window takes the picture's shape (Alex, 31 Oct): `extra` is what the window holds around the picture (the top
// row, the transport, the side, the paddings), so the picture itself keeps `ratio` while the window is resized by hand
ipcMain.handle('fit', (_e, { ratio, extra, resize }) => {
  if (!win) return;
  if (!ratio) { win.setAspectRatio(0); return; }
  win.setAspectRatio(ratio, { width: Math.round(extra.width), height: Math.round(extra.height) });
  if (!resize) return;
  // keep the width, give the picture its height; smaller only when the screen is smaller
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const [w] = win.getContentSize();
  let pw = w - extra.width, ph = Math.round(pw / ratio);
  if (ph + extra.height > area.height - 20) { ph = area.height - 20 - extra.height; pw = Math.round(ph * ratio); }
  const [minW, minH] = win.getMinimumSize();
  const cw = Math.max(minW, pw + extra.width), ch = Math.max(minH, ph + extra.height);
  const b = win.getBounds();
  win.setContentSize(cw, ch);
  // stay on the screen
  const nb = win.getBounds();
  win.setPosition(Math.max(area.x, Math.min(b.x, area.x + area.width - nb.width)), Math.max(area.y, Math.min(b.y, area.y + area.height - nb.height)));
});
// the small bezel (Alex, 31 Oct): only the picture, a thin frame, the controls when the mouse comes; the Mac's
// traffic lights hide with the top row
ipcMain.handle('compact', (_e, on) => {
  if (!win) return;
  if (process.platform === 'darwin') win.setWindowButtonVisibility(!on);
  win.setMinimumSize(on ? 240 : 640, on ? 160 : 360);
});
ipcMain.handle('platform', () => process.platform);
ipcMain.handle('version', () => app.getVersion());
ipcMain.handle('title', (_e, t) => { if (win) win.setTitle(t || 'RoarPlay'); });
