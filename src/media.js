// RoarPlay's engine, plain Node: what a file is made of (probe), how it can be played (plan) and the ffmpeg that
// turns what the window cannot play into what it can, while it plays (streamArgs). Tested by `npm test`.
//
// Four ways to play a file:
//   native     the window plays the file itself (MP4/MOV with H.264, HEVC, VP9, AV1; WebM; MP3, WAV, FLAC, AAC, Ogg)
//   remux      the picture is fine, the wrapper or the sound is not (H.264 in MKV, AVI, TS; PCM or AC3 sound):
//              the picture is copied as it is and only the sound is made AAC. Light: no picture is made again.
//   transcode  the picture itself is made again as H.264 (ProRes, DNxHD/HR, MPEG-2, XDCAM, DV, WMV, MJPEG, GIF…)
//   audio      sound the window cannot play (AC3, DTS, WMA, AIFF, ALAC, AMR…) comes as FLAC, so nothing is lost
// Camera RAW (BRAW, R3D, ARRIRAW, Canon RAW, N-RAW) is none of these: their makers' own tools read them.
const path = require('path');
const { spawn, execFile } = require('child_process');

const IS_WIN = process.platform === 'win32';
let FFMPEG = path.join(__dirname, '..', 'vendor', 'ffmpeg', `${process.platform}-${process.arch}`, IS_WIN ? 'ffmpeg.exe' : 'ffmpeg');
const setFfmpegPath = (p) => { FFMPEG = p; };
const ffmpegPath = () => FFMPEG;

const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'wmv', 'asf', 'flv', 'f4v', 'mpg', 'mpeg', 'm2v', 'mpv', 'ts', 'mts', 'm2ts', 'tod',
  'mod', 'vob', '3gp', '3g2', 'ogv', 'mxf', 'dv', 'dif', 'gif', 'rm', 'rmvb', 'divx', 'xvid', 'mjpeg', 'mjpg', 'h264', '264', 'h265', '265', 'hevc',
  'y4m', 'nut', 'ivf', 'qt', 'apng', 'swf', 'amv', 'evo', 'nsv'];
const AUDIO_EXT = ['mp3', 'wav', 'wave', 'bwf', 'm4a', 'm4b', 'aac', 'adts', 'flac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'aifc', 'caf', 'ac3',
  'eac3', 'ec3', 'dts', 'dtshd', 'mka', 'alac', 'ape', 'wv', 'tta', 'amr', 'awb', 'au', 'snd', 'mp2', 'mpa', 'mp1', 'ra', 'spx', 'gsm', 'voc',
  'w64', 'rf64', 'mid', 'midi', 'thd', 'mlp', 'dsf', 'dff', 'tak', 'ofr', 'mpc', 'xm', 'mod', 's3m', 'it'];
// camera RAW: ffmpeg does not read these; say which tool does
const RAW = {
  braw: ['Blackmagic RAW', 'Blackmagic RAW Player or DaVinci Resolve'],
  r3d: ['REDCODE RAW', 'REDCINE-X Pro or DaVinci Resolve'],
  nev: ['Nikon N-RAW', 'DaVinci Resolve or Nikon NX Studio'],
  ari: ['ARRIRAW', 'ARRI Reference Tool or DaVinci Resolve'],
  arx: ['ARRIRAW', 'ARRI Reference Tool or DaVinci Resolve'],
  mxr: ['ARRIRAW in MXF', 'ARRI Reference Tool or DaVinci Resolve'],
  crm: ['Canon Cinema RAW Light', 'Canon RAW Viewer or DaVinci Resolve'],
  rmf: ['Canon RAW', 'Canon RAW Viewer or DaVinci Resolve'],
  cine: ['Phantom Cine', 'Phantom PCC or DaVinci Resolve'],
};

const SEQ_EXT = ['dpx', 'exr', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'tga', 'bmp'];
const isUrl = (f) => /^https?:\/\//i.test(f);
const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// an image sequence: frames numbered in the name (A001_0001.dpx, shot.00123.exr); the sequence's pattern and its first number
function sequenceOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (!SEQ_EXT.includes(ext)) return null;
  const m = /^(.*?)(\d{3,})(\.[^.]+)$/.exec(path.basename(file));
  if (!m) return null;
  const dir = path.dirname(file);
  let names;
  try { names = require('fs').readdirSync(dir); } catch { return null; }
  const re = new RegExp(`^${reEsc(m[1])}(\\d{${m[2].length}})${reEsc(m[3])}$`, 'i');
  const nums = names.map((n) => re.exec(n)).filter(Boolean).map((x) => +x[1]).sort((a, b) => a - b);
  if (nums.length < 2) return null;
  return { pattern: path.join(dir, `${m[1]}%0${m[2].length}d${m[3]}`), start: nums[0], count: nums.length, first: path.join(dir, `${m[1]}${String(nums[0]).padStart(m[2].length, '0')}${m[3]}`) };
}
// ffmpeg's input arguments for a file, a web address or a sequence (at `fps` frames a second)
function inputArgs(file, { fps = 24 } = {}) {
  const seq = sequenceOf(file);
  if (seq) return ['-framerate', String(fps), '-start_number', String(seq.start), '-i', seq.pattern];
  if (isUrl(file)) return ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', file];
  return ['-i', file];
}

function kindOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (RAW[ext]) return 'raw';
  // .mod is both a camcorder video and a tracker song: a camcorder's, as far more people have those
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (isUrl(file)) return 'url';
  if (sequenceOf(file)) return 'sequence';
  return null;
}
const rawOf = (file) => RAW[path.extname(file).slice(1).toLowerCase()] || null;

// Blackmagic RAW (0.4): the SDK's own reader (helper/braw.cpp), shipped beside ffmpeg on a Mac. It hands ffmpeg the
// decoded frames (RGBA) and the sound (PCM) on a pipe, so a BRAW clip plays as any other file made on the fly.
let BRAW = '';
const setBrawPath = (p) => { BRAW = p && require('fs').existsSync(p) ? p : ''; };
const isBraw = (file) => /\.braw$/i.test(file);
const brawReady = () => !!BRAW;
function brawInfo(file) {
  return new Promise((resolve) => {
    execFile(BRAW, ['info', file], { windowsHide: true, timeout: 30000 }, (e, out, err) => {
      try { resolve(JSON.parse(String(out).trim().split('\n').pop())); } catch { resolve({ error: String(err || (e && e.message) || 'Cannot read the clip').trim().split('\n').pop() }); }
    });
  });
}
// the scale the SDK decodes at (1, 2, 4, 8) for a picture no taller than maxH (0: the full size)
function brawScale(h, maxH) { let s = 1; if (maxH > 0) while (s < 8 && h / s > maxH * 1.05) s *= 2; return s; }
// what the reader is run with, and what ffmpeg reads from it, for one part from `start` seconds
function brawSource(file, info, part, start, maxH) {
  const b = info.braw;
  if (part === 'audio') {
    const a = b.audio, fmt = a.bits > 16 ? 's24le' : 's16le';
    return { cmd: ['audio', file, String(Math.max(0, Math.round(start * a.rate)))], input: ['-f', fmt, '-ar', String(a.rate), '-ac', String(a.channels), '-i', 'pipe:0'] };
  }
  const s = brawScale(b.height, maxH);
  const w = Math.floor(b.width / s), h = Math.floor(b.height / s);
  const frame = Math.max(0, Math.round(start * b.fps));
  return { cmd: ['video', file, String(frame), String(s)], input: ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(b.fps), '-i', 'pipe:0'], scale: s, w, h, frame };
}

// ---------- what a file is made of ----------

// "a, b(c, d), e" -> ["a", "b(c, d)", "e"]: ffmpeg's stream line, split at the commas outside brackets
function parts(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// "prores (HQ) (apch / 0x68637061)" -> "HQ"; a codec's tag ("in24 / 0x34326E69") is not a profile
const profileOf = (first) => { const m = /^\w+ \(([^)]+)\)/.exec(first || ''); return m && !/ \/ 0x/.test(m[1]) ? m[1] : ''; };
const secs = (s) => { const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s || ''); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; };

// ffmpeg's own report on a file (ffmpeg -i), read into what the player needs. Only ffmpeg is shipped (no ffprobe).
function parseProbe(text) {
  const info = { container: '', duration: 0, start: 0, bitrate: 0, timecode: '', title: '', artist: '', album: '', video: null, audio: [], subtitles: 0, cover: false };
  const input = /Input #0, (.+?), from '/.exec(text);
  info.container = input ? input[1] : '';
  const dur = /Duration: ([\d:.]+|N\/A)(?:, start: (-?[\d.]+))?(?:, bitrate: (\d+) kb\/s)?/.exec(text);
  if (dur) { info.duration = secs(dur[1]); info.start = dur[2] ? +dur[2] : 0; info.bitrate = dur[3] ? +dur[3] * 1000 : 0; }
  const lines = text.split('\n');
  let inFormatMeta = false;
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (/^ {2}Metadata:/.test(line)) { inFormatMeta = true; continue; }
    if (/^ {2}\S/.test(line)) inFormatMeta = false;
    const meta = /^\s+(\w+)\s*: (.*)$/.exec(line);
    if (meta) {
      const key = meta[1].toLowerCase();
      // the first timecode wins: the file's own, else its picture's or its timecode track's
      if (key === 'timecode' && !info.timecode && /^\d{2}:\d{2}:\d{2}[:;.]\d{2}$/.test(meta[2].trim())) info.timecode = meta[2].trim();
      if (inFormatMeta && ['title', 'artist', 'album'].includes(key) && !info[key]) info[key] = meta[2].trim();
      continue;
    }
    const st = /^\s+Stream #0:(\d+)(?:\[[^\]]*\])?(?:\((\w+)\))?: (Video|Audio|Subtitle|Data|Attachment): (.*)$/.exec(line);
    if (!st) continue;
    const [, index, lang, type, rest] = st;
    const p = parts(rest);
    const codec = (p[0] || '').split(' ')[0];
    if (type === 'Video') {
      if (/\(attached pic\)/.test(rest)) { info.cover = true; continue; }
      if (info.video) continue;
      const size = p.find((x) => /^\d{2,5}x\d{2,5}/.test(x)) || '';
      const pix = p[1] && !/^\d{2,5}x\d{2,5}/.test(p[1]) ? p[1] : '';
      const fps = /([\d.]+) fps/.exec(rest) || /([\d.]+)k? tbr/.exec(rest);
      const kbs = /(\d+) kb\/s/.exec(rest);
      const [w, h] = (size.match(/^(\d+)x(\d+)/) || []).slice(1).map(Number);
      info.video = {
        index: +index, codec, profile: profileOf(p[0]),
        pixfmt: pix.split('(')[0], colour: (/\(([^)]*)\)/.exec(pix) || [])[1] || '',
        interlaced: /top first|bottom first|top coded first|bottom coded first/.test(pix),
        width: w || 0, height: h || 0, fps: fps ? parseFloat(fps[1]) : 0, bitrate: kbs ? +kbs[1] * 1000 : 0,
      };
    } else if (type === 'Audio') {
      const hz = /(\d+) Hz/.exec(rest);
      const kbs = /(\d+) kb\/s/.exec(rest);
      const bits = /\((\d+) bit\)/.exec(rest);
      info.audio.push({ index: +index, lang: lang && lang !== 'und' ? lang : '', codec, profile: profileOf(p[0]),
        sampleRate: hz ? +hz[1] : 0, channels: (p[2] || '').replace(/^1 channels$/, 'mono').replace(/^(\d+) channels$/, '$1 ch'), bits: bits ? +bits[1] : 0, bitrate: kbs ? +kbs[1] * 1000 : 0 });
    } else if (type === 'Subtitle') info.subtitles++;
  }
  return info;
}

// everything ffmpeg says about a file, as it says it (Alex, 31 Oct: "every piece of information it has, all of it"):
// the wrapper and its tags, every stream with its own line broken into facts, its tags and side data, the chapters
function parseDetail(text) {
  const d = { format: { name: '', tags: {} }, streams: [], chapters: [], programs: 0 };
  let cur = null; // where a Metadata: block belongs: the format, a stream or a chapter
  let inMeta = false, inSide = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    let m;
    if ((m = /^Input #0, (.+?), from '/.exec(line))) { d.format.name = m[1]; cur = d.format; inMeta = inSide = false; continue; }
    if ((m = /^\s+Duration: ([\d:.]+|N\/A)(?:, start: (-?[\d.]+))?(?:, bitrate: (\d+) kb\/s)?/.exec(line))) { d.format.duration = m[1]; d.format.start = m[2] || ''; d.format.bitrate = m[3] ? +m[3] * 1000 : 0; cur = d.format; inMeta = inSide = false; continue; }
    if ((m = /^\s+Chapter #0:(\d+): start ([\d.]+), end ([\d.]+)/.exec(line))) { cur = { index: +m[1], start: +m[2], end: +m[3], tags: {} }; d.chapters.push(cur); inMeta = inSide = false; continue; }
    if (/^\s+Program /.test(line)) { d.programs++; cur = null; continue; }
    if ((m = /^\s+Stream #0:(\d+)(?:\[(0x[0-9a-f]+)\])?(?:\((\w+)\))?: (Video|Audio|Subtitle|Data|Attachment|Unknown): (.*)$/.exec(line))) {
      const rest = m[5];
      const flags = (/\(([^()]*(?:default|forced|hearing impaired|visual impaired|attached pic|timed thumbnails|captions|descriptions|metadata|dependent|still image|clean effects|karaoke|original|comment|lyrics|dub)[^()]*)\)\s*$/.exec(rest) || [])[1] || '';
      const body = flags ? rest.slice(0, rest.lastIndexOf('(')).trim() : rest;
      cur = { index: +m[1], id: m[2] || '', lang: m[3] || '', type: m[4], line: body, parts: parts(body), flags: flags.split(',').map((x) => x.trim()).filter(Boolean), tags: {}, side: [] };
      d.streams.push(cur); inMeta = inSide = false; continue;
    }
    if (/^\s+Metadata:\s*$/.test(line)) { inMeta = true; inSide = false; continue; }
    if (/^\s+Side data:\s*$/.test(line)) { inSide = true; inMeta = false; continue; }
    if (cur && inMeta && (m = /^\s+([^:\s][^:]*?)\s*: ?(.*)$/.exec(line))) { const k = m[1].trim(); if (k in cur.tags) cur.tags[k] += '\n' + m[2]; else cur.tags[k] = m[2]; continue; }
    if (cur && inSide && cur.side && line.trim()) { cur.side.push(line.trim()); continue; }
    if (!/^\s/.test(line)) { inMeta = inSide = false; }
  }
  return d;
}

async function probeBraw(file) {
  const b = await brawInfo(file);
  if (b.error || !b.width) return { container: '', error: b.error || 'Not a Blackmagic RAW clip', readerError: b.error || 'Not a Blackmagic RAW clip', video: null, audio: [], detail: { format: { name: 'braw', tags: {} }, streams: [], chapters: [] }, subs: [], chapters: [], raw: '' };
  const fps = b.fps || 24, duration = b.frames / fps;
  const a = b.audio && b.audio.channels ? [{ index: 1, lang: '', codec: `pcm_s${b.audio.bits > 16 ? 24 : 16}le`, profile: '', sampleRate: b.audio.rate, channels: b.audio.channels === 1 ? 'mono' : b.audio.channels === 2 ? 'stereo' : `${b.audio.channels} ch`, bits: b.audio.bits, bitrate: b.audio.rate * b.audio.bits * b.audio.channels }] : [];
  const tags = { camera: b.camera || '', frames: String(b.frames) };
  return {
    container: 'braw', duration, start: 0, bitrate: 0, timecode: b.timecode || '', title: '', artist: '', album: '', cover: false, subtitles: 0, braw: b, phase: 0,
    video: { index: 0, codec: 'braw', profile: b.camera || '', pixfmt: 'raw', colour: '', interlaced: false, width: b.width, height: b.height, fps, bitrate: 0 },
    audio: a, subs: [], chapters: [],
    detail: { format: { name: 'Blackmagic RAW', tags, duration: '', start: '0', bitrate: 0 }, streams: [{ index: 0, id: '', lang: '', type: 'Video', line: `braw, ${b.width}x${b.height}, ${fps} fps`, parts: ['Blackmagic RAW', 'raw', `${b.width}x${b.height}`, '', `${fps} fps`], flags: [], tags: { camera: b.camera || '', timecode: b.timecode || '' }, side: [] }, ...(a.length ? [{ index: 1, id: '', lang: '', type: 'Audio', line: `pcm, ${b.audio.rate} Hz, ${b.audio.channels} ch, ${b.audio.bits} bit`, parts: [`pcm (${b.audio.bits} bit)`, `${b.audio.rate} Hz`, a[0].channels, `s${b.audio.bits}`], flags: [], tags: {}, side: [] }] : [])], chapters: [], programs: 0 },
    raw: JSON.stringify(b, null, 2),
  };
}

function probe(file, opts = {}) {
  if (isBraw(file) && BRAW) return probeBraw(file);
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', ...inputArgs(file, opts)], { maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: 30000 }, (_e, _o, stderr) => {
      const text = String(stderr || '').replace(/\nAt least one output file must be specified\s*$/, '');
      const info = parseProbe(text);
      if (!info.container) info.error = (text.trim().split('\n').pop() || 'Cannot read the file').replace(/^.*?: /, '');
      info.detail = parseDetail(text);
      info.raw = text.trim();
      const seq = sequenceOf(file);
      if (seq) { info.sequence = { count: seq.count, start: seq.start, fps: opts.fps || 24 }; if (info.video) info.video.fps = opts.fps || 24; info.duration = seq.count / (opts.fps || 24); }
      // the subtitle tracks, each with its number among them, its language and its title
      info.subs = info.detail.streams.filter((x) => x.type === 'Subtitle').map((x, n) => ({ n, index: x.index, lang: x.lang && x.lang !== 'und' ? x.lang : '', title: x.tags.title || '', codec: (x.parts[0] || '').split(' ')[0], bitmap: /dvd_subtitle|hdmv_pgs|dvb_subtitle|xsub/.test(x.parts[0] || '') }));
      info.chapters = info.detail.chapters.map((c) => ({ start: c.start, end: c.end, title: c.tags.title || '' }));
      resolve(info);
    });
  });
}

// ---------- how a file is played ----------

const MP4ISH = (c) => /\b(mov|mp4)\b/.test(c);
// what the window decodes. HEVC only on a Mac and on Windows (their own hardware decoder); 4:2:2 and 4:4:4 nowhere
function windowPlaysVideo(v, platform) {
  const p = v.pixfmt;
  if (v.codec === 'h264') return /^yuvj?420p$/.test(p);
  if (v.codec === 'hevc') return (platform === 'darwin' || platform === 'win32') && /^yuv420p(10le)?$/.test(p);
  if (v.codec === 'vp9' || v.codec === 'av1') return /^yuv420p(10le)?$/.test(p);
  if (v.codec === 'vp8') return /^yuva?420p$/.test(p);
  return false;
}
// the picture can go as it is into the fragmented MP4 RoarPlay makes (VP8 cannot)
const copyable = (v, platform) => windowPlaysVideo(v, platform) && v.codec !== 'vp8';

function windowPlaysAudio(container, ext, a) {
  const c = a.codec;
  if (MP4ISH(container)) return ['aac', 'mp3', 'opus', 'flac'].includes(c);
  if (/webm/.test(container) && ext === 'webm') return ['opus', 'vorbis'].includes(c);
  if (container === 'mp3') return c === 'mp3';
  if (container === 'wav') return /^pcm_(u8|s16le|s24le|s32le|f32le)$/.test(c);
  if (container === 'ogg') return ['vorbis', 'opus', 'flac'].includes(c);
  if (container === 'flac') return c === 'flac';
  if (container === 'aac') return c === 'aac';
  return false;
}

// how to play `info` (the file's probe), with sound track `track`
function plan(info, file, platform = process.platform, track = 0) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (info && info.braw && !info.error) return { mode: 'transcode' };
  const raw = rawOf(file);
  // the reader is there but could not open the clip: say why, not only who else opens it
  if (raw && info && info.readerError) return { mode: 'none', why: 'failed', detail: `${raw[0]}: ${info.readerError}` };
  if (raw) return { mode: 'none', why: 'raw', format: raw[0], app: raw[1] };
  if (!info || info.error || (!info.video && !info.audio.length)) return { mode: 'none', why: 'unreadable' };
  if (info.sequence) return { mode: 'transcode' };
  // a web address cannot be read in pieces by the window the way a file can, so it comes through ffmpeg
  if (isUrl(file)) return info.video ? (copyable(info.video, platform) ? { mode: 'remux' } : { mode: 'transcode' }) : { mode: 'audio' };
  const v = info.video;
  const a = info.audio[track] || null;
  const c = info.container;
  if (!v) {
    if (track === 0 && a && windowPlaysAudio(c, ext, a)) return { mode: 'native' };
    return { mode: 'audio' };
  }
  const soundOk = !a || (track === 0 && windowPlaysAudio(c, ext, a));
  const wrapperOk = MP4ISH(c) || (/webm/.test(c) && ext === 'webm');
  // a GIF and an animated PNG: ffmpeg reads them as clips, the window does not play them in a <video>
  if (windowPlaysVideo(v, platform) && soundOk && wrapperOk) return { mode: 'native' };
  if (copyable(v, platform)) return { mode: 'remux' };
  return { mode: 'transcode' };
}

// ---------- the ffmpeg that plays it ----------
// The window takes a stream in pieces (Media Source): the picture and the sound each come from their own ffmpeg as a
// fragmented MP4, so either can start again anywhere on its own. Every fragmented MP4 begins at zero; `offset` (in
// main.js) is where that zero sits in the file, and the window places the pieces there.

const FRAG = ['-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-frag_duration', '1000000', '-write_tmcd', '0'];

// ffmpeg's arguments for one part ('video' or 'audio') of `mode` from `start` seconds. hw: the Mac's own H.264 encoder.
function streamArgs(file, info, mode, start = 0, { track = 0, hw = false, part = 'video', platform = process.platform, maxH = 1080 } = {}) {
  const head = info.braw
    ? ['-hide_banner', '-loglevel', 'error', ...brawSource(file, info, part, start, maxH).input]
    : ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(start > 0 ? ['-ss', start.toFixed(3)] : []), ...inputArgs(file, { fps: info.sequence?.fps })];
  const tail = ['-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1', ...FRAG, 'pipe:1'];
  if (part === 'audio') {
    const a = Math.min(track, Math.max(0, info.audio.length - 1));
    // a sound file keeps every bit (FLAC); a film's sound is AAC, two channels
    const enc = mode === 'audio' ? ['-c:a', 'flac', '-strict', '-2'] : ['-c:a', 'aac', '-b:a', '256k', '-ac', '2'];
    return [...head, '-map', info.braw ? '0:a:0' : `0:a:${a}`, '-vn', ...enc, ...tail];
  }
  if (mode === 'remux') {
    return [...head, '-map', '0:v:0', '-an', '-c:v', 'copy', ...(info.video.codec === 'hevc' ? ['-tag:v', 'hvc1'] : []), ...tail];
  }
  // transcode: H.264 8-bit 4:2:0, no taller than `maxH` (1080 for playing: four times less work than 4K, and the
  // screen shows no more; 0 for the full size), no B-frames (the first frame is `start` exactly), a keyframe every second
  const v = info.video;
  const fps = v.fps > 0 && v.fps < 1000 ? v.fps : 25;
  const scale = maxH > 0 ? `scale=-2:'min(ih,${maxH})':flags=fast_bilinear` : "scale='min(iw,3840)':-2:flags=bicubic";
  // the reader already decoded at the right size; only an even width and height are made
  const filters = [v.interlaced ? 'yadif=0:-1:0' : null, scale, hw ? 'format=nv12' : 'format=yuv420p'].filter(Boolean);
  const enc = hw && platform === 'darwin'
    ? ['-c:v', 'h264_videotoolbox', '-b:v', maxH && maxH <= 1080 ? '16M' : '40M', '-realtime', '1', '-allow_sw', '1', '-profile:v', 'high']
    : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '18', '-profile:v', 'high', '-threads', '0'];
  // a keyframe every half second: the first piece reaches the window sooner, and a seek lands closer
  return [...head, '-map', '0:v:0', '-an', '-vf', filters.join(','), ...enc, '-bf', '0', '-g', String(Math.max(1, Math.round(fps / 2))), '-fps_mode', 'passthrough', ...tail];
}

// what the window is told each part is
function mimeOf(info, mode, part) {
  if (part === 'audio') return mode === 'audio' ? 'audio/mp4; codecs="flac"' : 'audio/mp4; codecs="mp4a.40.2"';
  const v = info.video;
  if (mode === 'transcode') return 'video/mp4; codecs="avc1.640033"';
  const ten = /10le$/.test(v.pixfmt);
  if (v.codec === 'hevc') return `video/mp4; codecs="hvc1.${ten ? 2 : 1}.6.L153.B0"`;
  if (v.codec === 'vp9') return `video/mp4; codecs="vp09.${ten ? '02' : '00'}.51.${ten ? 10 : '08'}"`;
  if (v.codec === 'av1') return `video/mp4; codecs="av01.0.13M.${ten ? 10 : '08'}"`;
  return 'video/mp4; codecs="avc1.640033"';
}

// the first picture packet at or after a seek to `start` (the keyframe at or before it), its decode and presentation
// times in the file's own seconds (as -ss counts them: from the file's start). A copied picture's fragmented MP4 has
// its zero at that dts (a little before zero at a file's very start when it has B-frames); at 0 the pts is where the
// file's first frame sits, which is where its timecode starts. Asked of ffmpeg itself: one packet, no decoding.
function firstPacket(file, info, start = 0) {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(start > 0 ? ['-ss', start.toFixed(3)] : []), '-copyts', ...inputArgs(file, { fps: info.sequence?.fps }), '-map', '0:v:0',
      '-c', 'copy', '-frames:v', '1', '-f', 'framecrc', '-'], { windowsHide: true }, (_e, out) => {
      const tb = /#tb 0: (\d+)\/(\d+)/.exec(String(out || ''));
      const row = String(out || '').split('\n').find((l) => /^0,/.test(l));
      if (!tb || !row) return resolve({ dts: start, pts: start });
      const at = (n) => (n * +tb[1]) / +tb[2] - (info.start || 0);
      const [, dts, pts] = row.split(',').map(Number);
      resolve({ dts: at(dts), pts: at(pts) });
    });
  });
}

// the sound's shape for the timeline: `bins` peaks (0..1), from the whole file read once at 8 kHz mono
function waveform(file, track = 0, bins = 1200, duration = 0) {
  return new Promise((resolve) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inputArgs(file), '-map', `0:a:${track}`, '-vn', '-sn', '-dn', '-ac', '1', '-ar', '8000',
      '-f', 's16le', 'pipe:1'], { windowsHide: true });
    const total = duration > 0 ? Math.ceil(duration * 8000) : 0;
    const per = total ? Math.max(1, Math.floor(total / bins)) : 4000;
    const peaks = [];
    let peak = 0, n = 0, left = null;
    p.stdout.on('data', (d) => {
      let buf = left ? Buffer.concat([left, d]) : d;
      const even = buf.length - (buf.length % 2);
      for (let i = 0; i < even; i += 2) {
        const s = Math.abs(buf.readInt16LE(i));
        if (s > peak) peak = s;
        if (++n >= per) { peaks.push(peak / 32768); peak = 0; n = 0; }
      }
      left = even < buf.length ? buf.subarray(even) : null;
    });
    p.on('error', () => resolve([]));
    p.on('close', () => { if (n) peaks.push(peak / 32768); resolve(peaks); });
  });
}

// an album's picture inside a sound file, as a JPEG
function cover(file) {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inputArgs(file), '-map', '0:v:0', '-frames:v', '1', '-vf', "scale='min(iw,900)':-2",
      '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (_e, out) => resolve(out && out.length ? out : null));
  });
}

// one frame of a BRAW clip through the reader into ffmpeg, as `out` (a file) or a JPEG buffer
function brawFrame(file, info, at, maxH, outArgs) {
  return new Promise((resolve, reject) => {
    const src = brawSource(file, info, 'video', at, maxH);
    const r = spawn(BRAW, src.cmd, { windowsHide: true });
    const f = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...src.input, '-frames:v', '1', ...outArgs], { windowsHide: true });
    r.stdout.pipe(f.stdin);
    f.stdin.on('error', () => {});
    r.stdout.on('error', () => {});
    const chunks = []; let err = '';
    f.stdout.on('data', (d) => chunks.push(d));
    f.stderr.on('data', (d) => { err += d; });
    f.on('close', (code) => { try { r.kill('SIGKILL'); } catch {} if (code === 0) resolve(Buffer.concat(chunks)); else reject(new Error(err.trim().split('\n').pop() || 'The frame could not be made')); });
  });
}

// one frame as a picture (the snapshot), at `at` seconds, at the file's full size; PNG or JPG by the name
function frameAt(file, at, out, info = null) {
  if (info && info.braw) return brawFrame(file, info, at, 0, [...(/\.jpe?g$/i.test(out) ? ['-q:v', '2'] : []), out]).then(() => out);
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', Math.max(0, at).toFixed(3), ...inputArgs(file, { fps: info?.sequence?.fps }), '-map', '0:v:0', '-frames:v', '1',
      ...(/\.jpe?g$/i.test(out) ? ['-q:v', '2'] : []), out],
      { windowsHide: true }, (e, _o, err) => (e ? reject(new Error(String(err || e.message).trim().split('\n').pop())) : resolve(out)));
  });
}

// a small frame at `at` seconds for the bar's thumbnail, as a JPEG
function thumb(file, at, info = null, width = 240) {
  if (info && info.braw) return brawFrame(file, info, at, 270, ['-vf', `scale=${width}:-2`, '-c:v', 'mjpeg', '-q:v', '6', '-f', 'image2pipe', 'pipe:1']).catch(() => null);
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-ss', Math.max(0, at).toFixed(3), ...inputArgs(file, { fps: info?.sequence?.fps }), '-map', '0:v:0', '-frames:v', '1',
      '-vf', `scale=${width}:-2:flags=fast_bilinear`, '-c:v', 'mjpeg', '-q:v', '6', '-f', 'image2pipe', 'pipe:1'], { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024, windowsHide: true, timeout: 8000 },
      (_e, out) => resolve(out && out.length ? out : null));
  });
}

// a subtitle track of the file (its number among the subtitle tracks), or a subtitle file (.srt, .ass, .ssa, .vtt, .sub,
// .sbv, .lrc...), as WebVTT text, which the window shows itself. Bitmap subtitles (DVD, Blu-ray) cannot become text.
function subtitles(file, { track = null, subFile = null } = {}) {
  return new Promise((resolve, reject) => {
    const input = subFile ? ['-i', subFile] : inputArgs(file);
    const map = subFile ? [] : ['-map', `0:s:${track}`];
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...input, ...map, '-f', 'webvtt', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 60000 },
      (e, out, err) => (e ? reject(new Error(String(err || e.message).trim().split('\n').pop() || 'Cannot read the subtitles')) : resolve(String(out))));
  });
}
// subtitle files beside a video: the same name, or the same name with a language (Film.el.srt)
const SUB_EXT = ['srt', 'vtt', 'ass', 'ssa', 'sub', 'sbv', 'lrc', 'stl', 'ttml', 'dfxp'];
function subtitleFilesBeside(file) {
  if (isUrl(file)) return [];
  const dir = path.dirname(file), base = path.parse(file).name.toLowerCase();
  try {
    return require('fs').readdirSync(dir).filter((n) => { const p = path.parse(n); return SUB_EXT.includes(p.ext.slice(1).toLowerCase()) && (p.name.toLowerCase() === base || p.name.toLowerCase().startsWith(base + '.')); })
      .map((n) => ({ file: path.join(dir, n), name: n, lang: (/\.([a-z]{2,3})\.[^.]+$/i.exec(n) || [])[1] || '' }));
  } catch { return []; }
}

// ---------- the professional side (0.3) ----------

// every picture packet of the file, read without decoding: when it shows (pts), whether it is a keyframe, its size.
// The GOP strip, the keyframe ticks and the bitrate graph come from this. A B-frame shows before a packet that came
// after it (its pts is below the one before), so the reordered packets are marked B, the keyframes I, the rest P.
function packets(file, info, { onProgress = null } = {}) {
  return new Promise((resolve) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...inputArgs(file, { fps: info?.sequence?.fps }), '-map', '0:v:0', '-c', 'copy', '-copyts', '-f', 'framecrc', 'pipe:1'], { windowsHide: true });
    let tb = [1, 1], buf = '', n = 0;
    const out = { t: [], k: [], b: [], s: [] };
    let maxPts = -Infinity;
    const start = info?.start || 0;
    p.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) {
        let m;
        if ((m = /^#tb 0: (\d+)\/(\d+)/.exec(l))) { tb = [+m[1], +m[2]]; continue; }
        if (l[0] !== '0' || l[1] !== ',') continue;
        const f = l.split(',');
        const pts = (+f[2] * tb[0]) / tb[1] - start;
        const key = !/F=0x/.test(l) || /F=0x1\b/.test(l);
        const bframe = pts < maxPts;
        if (pts > maxPts) maxPts = pts;
        out.t.push(+pts.toFixed(4)); out.k.push(key ? 1 : 0); out.b.push(bframe ? 1 : 0); out.s.push(+f[4]);
        if (onProgress && ++n % 500 === 0 && info?.duration) onProgress(Math.min(0.99, pts / info.duration));
      }
    });
    p.on('error', () => resolve(out));
    p.on('close', () => { module.exports._sortPackets(out); resolve(out); });
  });
}
// packets come in decode order; the strip wants them in the order they show
function _sortPackets(out) {
  const idx = out.t.map((_, i) => i).sort((a, b) => out.t[a] - out.t[b]);
  for (const k of ['t', 'k', 'b', 's']) out[k] = idx.map((i) => out[k][i]);
}

// the QC report: the file decoded once, end to end, by ffmpeg's own checks. Black, frozen and silent stretches,
// loudness (EBU R128: integrated, range, true peak), decode errors, and what the packets say (gaps, drops). Every
// finding has a time, so a click goes there. Progress through -progress.
function qc(file, info, { onProgress = null } = {}) {
  return new Promise((resolve) => {
    const hasV = !!info?.video, hasA = !!(info?.audio && info.audio.length);
    const args = ['-hide_banner', '-nostdin', '-loglevel', 'info', '-progress', 'pipe:1', '-nostats', ...inputArgs(file, { fps: info?.sequence?.fps })];
    if (hasV) args.push('-map', '0:v:0', '-vf', 'blackdetect=d=0.5:pic_th=0.98,freezedetect=n=-60dB:d=2', '-fps_mode', 'passthrough');
    if (hasA) args.push('-map', '0:a:0', '-af', 'silencedetect=n=-60dB:d=2,ebur128=peak=true');
    args.push('-f', 'null', '-');
    const p = spawn(FFMPEG, args, { windowsHide: true });
    const findings = [];
    const summary = {};
    let err = '', outBuf = '';
    const dur = info?.duration || 0;
    p.stdout.on('data', (d) => {
      outBuf += d.toString();
      const lines = outBuf.split('\n'); outBuf = lines.pop();
      for (const l of lines) { const m = /^out_time_(?:us|ms)=(\d+)/.exec(l); if (m && dur && onProgress) onProgress(Math.min(0.99, +m[1] / 1e6 / dur)); }
    });
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 4e6) err = err.slice(-2e6); });
    p.on('error', () => resolve({ findings, summary, error: 'ffmpeg could not run' }));
    p.on('close', () => {
      const lines = err.split('\n');
      let m;
      for (const l of lines) {
        if ((m = /black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/.exec(l))) findings.push({ kind: 'black', t: +m[1], end: +m[2], text: `${(+m[3]).toFixed(2)} s` });
        else if ((m = /lavfi\.freezedetect\.freeze_start: ([\d.]+)/.exec(l))) findings.push({ kind: 'freeze', t: +m[1], end: null, text: '' });
        else if ((m = /lavfi\.freezedetect\.freeze_end: ([\d.]+)/.exec(l))) { const f = [...findings].reverse().find((x) => x.kind === 'freeze' && x.end == null); if (f) { f.end = +m[1]; f.text = `${(f.end - f.t).toFixed(2)} s`; } }
        else if ((m = /silence_start: ([\d.]+)/.exec(l))) findings.push({ kind: 'silence', t: +m[1], end: null, text: '' });
        else if ((m = /silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/.exec(l))) { const f = [...findings].reverse().find((x) => x.kind === 'silence' && x.end == null); if (f) { f.end = +m[1]; f.text = `${(+m[2]).toFixed(2)} s`; } }
        else if (/^\[.*@ 0x[0-9a-f]+\] /.test(l) && /(error|invalid|corrupt|missing|concealing|damaged|non-monotonic|discard)/i.test(l) && !/ebur128|silencedetect|blackdetect|freezedetect/.test(l)) {
          const text = l.replace(/^\[.*?\] /, '').trim();
          const last = findings[findings.length - 1];
          if (last && last.kind === 'decode' && last.text === text) last.n = (last.n || 1) + 1; else findings.push({ kind: 'decode', t: null, text });
        }
      }
      // the loudness summary at the end of ebur128's report
      const sum = err.slice(err.lastIndexOf('Summary:'));
      if ((m = /I:\s+(-?[\d.]+) LUFS/.exec(sum))) summary.integrated = +m[1];
      if ((m = /LRA:\s+([\d.]+) LU/.exec(sum))) summary.range = +m[1];
      if ((m = /Peak:\s+(-?[\d.]+) dBFS/.exec(sum))) summary.truePeak = +m[1];
      if ((m = /Threshold:\s+(-?[\d.]+) LUFS/.exec(sum))) summary.threshold = +m[1];
      if (findings.length > 2000) { findings.length = 2000; summary.truncated = true; }
      resolve({ findings, summary });
    });
  });
}

// what the packets say: gaps in time (frames missing) and a stretch where the picture ran out of keyframes for long
function packetFindings(pk, fps) {
  const out = [];
  if (!pk || pk.t.length < 2 || !fps) return out;
  const step = 1 / fps;
  let lastKey = pk.t[0];
  for (let i = 1; i < pk.t.length; i++) {
    const gap = pk.t[i] - pk.t[i - 1];
    if (gap > step * 1.5 && gap < 3600) out.push({ kind: 'gap', t: pk.t[i - 1], end: pk.t[i], text: `${Math.round(gap / step) - 1}` });
    if (pk.k[i]) lastKey = pk.t[i];
  }
  const kf = pk.k.reduce((a, b) => a + b, 0);
  out.summary = { frames: pk.t.length, keyframes: kf, bframes: pk.b.reduce((a, b) => a + b, 0), gopAvg: kf ? pk.t.length / kf : 0, lastKey };
  return out;
}

// a .cube LUT (Resolve, every grading tool): 1D or 3D, as floats, with its size and its domain
function parseCube(text) {
  const lut = { size: 0, dim: 3, min: [0, 0, 0], max: [1, 1, 1], title: '', data: [] };
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l || l[0] === '#') continue;
    let m;
    if ((m = /^TITLE\s+"?(.*?)"?$/.exec(l))) lut.title = m[1];
    else if ((m = /^LUT_3D_SIZE\s+(\d+)/.exec(l))) { lut.size = +m[1]; lut.dim = 3; }
    else if ((m = /^LUT_1D_SIZE\s+(\d+)/.exec(l))) { lut.size = +m[1]; lut.dim = 1; }
    else if ((m = /^DOMAIN_MIN\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/.exec(l))) lut.min = [+m[1], +m[2], +m[3]];
    else if ((m = /^DOMAIN_MAX\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)/.exec(l))) lut.max = [+m[1], +m[2], +m[3]];
    else if (/^[\d.e+-]+\s+[\d.e+-]+\s+[\d.e+-]+$/.test(l)) { const [r, g, b] = l.split(/\s+/).map(Number); lut.data.push(r, g, b); }
  }
  const want = lut.dim === 3 ? lut.size ** 3 * 3 : lut.size * 3;
  if (!lut.size || lut.data.length < want) throw new Error('Not a .cube LUT');
  lut.data.length = want;
  return lut;
}

module.exports = { setFfmpegPath, ffmpegPath, setBrawPath, brawReady, isBraw, brawSource, brawScale, brawInfo, VIDEO_EXT, AUDIO_EXT, SUB_EXT, RAW, kindOf, rawOf, isUrl, sequenceOf, inputArgs, parts, parseProbe, parseDetail, probe, plan, streamArgs, mimeOf, firstPacket, waveform, cover, frameAt, thumb, subtitles, subtitleFilesBeside, windowPlaysVideo, packets, _sortPackets, qc, packetFindings, parseCube };
