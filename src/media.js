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

function kindOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (RAW[ext]) return 'raw';
  // .mod is both a camcorder video and a tracker song: a camcorder's, as far more people have those
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  return null;
}
const rawOf = (file) => RAW[path.extname(file).slice(1).toLowerCase()] || null;

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

function probe(file) {
  return new Promise((resolve) => {
    execFile(FFMPEG, ['-hide_banner', '-i', file], { maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (_e, _o, stderr) => {
      const info = parseProbe(String(stderr || ''));
      if (!info.container) info.error = (String(stderr || '').trim().split('\n').pop() || 'Cannot read the file').replace(/^.*?: /, '');
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
  const raw = rawOf(file);
  if (raw) return { mode: 'none', why: 'raw', format: raw[0], app: raw[1] };
  if (!info || info.error || (!info.video && !info.audio.length)) return { mode: 'none', why: 'unreadable' };
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
function streamArgs(file, info, mode, start = 0, { track = 0, hw = false, part = 'video', platform = process.platform } = {}) {
  const head = ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(start > 0 ? ['-ss', start.toFixed(3)] : []), '-i', file];
  const tail = ['-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1', ...FRAG, 'pipe:1'];
  if (part === 'audio') {
    const a = Math.min(track, Math.max(0, info.audio.length - 1));
    // a sound file keeps every bit (FLAC); a film's sound is AAC, two channels
    const enc = mode === 'audio' ? ['-c:a', 'flac', '-strict', '-2'] : ['-c:a', 'aac', '-b:a', '256k', '-ac', '2'];
    return [...head, '-map', `0:a:${a}`, '-vn', ...enc, ...tail];
  }
  if (mode === 'remux') {
    return [...head, '-map', '0:v:0', '-an', '-c:v', 'copy', ...(info.video.codec === 'hevc' ? ['-tag:v', 'hvc1'] : []), ...tail];
  }
  // transcode: H.264 8-bit 4:2:0, at most 4K, no B-frames (the first frame is `start` exactly), a keyframe every second
  const v = info.video;
  const fps = v.fps > 0 && v.fps < 1000 ? v.fps : 25;
  const filters = [v.interlaced ? 'yadif=0:-1:0' : null, "scale='min(iw,3840)':-2:flags=bicubic", hw ? 'format=nv12' : 'format=yuv420p'].filter(Boolean);
  const enc = hw && platform === 'darwin'
    ? ['-c:v', 'h264_videotoolbox', '-b:v', '40M', '-realtime', '1', '-profile:v', 'high']
    : ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '16', '-profile:v', 'high'];
  return [...head, '-map', '0:v:0', '-an', '-vf', filters.join(','), ...enc, '-bf', '0', '-g', String(Math.max(1, Math.round(fps))), ...tail];
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
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...(start > 0 ? ['-ss', start.toFixed(3)] : []), '-copyts', '-i', file, '-map', '0:v:0',
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
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', `0:a:${track}`, '-vn', '-sn', '-dn', '-ac', '1', '-ar', '8000',
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
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', file, '-map', '0:v:0', '-frames:v', '1', '-vf', "scale='min(iw,900)':-2",
      '-c:v', 'mjpeg', '-f', 'image2pipe', 'pipe:1'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (_e, out) => resolve(out && out.length ? out : null));
  });
}

// one frame as a PNG (the snapshot), at `at` seconds, at the file's full size
function frameAt(file, at, out) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', Math.max(0, at).toFixed(3), '-i', file, '-map', '0:v:0', '-frames:v', '1', out],
      { windowsHide: true }, (e, _o, err) => (e ? reject(new Error(String(err || e.message).trim().split('\n').pop())) : resolve(out)));
  });
}

module.exports = { setFfmpegPath, ffmpegPath, VIDEO_EXT, AUDIO_EXT, RAW, kindOf, rawOf, parts, parseProbe, probe, plan, streamArgs, mimeOf, firstPacket, waveform, cover, frameAt, windowPlaysVideo };
