// RoarPlay's page: the queue, the player, the clock, the keys. What the window cannot play itself comes from ffmpeg
// through rp://play/<id> (main.js), and every seek outside what has arrived starts ffmpeg again from there.
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ---------- Settings, kept on this computer ----------
const DEFAULTS = { lang: 'en', autoUpdate: true, atEnd: 'next', clockMode: 'tc', volume: 1, muted: false, side: true, sideTab: 'queue' };
let S = { ...DEFAULTS };
try { S = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('settings') || '{}') }; } catch {}
const save = () => { try { localStorage.setItem('settings', JSON.stringify(S)); } catch {} };

// ---------- Words: English is the key, Greek the choice (as in the other Roar apps) ----------
const EL = {
  'Restart to update': 'Επανεκκίνηση για ενημέρωση', 'Open': 'Άνοιγμα', 'Queue and info': 'Λίστα και πληροφορίες', 'Settings': 'Ρυθμίσεις',
  'Plays <b>everything</b>.': 'Παίζει <b>τα πάντα</b>.',
  'Every video and every sound: ProRes, DNxHR, MXF, MKV, AVI, WAV, FLAC, AC3 and the rest. All on your own computer.': 'Κάθε βίντεο και κάθε ήχος: ProRes, DNxHR, MXF, MKV, AVI, WAV, FLAC, AC3 και όλα τα υπόλοιπα. Όλα στον δικό σου υπολογιστή.',
  'Choose files': 'Επιλογή αρχείων', 'or drop files and folders anywhere': 'ή ρίξε αρχεία και φακέλους οπουδήποτε', 'Drop to play': 'Άφησέ τα για να παίξουν',
  'Timecode, time or frames': 'Timecode, χρόνος ή καρέ', 'Mark in (I)': 'Σημείο In (I)', 'Mark out (O)': 'Σημείο Out (O)',
  'One frame back (Left arrow)': 'Ένα καρέ πίσω (αριστερό βέλος)', 'One frame forward (Right arrow)': 'Ένα καρέ μπροστά (δεξί βέλος)',
  'Back, faster each press (J)': 'Πίσω, πιο γρήγορα σε κάθε πάτημα (J)', 'Forward, faster each press (L)': 'Μπροστά, πιο γρήγορα σε κάθε πάτημα (L)',
  'Play or pause (Space)': 'Παίξε ή σταμάτα (Space)', 'Loop (Cmd/Ctrl+L)': 'Επανάληψη (Cmd/Ctrl+L)', 'Save this frame as PNG (Cmd/Ctrl+Shift+S)': 'Αποθήκευση του καρέ σε PNG (Cmd/Ctrl+Shift+S)',
  'Sound on or off (M)': 'Ήχος ναι ή όχι (M)', 'Volume': 'Ένταση', 'Full screen (F)': 'Πλήρης οθόνη (F)',
  'Queue': 'Λίστα', 'Info': 'Πληροφορίες', 'Drop files or folders to line them up.': 'Ρίξε αρχεία ή φακέλους για να μπουν στη σειρά.', 'Add': 'Προσθήκη', 'Clear': 'Καθαρισμός',
  'Language': 'Γλώσσα', 'The words of the app': 'Οι λέξεις της εφαρμογής', 'Playing': 'Αναπαραγωγή', 'When a file ends': 'Όταν τελειώνει ένα αρχείο',
  'Stop': 'Σταματά', 'Next': 'Επόμενο', 'Repeat': 'Ξανά', 'The clock shows': 'Το ρολόι δείχνει', 'Timecode': 'Timecode', 'Time': 'Χρόνο', 'Frames': 'Καρέ',
  'Updates': 'Ενημερώσεις', 'Check now': 'Έλεγχος τώρα', 'Update by itself': 'Ενημέρωση μόνο του',
  'Looks for a new version every two hours, brings it in the background and puts it in when RoarPlay closes.': 'Ψάχνει νέα έκδοση κάθε δύο ώρες, τη φέρνει στο παρασκήνιο και τη βάζει όταν κλείσει το RoarPlay.',
  'Keys': 'Πλήκτρα', 'Close': 'Κλείσιμο',
  'Looking for a new version…': 'Ψάχνει νέα έκδοση…', 'Bringing {v}: {p}%': 'Φέρνει την {v}: {p}%', '{v} is ready: restart to put it in.': 'Η {v} είναι έτοιμη: κάνε επανεκκίνηση για να μπει.',
  'Could not look just now ({e}). It tries again by itself.': 'Δεν μπόρεσε να ψάξει τώρα ({e}). Θα ξαναδοκιμάσει μόνο του.', 'Up to date · looked at {time}': 'Ενημερωμένο · έλεγχος στις {time}',
  'Up to date. It looks by itself.': 'Ενημερωμένο. Ψάχνει μόνο του.', 'Up to date.': 'Ενημερωμένο.',
  'Plays as it is': 'Παίζει όπως είναι', 'Sound made AAC while it plays': 'Ο ήχος γίνεται AAC την ώρα που παίζει', 'Picture made H.264 while it plays': 'Η εικόνα γίνεται H.264 την ώρα που παίζει',
  'Sound made FLAC while it plays': 'Ο ήχος γίνεται FLAC την ώρα που παίζει',
  'File': 'Αρχείο', 'Picture': 'Εικόνα', 'Sound': 'Ήχος', 'Size': 'Μέγεθος', 'Wrapper': 'Περιτύλιγμα', 'Length': 'Διάρκεια', 'Bitrate': 'Bitrate', 'Starts at': 'Ξεκινά από',
  'Codec': 'Codec', 'Frame': 'Κάδρο', 'Rate': 'Ρυθμός', 'Colour': 'Χρώμα', 'interlaced': 'πεπλεγμένο', 'Subtitles': 'Υπότιτλοι', 'Title': 'Τίτλος',
  'Sound track {n}': 'Κανάλι ήχου {n}', 'Nothing open yet.': 'Τίποτα ανοιχτό ακόμα.',
  'This file cannot be played here': 'Αυτό το αρχείο δεν παίζει εδώ', '{f} is opened by {app}.': 'Το {f} το ανοίγει το {app}.',
  'This file could not be played': 'Αυτό το αρχείο δεν έπαιξε', 'It may be damaged or not a video or sound file.': 'Μπορεί να είναι χαλασμένο ή να μην είναι αρχείο βίντεο ή ήχου.',
  '{n} left out, not video or sound: {names}': '{n} έμειναν έξω, δεν είναι βίντεο ή ήχος: {names}',
  'Saved {name}': 'Σώθηκε το {name}', 'Show': 'Δείξε', 'The frame could not be saved': 'Το καρέ δεν σώθηκε',
  'In': 'In', 'Out': 'Out', 'Loop on': 'Επανάληψη ναι', 'Loop off': 'Επανάληψη όχι',
  'Play, pause': 'Παίξε, σταμάτα', 'Back, forward, faster each press; K stops': 'Πίσω, μπροστά, πιο γρήγορα σε κάθε πάτημα· το K σταματά',
  'Hold K with J or L: one frame': 'Κράτα το K με J ή L: ένα καρέ', 'One frame back or forward': 'Ένα καρέ πίσω ή μπροστά', 'One second back or forward': 'Ένα δευτερόλεπτο πίσω ή μπροστά',
  'Start, end': 'Αρχή, τέλος', 'Mark in, mark out': 'Σημείο In, σημείο Out', 'Go to in, go to out': 'Πήγαινε στο In, στο Out', 'Clear in and out': 'Καθάρισε In και Out',
  'Play from in to out': 'Παίξε από το In ως το Out', 'Loop': 'Επανάληψη', 'Previous file, next file': 'Προηγούμενο, επόμενο αρχείο', 'Volume up, down': 'Ένταση πάνω, κάτω',
  'Sound on or off': 'Ήχος ναι ή όχι', 'Full screen': 'Πλήρης οθόνη', 'Save the frame as PNG': 'Το καρέ σε PNG', 'Open files': 'Άνοιγμα αρχείων',
};
const t = (en, vars = {}) => {
  let s = (S.lang === 'el' && EL[en]) || en;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
};
function applyLang() {
  document.documentElement.lang = S.lang;
  for (const el of $$('[data-i18n]')) { el.dataset.en ??= el.textContent; el.textContent = t(el.dataset.en); }
  for (const el of $$('[data-i18n-html]')) { el.dataset.en ??= el.innerHTML; el.innerHTML = t(el.dataset.en); }
  for (const el of $$('[data-i18n-label]')) { const k = el.dataset.i18nLabel; el.setAttribute('aria-label', t(k)); el.title = t(k); }
  drawKeys();
  if (cur) drawFacts();
  drawQueue();
  placeLenses();
}

// ---------- Formatting ----------
const fmtSize = (b) => { if (!b) return ''; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return `${b.toFixed(i > 1 ? 1 : 0)} ${u[i]}`; };
const fmtRate = (b) => (b ? (b >= 1e6 ? `${(b / 1e6).toFixed(b >= 1e7 ? 0 : 1)} Mb/s` : `${Math.round(b / 1000)} kb/s`) : '');
const pad = (n, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
function fmtClock(s) {
  s = Math.max(0, s || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? `${h}:${pad(m)}` : `${m}`) + `:${pad(sec)}`;
}
const fmtTime = (s) => { s = Math.max(0, s || 0); const ms = Math.floor((s % 1) * 1000); return `${Math.floor(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}.${pad(ms, 3)}`; };

// ---------- Timecode: SMPTE, drop frame for 29.97 and 59.94 when the file says so (01:00:00;00) ----------
const nominal = (fps) => Math.round(fps || 25);
const isDrop = (fps, base) => /;/.test(base || '') && Math.abs(fps * 1.001 - Math.round(fps * 1.001)) < 0.01 && [30, 60].includes(Math.round(fps * 1.001));
function tcToFrames(tc, fps, drop) {
  const m = /(\d+):(\d+):(\d+)[:;.](\d+)/.exec(tc || '');
  if (!m) return 0;
  const n = nominal(fps), [h, mi, s, f] = m.slice(1).map(Number);
  let frames = ((h * 60 + mi) * 60 + s) * n + f;
  if (drop) { const d = n === 60 ? 4 : 2; const mins = h * 60 + mi; frames -= d * (mins - Math.floor(mins / 10)); }
  return frames;
}
function framesToTc(frames, fps, drop) {
  const n = nominal(fps);
  frames = Math.max(0, Math.floor(frames));
  if (drop) {
    const d = n === 60 ? 4 : 2, per10 = n * 600 - d * 9, per1 = n * 60 - d;
    const tens = Math.floor(frames / per10), rem = frames % per10;
    frames += d * 9 * tens + (rem > d ? d * Math.floor((rem - d) / per1) : 0);
  }
  const f = frames % n, s = Math.floor(frames / n) % 60, m = Math.floor(frames / (n * 60)) % 60, h = Math.floor(frames / (n * 3600)) % 24;
  return `${pad(h)}:${pad(m)}:${pad(s)}${drop ? ';' : ':'}${pad(f)}`;
}

// ---------- The queue ----------
let queue = []; // { file, name, kind, size, info?, plan?, bad? }
let cur = null; // { item, info, plan, mode, track }
let platform = '';
const ICON = {
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-2.5v9L17 14"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
  raw: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>',
  unknown: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
};
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function drawQueue() {
  const ol = $('#queue');
  ol.innerHTML = queue.map((q, i) => {
    const d = q.info?.duration ? fmtClock(q.info.duration) : '';
    const v = q.info?.video;
    const sub = q.bad ? t('This file cannot be played here') : [d, v ? `${v.width}×${v.height}` : q.info?.audio?.[0] ? q.info.audio[0].codec.toUpperCase() : '', fmtSize(q.size)].filter(Boolean).join(' · ');
    return `<li data-i="${i}" class="${cur?.item === q ? 'on' : ''} ${q.bad ? 'bad' : ''}"><span class="k">${ICON[q.kind] || ICON.unknown}</span>
      <span class="n"><b title="${esc(q.file)}">${esc(q.name)}</b><small>${esc(sub)}</small></span><button class="ib x" data-x="${i}" aria-label="Remove">${X}</button></li>`;
  }).join('');
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// each file's facts, two at a time, so the queue shows lengths and sizes
let probing = 0;
function probeQueue() {
  while (probing < 2) {
    const q = queue.find((x) => !x.info && !x.probing);
    if (!q) return;
    q.probing = true; probing++;
    window.api.probe(q.file).then(({ info, plan, url, mime }) => { Object.assign(q, { info, plan, url, mime, bad: plan.mode === 'none' }); })
      .finally(() => { probing--; drawQueue(); probeQueue(); });
  }
}

async function add(paths, playFirst = true) {
  if (!paths?.length) return;
  const { files, skipped } = await window.api.inspect(paths);
  if (skipped.length) toast(esc(t('{n} left out, not video or sound: {names}', { n: skipped.length, names: skipped.slice(0, 4).join(', ') + (skipped.length > 4 ? '…' : '') })));
  if (!files.length) return;
  const start = queue.length;
  queue.push(...files);
  drawQueue();
  probeQueue();
  if (playFirst) load(queue[start], { autoplay: true });
}

// ---------- The player ----------
// A file the window plays itself is its <video>'s src. Anything else comes in pieces through a Media Source: the
// picture and the sound each from their own ffmpeg (main.js), each placed at its own time in the file, so the clock is
// always the file's own and a jump inside what has come is instant. A jump outside starts that part's ffmpeg there.
const v = $('#v');
let shuttle = 0;        // J/K/L: −8…8, 0 stopped
let rev = null;         // the reverse loop
let inPt = null, outPt = null, looping = false;
let shownTime = 0;      // the frame on screen (requestVideoFrameCallback), else the clock
let loadToken = 0;
let mse = null;         // { ms, parts: { video|audio: { sb, mime, token, from, pos, busy, reader } } }
const AHEAD = 24;       // seconds made ahead of the playhead, no more

const streaming = () => !!cur && cur.mode !== 'native';
const duration = () => (cur ? (cur.info?.duration || (isFinite(v.duration) ? v.duration : 0)) : 0);
const pos = () => (cur ? v.currentTime : 0);
const fps = () => cur?.info?.video?.fps || 25;
const hasPicture = () => !!cur?.info?.video;
// frames count from the file's first frame (`phase`, where it sits in the file's seconds), whole frames apart.
// A picture's time is a frame's own time (the one on screen); sound has no frames, so its time counts down to them.
const phase = () => cur?.info?.phase || 0;
const frameOf = (tm) => (hasPicture() ? Math.round((tm - phase()) * fps()) : Math.floor(tm * fps() + 1e-3));
const timeOf = (n) => phase() + n / fps();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setBody(cls, on) { document.body.classList.toggle(cls, !!on); }

async function load(item, { autoplay = true, at = 0, track = 0, mode = null } = {}) {
  if (!item) return;
  const token = ++loadToken;
  stopReverse(); shuttle = 0; showShuttle();
  closeMse();
  if (!item.info) {
    showSpin(true);
    const r = await window.api.probe(item.file);
    Object.assign(item, { info: r.info, plan: r.plan, url: r.url, mime: r.mime, bad: r.plan.mode === 'none' });
    if (token !== loadToken) return;
  }
  const plan = item.plan;
  cur = { item, info: item.info, plan, mode: mode || plan.mode, track };
  inPt = outPt = null; shownTime = at;
  setBody('empty', false);
  $('#screen').classList.remove('blank');
  $('#home').hidden = true;
  $('#msg').hidden = true;
  window.api.title(`${item.name} · RoarPlay`);
  drawQueue(); drawFacts(); drawRange();
  if (plan.mode === 'none') return cannotPlay(plan);
  const sound = !hasPicture();
  setBody('audio', sound);
  $('#sound').hidden = !sound;
  if (sound) showSound();
  wave = null; drawWave();
  if (sound) window.api.waveform({ file: item.file, track, duration: item.info.duration }).then((p) => { if (token === loadToken) { wave = p; drawWave(); } });
  await startAt(at, autoplay);
}

// the parts a stream is made of, and what the window is told each one is
function partsOf(c) {
  if (c.mode === 'audio') return { audio: c.item.mime['audio/audio'] };
  const p = { video: c.item.mime[`${c.mode}/video`] };
  if (c.info.audio.length) p.audio = c.item.mime['film/audio'];
  return p;
}

// play the current file from `at` seconds
async function startAt(at, play) {
  const token = loadToken;
  showSpin(true);
  if (cur.mode === 'native') {
    closeMse();
    if (v.src !== cur.item.url) v.src = cur.item.url;
    const go = () => { if (token !== loadToken) return; if (at > 0) v.currentTime = at; if (play) v.play().catch(() => {}); };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
    return;
  }
  // a copied picture the window cannot take in pieces (HEVC where the system has no decoder for it) is made again
  if (cur.mode === 'remux' && !MediaSource.isTypeSupported(cur.item.mime['remux/video'])) { cur.mode = 'transcode'; drawFacts(); }
  closeMse();
  const ms = new MediaSource();
  const url = URL.createObjectURL(ms);
  v.src = url;
  await new Promise((r) => ms.addEventListener('sourceopen', r, { once: true }));
  URL.revokeObjectURL(url);
  if (token !== loadToken) return;
  ms.duration = duration() || 24 * 3600;
  const parts = {};
  try {
    for (const [name, mime] of Object.entries(partsOf(cur))) parts[name] = { name, mime, sb: ms.addSourceBuffer(mime), token: 0, from: 0, pos: 0, busy: false, reader: null };
  } catch (e) { return fail(e.message); }
  for (const P of Object.values(parts)) P.sb.addEventListener('error', () => fail('The window could not take the stream'));
  mse = { ms, parts, token };
  v.currentTime = at;
  for (const P of Object.values(parts)) feed(P, at);
  if (play) v.play().catch(() => {});
}

function closeMse() {
  if (!mse) return;
  for (const P of Object.values(mse.parts)) { P.token++; try { P.reader?.cancel(); } catch {} }
  mse = null;
  window.api.stop();
}

// the buffered range of `sb` that holds `t`
function rangeAt(sb, t, slack = 0.05) {
  try {
    for (let i = 0; i < sb.buffered.length; i++) if (t >= sb.buffered.start(i) - slack && t <= sb.buffered.end(i) + slack) return [sb.buffered.start(i), sb.buffered.end(i)];
  } catch {}
  return null;
}
const idle = (sb) => (sb.updating ? new Promise((r) => sb.addEventListener('updateend', r, { once: true })) : Promise.resolve());

// one part's ffmpeg from `from` seconds, its pieces appended as they come, never more than AHEAD seconds ahead
async function feed(P, from) {
  const m = mse;
  const my = ++P.token;
  const stale = () => my !== P.token || mse !== m;
  try { P.reader?.cancel(); } catch {}
  P.reader = null; P.busy = true; P.from = from; P.pos = from;
  await idle(P.sb);
  if (stale()) return;
  try { if (m.ms.readyState === 'open') P.sb.abort(); } catch {}
  const r = await window.api.stream({ file: cur.item.file, info: cur.info, mode: cur.mode, start: from, track: cur.track, part: P.name });
  if (stale()) return;
  P.id = r.id;
  try { P.sb.timestampOffset = r.offset; } catch {}
  let reader;
  try { reader = (await fetch(r.url)).body.getReader(); } catch (e) { return stale() || fail(e.message); }
  if (stale()) { reader.cancel(); return; }
  P.reader = reader;
  P.atEnd = false;
  try {
    for (;;) {
      // made far enough ahead, or the playhead went back before this piece: wait
      while (!stale() && (P.pos - v.currentTime > AHEAD || v.currentTime < P.from - 1)) await sleep(200);
      if (stale()) { reader.cancel(); return; }
      const { done, value } = await reader.read().catch(() => ({ done: true }));
      if (stale()) { reader.cancel(); return; }
      if (done) { P.atEnd = !duration() || P.pos >= duration() - 1; break; }
      await append(P, value);
      if (stale()) { reader.cancel(); return; }
      const rg = rangeAt(P.sb, P.pos, 0.6);
      if (!rg) continue;
      const was = P.pos;
      P.pos = Math.max(P.pos, rg[1]);
      // it ran into what had come before (a jump back, then on): that is there already, so this ffmpeg stops
      if (P.pos - was > 3) { reader.cancel(); P.atEnd = !!duration() && P.pos >= duration() - 0.3; break; }
    }
  } catch (e) {
    if (!stale()) console.warn('feed', P.name, e);
  }
  P.busy = false; P.reader = null;
  endIfAll(m);
}
// the end of the file: when every part has come to it, the window is told, so it ends there
function endIfAll(m) {
  if (!Object.values(m.parts).every((x) => !x.busy && x.atEnd)) return;
  try { if (m.ms.readyState === 'open' && !Object.values(m.parts).some((x) => x.sb.updating)) m.ms.endOfStream(); } catch {}
}

async function append(P, chunk) {
  for (let tries = 0; tries < 4; tries++) {
    await idle(P.sb);
    try { P.sb.appendBuffer(chunk); await idle(P.sb); return; } catch (e) {
      if (e.name !== 'QuotaExceededError') throw e;
      // full: let go of what is far behind and far ahead of the playhead
      const ct = v.currentTime;
      try { if (ct - 15 > 0) { P.sb.remove(0, ct - 15); await idle(P.sb); } P.sb.remove(ct + AHEAD + 10, Infinity); await idle(P.sb); } catch {}
      await sleep(300);
    }
  }
}

// keeps every part coming where the playhead is: a part with nothing there starts there, a part about to run out goes on
function keepFed() {
  if (!mse || !cur) return;
  const ct = v.currentTime, d = duration();
  for (const P of Object.values(mse.parts)) {
    const rg = rangeAt(P.sb, ct);
    const coming = P.busy && ct >= P.from - 0.25 && ct <= P.pos + 4;
    if (!rg) { if (!coming) feed(P, ct); continue; }
    if ((!d || rg[1] < d - 0.3) && rg[1] - ct < 8 && !(P.busy && P.pos >= rg[1] - 0.6 && P.from <= rg[1] + 0.6)) feed(P, rg[1]);
  }
}
setInterval(keepFed, 250);

// where the window has the file, in file seconds
function arrived(t) {
  for (let i = 0; i < v.buffered.length; i++) if (t >= v.buffered.start(i) - 0.0005 && t <= v.buffered.end(i) - 0.04) return true;
  return false;
}

// go to `t` seconds of the file. A stream jumps inside what has come; outside it, each part starts again there
// (`back` seconds earlier when going backwards, so the next steps back are there already)
function seek(t, { back = 0, play = null } = {}) {
  if (!cur || cur.plan.mode === 'none') return;
  const d = duration();
  t = Math.max(0, d ? Math.min(t, Math.max(0, d - 1 / fps() / 2)) : t);
  shownTime = t;
  v.currentTime = t;
  if (mse) for (const P of Object.values(mse.parts)) if (!rangeAt(P.sb, t, 0)) feed(P, Math.max(0, t - back));
  if (play) v.play().catch(() => {});
  paint();
}

function fail(detail) {
  if (!cur) return;
  // what the window cannot take as it is, ffmpeg makes again
  if (cur.mode === 'native' || cur.mode === 'remux') {
    const at = pos();
    cur.mode = cur.info.video ? 'transcode' : 'audio';
    drawFacts();
    startAt(at, true);
    return;
  }
  cannotPlay({ why: 'failed', detail });
}

v.addEventListener('loadedmetadata', () => paint());
v.addEventListener('canplay', () => showSpin(false));
v.addEventListener('waiting', () => { showSpin(true); keepFed(); });
v.addEventListener('playing', () => { showSpin(false); setBody('playing', true); });
v.addEventListener('pause', () => { if (!rev) setBody('playing', false); });
v.addEventListener('seeked', () => { showSpin(false); paint(); });
v.addEventListener('ended', () => {
  setBody('playing', false); shuttle = 0; showShuttle();
  if (looping) return seek(inPt ?? 0, { play: true });
  if (S.atEnd === 'repeat') return seek(0, { play: true });
  if (S.atEnd === 'next') next(1, true);
});
v.addEventListener('error', () => { if (cur && v.getAttribute('src')) fail(v.error?.message); });
window.api.onStreamError(({ id, error }) => {
  if (!mse || !Object.values(mse.parts).some((P) => P.id === id)) return;
  if (cur.mode === 'remux') return fail(error);
  cannotPlay({ why: 'failed', detail: error });
});

function cannotPlay(plan) {
  showSpin(false);
  setBody('playing', false);
  closeMse();
  $('#sound').hidden = true;
  $('#msg').hidden = false;
  v.removeAttribute('src'); v.load();
  $('#msgTitle').textContent = plan.why === 'raw' ? t('This file cannot be played here') : t('This file could not be played');
  $('#msgText').textContent = plan.why === 'raw' ? t('{f} is opened by {app}.', { f: plan.format, app: plan.app }) : (plan.detail || t('It may be damaged or not a video or sound file.'));
  cur.item.bad = true;
  drawQueue();
}

async function showSound() {
  const i = cur.info;
  $('#soundTitle').textContent = i.title || cur.item.name;
  $('#soundBy').textContent = [i.artist, i.album].filter(Boolean).join(' · ') || [i.audio[0]?.codec?.toUpperCase(), i.audio[0]?.sampleRate ? `${i.audio[0].sampleRate / 1000} kHz` : '', i.audio[0]?.channels].filter(Boolean).join(' · ');
  const art = $('#art');
  art.querySelector('img')?.remove();
  art.querySelector('svg').style.display = '';
  if (i.cover) {
    const item = cur.item;
    const src = await window.api.cover(item.file);
    if (src && cur?.item === item) { const img = new Image(); img.src = src; art.querySelector('svg').style.display = 'none'; art.append(img); }
  }
}

// ---------- J / K / L and the reverse ----------
function setShuttle(n) {
  shuttle = n;
  showShuttle();
  if (n === 0) { stopReverse(); v.pause(); v.playbackRate = 1; return; }
  if (n > 0) { stopReverse(); v.playbackRate = n; v.play().catch(() => {}); return; }
  v.pause();
  startReverse();
}
function startReverse() {
  if (rev) return;
  setBody('playing', true);
  let last = performance.now();
  let target = pos();
  const tick = (now) => {
    if (!rev) return;
    const dt = (now - last) / 1000; last = now;
    if (!v.seeking) {
      target = Math.max(0, target - dt * Math.abs(shuttle));
      seek(target, { back: 6 });
      if (target <= 0) { setShuttle(0); return; }
    }
    rev = requestAnimationFrame(tick);
  };
  rev = requestAnimationFrame(tick);
}
function stopReverse() { if (rev) cancelAnimationFrame(rev); rev = null; if (v.paused) setBody('playing', false); }
function showShuttle() {
  const el = $('#shuttle');
  el.hidden = !shuttle || shuttle === 1;
  el.textContent = shuttle < 0 ? `◀◀ ${-shuttle}×` : `${shuttle}× ▶▶`;
}
const L = () => setShuttle(shuttle <= 0 ? 1 : Math.min(8, shuttle * 2));
const J = () => setShuttle(shuttle >= 0 ? -1 : Math.max(-8, shuttle * 2));
const K = () => setShuttle(0);
function togglePlay() {
  if (!cur || cur.plan.mode === 'none') return;
  if (shuttle !== 0 || !v.paused) return K();
  if (duration() && pos() >= duration() - 0.05) seek(inPt ?? 0);
  setShuttle(1);
}

// one frame: from the frame on screen, to the next frame's own time
function step(n) {
  if (!cur || cur.plan.mode === 'none') return;
  if (shuttle) setShuttle(0); else v.pause();
  if (!hasPicture()) return seek(pos() + n * 0.1);
  seek(timeOf(frameOf(shownTime) + n) + 0.0005);
}

// ---------- In, out, loop ----------
function mark(which) {
  if (!cur) return;
  const p = timeOf(frameOf(shownTime));
  if (which === 'in') { inPt = p; if (outPt != null && outPt <= inPt) outPt = null; }
  else { outPt = p; if (inPt != null && inPt >= outPt) inPt = null; }
  drawRange();
}
function drawRange() {
  const d = duration();
  const r = $('#range');
  r.hidden = !d || (inPt == null && outPt == null);
  if (r.hidden) return;
  const a = (inPt ?? 0) / d, b = (outPt ?? d) / d;
  r.style.left = `${a * 100}%`; r.style.width = `${(b - a) * 100}%`;
}
function setLoop(on) { looping = on; $('#loop').classList.toggle('on', on); }
function playRange() { if (!cur) return; shuttle = 1; showShuttle(); stopReverse(); v.playbackRate = 1; seek(inPt ?? 0, { play: true }); }

// ---------- The clock and the bar ----------
const CLOCK_MODES = ['tc', 'time', 'frames'];
function clockText(tm) {
  const f = fps();
  if (S.clockMode === 'time') return fmtTime(tm);
  if (S.clockMode === 'frames') return String(Math.max(0, frameOf(tm)));
  const base = cur?.info?.timecode || '00:00:00:00';
  const drop = isDrop(f, base);
  return framesToTc(tcToFrames(base, f, drop) + Math.max(0, frameOf(tm)), f, drop);
}
function paint(force) {
  const d = duration();
  const tm = force ?? (hasPicture() || (v.paused && !rev) ? shownTime : pos());
  $('#tc').textContent = cur ? clockText(tm) : clockText(0);
  const pct = d ? Math.min(1, tm / d) : 0;
  $('#done').style.width = `${pct * 100}%`;
  $('#head').style.left = `${pct * 100}%`;
  // what has arrived, from the playhead on
  if (cur && d && v.buffered.length) {
    let end = 0;
    for (let i = 0; i < v.buffered.length; i++) end = Math.max(end, v.buffered.end(i));
    $('#buf').style.width = `${Math.min(1, end / d) * 100}%`;
  } else $('#buf').style.width = '0';
  // the loop and the out point
  if (cur && !v.paused && outPt != null && tm >= outPt) {
    if (looping) seek(inPt ?? 0); else { v.pause(); seek(outPt); }
  }
}
function lenText() {
  if (!cur) return '';
  const d = duration();
  return `/ ${S.clockMode === 'tc' ? clockText(d) : S.clockMode === 'frames' ? Math.round(d * fps()) : fmtTime(d)}`;
}
function frameLoop() {
  if (cur && !v.paused && !hasPicture()) shownTime = pos();
  paint();
  $('#len').textContent = lenText();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
// the exact frame on screen, so a step goes from there
function watchFrames() {
  v.requestVideoFrameCallback((_n, m) => { if (cur) shownTime = m.mediaTime; watchFrames(); });
}
watchFrames();
v.addEventListener('timeupdate', () => { if (!hasPicture() && cur) shownTime = pos(); });

const bar = $('#bar');
const barTime = (e) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration(); };
let scrubbing = false;
bar.addEventListener('pointerdown', (e) => { if (!cur) return; scrubbing = true; bar.setPointerCapture(e.pointerId); if (shuttle < 0) setShuttle(0); seek(barTime(e)); });
bar.addEventListener('pointermove', (e) => {
  if (!cur) return;
  const tip = $('#tip'); const tm = barTime(e);
  tip.hidden = false; tip.textContent = clockText(tm);
  tip.style.left = `${(tm / (duration() || 1)) * 100}%`;
  if (scrubbing) seek(tm);
});
bar.addEventListener('pointerup', () => { scrubbing = false; });
bar.addEventListener('pointerleave', () => { $('#tip').hidden = true; });
$('#tc').addEventListener('click', () => { S.clockMode = CLOCK_MODES[(CLOCK_MODES.indexOf(S.clockMode) + 1) % 3]; save(); placeLenses(); });

// the sound's shape behind the bar
let wave = null;
function drawWave() {
  const c = $('#wave');
  const r = c.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (!wave?.length) return;
  const mid = c.height / 2, w = c.width;
  const played = duration() ? pos() / duration() : 0;
  for (let x = 0; x < w; x += 2 * dpr) {
    const p = wave[Math.min(wave.length - 1, Math.floor((x / w) * wave.length))];
    const h = Math.max(1, Math.sqrt(p) * mid * 0.95);
    g.fillStyle = x / w <= played ? '#ff3b30' : 'rgba(255,255,255,.28)';
    g.fillRect(x, mid - h, dpr * 1.2, h * 2);
  }
}
setInterval(() => { if (document.body.classList.contains('audio')) drawWave(); }, 120);
window.addEventListener('resize', drawWave);

// ---------- Volume, full screen ----------
function setVolume(x) {
  S.volume = Math.max(0, Math.min(1, x)); v.volume = S.volume; $('#volume').value = S.volume;
  $('#volume').style.setProperty('--p', `${S.volume * 100}%`); save();
}
function setMuted(m) { S.muted = m; v.muted = m; setBody('muted', m); save(); }
$('#volume').addEventListener('input', (e) => { setVolume(+e.target.value); if (S.muted) setMuted(false); });
$('#mute').addEventListener('click', () => setMuted(!S.muted));
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else $('#stage').requestFullscreen().catch(() => {}); }
let idleTimer = 0;
document.addEventListener('mousemove', () => {
  $('#stage').classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (document.fullscreenElement && !v.paused) $('#stage').classList.add('idle'); }, 2500);
});

// ---------- The snapshot: the frame on screen, at full size, as PNG beside the file ----------
async function snapshot() {
  if (!cur || !hasPicture()) return;
  const label = clockText(shownTime).replace(/[:;]/g, '-');
  const r = await window.api.snapshot({ file: cur.item.file, at: shownTime - 0.25 / fps(), label });
  if (!r.ok) return toast(esc(t('The frame could not be saved')) + (r.error ? `: ${esc(r.error)}` : ''));
  const name = r.out.split(/[\\/]/).pop();
  toast(`${esc(t('Saved {name}', { name }))} · <a id="showSnap">${esc(t('Show'))}</a>`);
  $('#showSnap')?.addEventListener('click', () => window.api.reveal(r.out));
}

// ---------- The facts ----------
function drawFacts() {
  const box = $('#facts');
  if (!cur) { box.innerHTML = `<div class="empty">${esc(t('Nothing open yet.'))}</div>`; return; }
  const i = cur.info, q = cur.item, vi = i.video;
  const HOW = { native: 'Plays as it is', remux: 'Sound made AAC while it plays', transcode: 'Picture made H.264 while it plays', audio: 'Sound made FLAC while it plays' };
  const f = (k, val) => (val ? `<div class="f"><span>${esc(t(k))}</span><b>${esc(val)}</b></div>` : '');
  const dir = q.file.slice(0, q.file.length - q.name.length - 1);
  let html = `<div class="fname">${esc(q.name)}</div><div class="where">${esc(dir)}</div>`;
  if (cur.plan.mode !== 'none') html += `<span class="chip how ${cur.mode}"><i></i>${esc(t(HOW[cur.mode]))}</span>`;
  html += `<div class="box"><h4>${esc(t('File'))}</h4>${f('Title', i.title)}${f('Size', fmtSize(q.size))}${f('Wrapper', i.container.split(',')[0].toUpperCase())}${f('Length', i.duration ? fmtTime(i.duration) : '')}${f('Bitrate', fmtRate(i.bitrate))}${f('Timecode', i.timecode)}${f('Subtitles', i.subtitles ? String(i.subtitles) : '')}</div>`;
  if (vi) {
    html += `<div class="box"><h4>${esc(t('Picture'))}</h4>${f('Codec', [vi.codec.toUpperCase(), vi.profile].filter(Boolean).join(' '))}${f('Frame', vi.width ? `${vi.width} × ${vi.height}` : '')}
      ${f('Rate', vi.fps ? `${+vi.fps.toFixed(3)} fps` : '')}${f('Colour', [vi.pixfmt, vi.interlaced ? t('interlaced') : ''].filter(Boolean).join(' · '))}${f('Bitrate', fmtRate(vi.bitrate))}</div>`;
  }
  if (i.audio.length) {
    const a = i.audio[cur.track] || i.audio[0];
    html += `<div class="box"><h4>${esc(t('Sound'))}</h4>${f('Codec', [a.codec.toUpperCase(), a.profile].filter(Boolean).join(' '))}${f('Rate', [a.sampleRate ? `${a.sampleRate / 1000} kHz` : '', a.bits ? `${a.bits}-bit` : ''].filter(Boolean).join(' · '))}
      ${f('Sound', a.channels)}${f('Bitrate', fmtRate(a.bitrate))}`;
    if (i.audio.length > 1) {
      html += `<div class="tracks">${i.audio.map((x, n) => `<button data-track="${n}" class="${n === cur.track ? 'on' : ''}">${esc(t('Sound track {n}', { n: n + 1 }))} · ${esc([x.lang.toUpperCase(), x.codec.toUpperCase(), x.channels].filter(Boolean).join(' · '))}</button>`).join('')}</div>`;
    }
    html += '</div>';
  }
  box.innerHTML = html;
}
$('#facts').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-track]');
  if (!b || !cur) return;
  const track = +b.dataset.track;
  if (track === cur.track) return;
  // another sound track: the window plays only the first, so the file comes through ffmpeg from here
  const at = pos(), playing = !v.paused;
  cur.track = track;
  if (cur.mode === 'native') cur.mode = cur.info.video ? (cur.plan.mode === 'native' && ['h264', 'hevc', 'vp9', 'av1'].includes(cur.info.video.codec) ? 'remux' : 'transcode') : 'audio';
  drawFacts();
  startAt(at, playing);
});

// ---------- Next and previous ----------
function next(n, auto = false) {
  if (!cur) return;
  let i = queue.indexOf(cur.item) + n;
  while (queue[i]?.bad && auto) i += n;
  if (queue[i]) load(queue[i], { autoplay: true });
}

// ---------- Small things ----------
function showSpin(on) { $('#spin').hidden = !on; }
let toastTimer = 0;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}
function placeLenses() {
  for (const seg of $$('.seg')) {
    const id = seg.id;
    const val = id === 'sideTab' ? S.sideTab : S[id];
    let lens = seg.querySelector('.lens');
    if (!lens) { lens = document.createElement('span'); lens.className = 'lens'; seg.prepend(lens); }
    let on = null;
    for (const b of seg.querySelectorAll('button')) { b.classList.toggle('on', b.dataset.v === val); if (b.dataset.v === val) on = b; }
    if (on && on.offsetWidth) { lens.style.left = `${on.offsetLeft}px`; lens.style.width = `${on.offsetWidth}px`; lens.hidden = false; } else lens.hidden = !on;
  }
}
for (const seg of $$('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    if (seg.id === 'sideTab') { S.sideTab = b.dataset.v; showSideTab(); }
    else { S[seg.id] = b.dataset.v; if (seg.id === 'lang') { applyLang(); showUpdate(); } }
    save(); placeLenses();
  });
}
function showSideTab() { $('#queueBox').hidden = S.sideTab !== 'queue'; $('#infoBox').hidden = S.sideTab !== 'info'; }
function showSide() { setBody('no-side', !S.side); $('#toggleSide').classList.toggle('on', S.side); setTimeout(() => { drawWave(); placeLenses(); }, 0); }

const KEYS = [
  ['Space', 'Play, pause'], ['J  K  L', 'Back, forward, faster each press; K stops'], ['K + J / L', 'Hold K with J or L: one frame'],
  ['← →', 'One frame back or forward'], ['Shift ← →', 'One second back or forward'], ['Home  End', 'Start, end'],
  ['I  O', 'Mark in, mark out'], ['Shift I  O', 'Go to in, go to out'], ['Alt X', 'Clear in and out'], ['/', 'Play from in to out'],
  ['⌘/Ctrl L', 'Loop'], ['⌘/Ctrl ← →', 'Previous file, next file'], ['↑ ↓', 'Volume up, down'], ['M', 'Sound on or off'],
  ['F', 'Full screen'], ['⌘/Ctrl Shift S', 'Save the frame as PNG'], ['⌘/Ctrl O', 'Open files'],
];
function drawKeys() { $('#keysList').innerHTML = KEYS.map(([k, d]) => `<kbd>${esc(k)}</kbd><span>${esc(t(d))}</span>`).join(''); }

// ---------- Keys ----------
let kDown = false;
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === ',') { e.preventDefault(); return setOpen($('#settings').hidden); }
  if (!$('#settings').hidden) { if (e.key === 'Escape') setOpen(false); return; }
  if (e.target.matches('input, select, textarea')) return;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); return openPick(); }
  if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); return snapshot(); }
  if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); return setLoop(!looping); }
  if (mod && e.key === 'ArrowRight') { e.preventDefault(); return next(1); }
  if (mod && e.key === 'ArrowLeft') { e.preventDefault(); return next(-1); }
  if (mod) return;
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); return togglePlay(); }
  if (k === 'k') { kDown = true; return K(); }
  if (k === 'j') return kDown ? step(-1) : J();
  if (k === 'l') return kDown ? step(1) : L();
  if (e.key === 'ArrowLeft') { e.preventDefault(); return e.shiftKey ? (v.pause(), seek(pos() - 1)) : step(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); return e.shiftKey ? (v.pause(), seek(pos() + 1)) : step(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); return setVolume(S.volume + 0.05); }
  if (e.key === 'ArrowDown') { e.preventDefault(); return setVolume(S.volume - 0.05); }
  if (e.key === 'Home') return seek(0);
  if (e.key === 'End') return seek(duration());
  if (k === 'i') return e.shiftKey ? inPt != null && seek(inPt) : mark('in');
  if (k === 'o') return e.shiftKey ? outPt != null && seek(outPt) : mark('out');
  if (k === 'x' && e.altKey) { inPt = outPt = null; return drawRange(); }
  if (e.key === '/') return playRange();
  if (k === 'm') return setMuted(!S.muted);
  if (k === 'f') return toggleFull();
});
document.addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'k') kDown = false; });

// ---------- Buttons ----------
const openPick = async () => add(await window.api.pickFiles(S.lang));
$('#open').addEventListener('click', openPick);
$('#browse').addEventListener('click', openPick);
$('#addMore').addEventListener('click', async () => add(await window.api.pickFiles(S.lang), !cur));
$('#clearQueue').addEventListener('click', () => { queue = queue.filter((q) => q === cur?.item); drawQueue(); });
$('#play').addEventListener('click', togglePlay);
$('#rew').addEventListener('click', J);
$('#fwd').addEventListener('click', L);
$('#stepBack').addEventListener('click', () => step(-1));
$('#stepFwd').addEventListener('click', () => step(1));
$('#markIn').addEventListener('click', () => mark('in'));
$('#markOut').addEventListener('click', () => mark('out'));
$('#loop').addEventListener('click', () => setLoop(!looping));
$('#snap').addEventListener('click', snapshot);
$('#full').addEventListener('click', toggleFull);
$('#toggleSide').addEventListener('click', () => { S.side = !S.side; save(); showSide(); });
$('#screen').addEventListener('click', (e) => { if (cur && e.target === v) togglePlay(); });
$('#screen').addEventListener('dblclick', (e) => { if (cur && e.target === v) toggleFull(); });
$('#queue').addEventListener('click', (e) => {
  const x = e.target.closest('[data-x]');
  if (x) {
    const q = queue[+x.dataset.x];
    queue.splice(+x.dataset.x, 1);
    if (q === cur?.item) { v.pause(); window.api.stop(); }
    return drawQueue();
  }
  const li = e.target.closest('li[data-i]');
  if (li) load(queue[+li.dataset.i], { autoplay: true });
});

// ---------- Drop anywhere ----------
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; setBody('dragging', true); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; setBody('dragging', false); } });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; setBody('dragging', false);
  const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean);
  add(paths);
});
window.api.onOpenFiles((list) => add(list));

// ---------- Updates and the Settings window (as in RoarMorph) ----------
let upd = { status: 'idle' };
let appVersion = '';
const clock = (ms) => new Date(ms).toLocaleTimeString(S.lang === 'el' ? 'el-GR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
function showUpdate(u) {
  upd = u || upd;
  $('#update').hidden = upd.status !== 'ready';
  $('#updRestart').hidden = upd.status !== 'ready';
  $('#updCheck').hidden = upd.status === 'ready';
  $('#updCheck').disabled = upd.status === 'checking' || upd.status === 'downloading';
  $('#updName').textContent = appVersion ? `RoarPlay ${appVersion}` : 'RoarPlay';
  $('#updStatus').textContent =
    upd.status === 'checking' ? t('Looking for a new version…')
    : upd.status === 'downloading' ? t('Bringing {v}: {p}%', { v: upd.version, p: upd.progress || 0 })
    : upd.status === 'ready' ? t('{v} is ready: restart to put it in.', { v: upd.version })
    : upd.status === 'error' ? t('Could not look just now ({e}). It tries again by itself.', { e: upd.error || '' })
    : upd.checkedAt ? t('Up to date · looked at {time}', { time: clock(upd.checkedAt) })
    : S.autoUpdate ? t('Up to date. It looks by itself.') : t('Up to date.');
}
window.api.version().then((x) => { appVersion = x || ''; $('#ver').textContent = x ? `v${x}` : ''; showUpdate(); }).catch(() => {});
window.api.update.state().then(showUpdate);
window.api.update.on(showUpdate);
window.api.update.auto(S.autoUpdate);
$('#autoUpdate').checked = S.autoUpdate;
$('#autoUpdate').addEventListener('input', (e) => { S.autoUpdate = e.target.checked; save(); window.api.update.auto(S.autoUpdate); showUpdate(); });
$('#update').addEventListener('click', () => window.api.update.install());
$('#updRestart').addEventListener('click', () => window.api.update.install());
$('#updCheck').addEventListener('click', () => { showUpdate({ ...upd, status: 'checking' }); window.api.update.check().then(showUpdate); });
const setOpen = (on) => { $('#settings').hidden = !on; if (on) { showUpdate(); placeLenses(); $('#closeSettings').focus(); } };
$('#openSettings').addEventListener('click', () => setOpen(true));
$('#closeSettings').addEventListener('click', () => setOpen(false));
$('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') setOpen(false); });

// ---------- Start ----------
window.api.platform().then((p) => { platform = p; document.body.classList.add(p); });
setBody('empty', true);
$('#screen').classList.add('blank');
setVolume(S.volume);
setMuted(S.muted);
showSide();
showSideTab();
applyLang();
window.addEventListener('resize', placeLenses);
