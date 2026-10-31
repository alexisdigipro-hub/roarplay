// RoarPlay's engine on real files made with ffmpeg: what each file is made of, how each is played, the ffmpeg that
// plays it, the first packet's times, a waveform, a snapshot. `npm test` (FFMPEG=/usr/bin/ffmpeg where npm cannot install).
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const m = require('../src/media');

const FF = process.env.FFMPEG || path.join(__dirname, '..', 'vendor', 'ffmpeg', `${process.platform}-${process.arch}`, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
m.setFfmpegPath(FF);
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'roarplay-test-'));
const ff = (...a) => execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
const P = (n) => path.join(T, n);
const SRC = ['-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25', '-f', 'lavfi', '-i', 'sine=f=440:sample_rate=48000', '-t', '4'];

let n = 0;
const ok = (what) => { n++; console.log(`  ✓ ${what}`); };

(async () => {
  console.log('files');
  ff(...SRC, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', P('native.mp4'));
  ff(...SRC, '-c:v', 'prores_ks', '-profile:v', '3', '-c:a', 'pcm_s24le', '-timecode', '01:00:00:00', P('prores.mov'));
  ff(...SRC, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '25', '-c:a', 'ac3', P('h264.mkv'));
  ff(...SRC, '-c:v', 'mpeg4', '-c:a', 'mp3', P('old.avi'));
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=29.97', '-f', 'lavfi', '-i', 'sine=f=200', '-f', 'lavfi', '-i', 'sine=f=800', '-t', '3', '-map', '0', '-map', '1', '-map', '2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-metadata:s:a:1', 'language=eng', '-timecode', '00:59:59;00', P('two.mov'));
  ff('-f', 'lavfi', '-i', 'sine=f=440:sample_rate=48000', '-t', '4', '-c:a', 'pcm_s24le', P('tone.wav'));
  ff('-f', 'lavfi', '-i', 'sine=f=220', '-t', '4', '-c:a', 'ac3', P('tone.ac3'));
  ff('-f', 'lavfi', '-i', 'sine=f=660', '-t', '4', '-c:a', 'pcm_s16be', P('tone.aiff'));
  ff('-f', 'lavfi', '-i', 'sine=f=550', '-t', '4', '-c:a', 'libmp3lame', '-metadata', 'title=Test Song', '-metadata', 'artist=The Mad Lions', '-id3v2_version', '3', P('song.mp3'));
  fs.writeFileSync(P('clip.braw'), 'not really');
  fs.writeFileSync(P('notes.txt'), 'hello');
  ok('made');

  console.log('kinds');
  assert.strictEqual(m.kindOf('a.MOV'), 'video'); assert.strictEqual(m.kindOf('a.flac'), 'audio'); assert.strictEqual(m.kindOf('a.braw'), 'raw'); assert.strictEqual(m.kindOf('a.txt'), null);
  assert.strictEqual(m.rawOf('x.R3D')[1], 'REDCINE-X Pro or DaVinci Resolve');
  ok('by extension, camera RAW named with its tool');

  console.log('probe and plan');
  const probe = async (f) => { const info = await m.probe(P(f)); return { info, plan: m.plan(info, P(f), 'darwin') }; };
  let r = await probe('native.mp4');
  assert.strictEqual(r.plan.mode, 'native'); assert.strictEqual(r.info.video.codec, 'h264'); assert.strictEqual(r.info.video.width, 320); assert.strictEqual(r.info.video.fps, 25); assert.ok(r.info.duration >= 3.9 && r.info.duration <= 4.1);
  ok('H.264 MP4 plays as it is');
  r = await probe('prores.mov');
  assert.strictEqual(r.plan.mode, 'transcode'); assert.strictEqual(r.info.video.codec, 'prores'); assert.strictEqual(r.info.video.profile, 'HQ'); assert.strictEqual(r.info.video.pixfmt, 'yuv422p10le');
  assert.strictEqual(r.info.timecode, '01:00:00:00'); assert.strictEqual(r.info.audio[0].bits, 24); assert.strictEqual(r.info.audio[0].profile, '');
  ok('ProRes is made again; its timecode and 24-bit sound read');
  r = await probe('h264.mkv');
  assert.strictEqual(r.plan.mode, 'remux'); assert.strictEqual(r.info.audio[0].codec, 'ac3');
  ok('H.264 in MKV with AC3: the picture copied, the sound made AAC');
  r = await probe('old.avi');
  assert.strictEqual(r.plan.mode, 'transcode'); assert.strictEqual(r.info.video.codec, 'mpeg4');
  ok('MPEG-4 in AVI is made again');
  r = await probe('two.mov');
  assert.strictEqual(r.plan.mode, 'native'); assert.strictEqual(r.info.audio.length, 2); assert.strictEqual(r.info.audio[1].lang, 'eng'); assert.strictEqual(r.info.timecode, '00:59:59;00');
  assert.strictEqual(m.plan(r.info, P('two.mov'), 'darwin', 1).mode, 'remux');
  ok('two sound tracks: the first as it is, the second through ffmpeg; drop-frame timecode read');
  r = await probe('tone.wav'); assert.strictEqual(r.plan.mode, 'native'); assert.strictEqual(r.info.audio[0].bits, 24); assert.strictEqual(r.info.audio[0].channels, 'mono');
  r = await probe('tone.ac3'); assert.strictEqual(r.plan.mode, 'audio');
  r = await probe('tone.aiff'); assert.strictEqual(r.plan.mode, 'audio');
  r = await probe('song.mp3'); assert.strictEqual(r.plan.mode, 'native'); assert.strictEqual(r.info.title, 'Test Song'); assert.strictEqual(r.info.artist, 'The Mad Lions');
  ok('WAV and MP3 as they are, AC3 and AIFF as FLAC; a song\'s title and artist');
  r = await probe('clip.braw'); assert.strictEqual(r.plan.mode, 'none'); assert.strictEqual(r.plan.why, 'raw'); assert.strictEqual(r.plan.format, 'Blackmagic RAW');
  r = await probe('notes.txt'); assert.strictEqual(r.plan.mode, 'none'); assert.strictEqual(r.plan.why, 'unreadable');
  ok('Blackmagic RAW names its tool, a text file is unreadable');
  const hevc = { container: 'matroska,webm', duration: 1, start: 0, video: { codec: 'hevc', pixfmt: 'yuv420p10le', fps: 25 }, audio: [{ codec: 'aac' }] };
  assert.strictEqual(m.plan(hevc, 'x.mkv', 'darwin').mode, 'remux'); assert.strictEqual(m.plan(hevc, 'x.mkv', 'linux').mode, 'transcode');
  assert.strictEqual(m.plan({ ...hevc, video: { ...hevc.video, pixfmt: 'yuv422p10le' } }, 'x.mkv', 'darwin').mode, 'transcode');
  ok('HEVC 4:2:0 copied where the system decodes it, 4:2:2 made again everywhere');

  console.log('the ffmpeg that plays');
  const info = (await probe('prores.mov')).info;
  let a = m.streamArgs(P('prores.mov'), info, 'transcode', 5.5, { part: 'video' });
  assert.ok(a.includes('-ss') && a[a.indexOf('-ss') + 1] === '5.500'); assert.ok(a.includes('libx264')); assert.ok(a.includes('-an')); assert.ok(a.join(' ').includes('frag_keyframe'));
  a = m.streamArgs(P('prores.mov'), info, 'transcode', 5.5, { part: 'video', hw: true, platform: 'darwin' });
  assert.ok(a.includes('h264_videotoolbox'));
  a = m.streamArgs(P('prores.mov'), info, 'transcode', 0, { part: 'audio' });
  assert.ok(!a.includes('-ss') && a.includes('aac') && a.includes('-vn'));
  a = m.streamArgs(P('tone.ac3'), (await probe('tone.ac3')).info, 'audio', 1, { part: 'audio' });
  assert.ok(a.includes('flac'));
  a = m.streamArgs(P('h264.mkv'), (await probe('h264.mkv')).info, 'remux', 0, { part: 'video' });
  assert.ok(a.includes('copy'));
  assert.strictEqual(m.mimeOf(info, 'transcode', 'video'), 'video/mp4; codecs="avc1.640033"');
  assert.strictEqual(m.mimeOf(hevc, 'remux', 'video'), 'video/mp4; codecs="hvc1.2.6.L153.B0"');
  assert.strictEqual(m.mimeOf(info, 'audio', 'audio'), 'audio/mp4; codecs="flac"');
  ok('arguments and what the window is told');
  // the stream itself: a fragmented MP4 that begins with ftyp and moov, at 5.5 s, 25 frames a second
  const out = execFileSync(FF, m.streamArgs(P('prores.mov'), info, 'transcode', 3, { part: 'video' }), { maxBuffer: 64 * 1024 * 1024 });
  assert.strictEqual(out.toString('latin1', 4, 8), 'ftyp'); assert.ok(out.includes('moof'));
  ok('a fragmented MP4 comes out');

  console.log('the first packet');
  const mk = (await probe('h264.mkv')).info;
  let fp = await m.firstPacket(P('h264.mkv'), mk, 0);
  assert.ok(Math.abs(fp.pts) < 0.05, `pts ${fp.pts}`); assert.ok(fp.dts <= fp.pts);
  fp = await m.firstPacket(P('h264.mkv'), mk, 2.5);
  assert.ok(Math.abs(fp.pts - 2) < 0.05, `keyframe at 2 s, got ${fp.pts}`);
  ok('the keyframe at or before a seek, in the file\'s seconds');

  console.log('the detail, sequences, subtitles');
  const pd = (await probe('prores.mov')).info.detail;
  assert.strictEqual(pd.streams.length, 3); assert.strictEqual(pd.streams[0].type, 'Video'); assert.strictEqual(pd.streams[0].tags.timecode, '01:00:00:00'); assert.deepStrictEqual(pd.streams[0].flags, ['default']);
  assert.strictEqual(pd.streams[2].type, 'Data'); assert.strictEqual(pd.format.tags.major_brand, 'qt  ');
  const sd = (await probe('song.mp3')).info.detail; assert.strictEqual(sd.format.tags.artist, 'The Mad Lions'); assert.strictEqual(sd.streams[0].type, 'Audio');
  ok('every stream with its tags and flags, the wrapper with its tags');
  fs.mkdirSync(P('seq')); ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24', '-t', '1', P('seq/A001_0007.png').replace('0007', '%04d'));
  const seq = m.sequenceOf(P('seq/A001_0003.png'));
  assert.ok(seq && seq.count === 24 && seq.start === 1 && /%04d/.test(seq.pattern));
  assert.strictEqual(m.sequenceOf(P('native.mp4')), null);
  const si = await m.probe(P('seq/A001_0003.png'), { fps: 24 });
  assert.strictEqual(si.sequence.count, 24); assert.strictEqual(si.duration, 1); assert.strictEqual(m.plan(si, P('seq/A001_0003.png')).mode, 'transcode');
  assert.ok(m.streamArgs(P('seq/A001_0003.png'), si, 'transcode', 0.5, { part: 'video' }).join(' ').includes('-framerate 24 -start_number 1 -i'));
  ok('an image sequence is one clip at the chosen frame rate');
  fs.writeFileSync(P('native.el.srt'), '1\n00:00:01,000 --> 00:00:03,000\nΓεια σου <i>κόσμε</i>\n');
  assert.deepStrictEqual(m.subtitleFilesBeside(P('native.mp4')).map((x) => [x.name, x.lang]), [['native.el.srt', 'el']]);
  const vtt = await m.subtitles(P('native.mp4'), { subFile: P('native.el.srt') });
  assert.ok(vtt.startsWith('WEBVTT') && vtt.includes('00:01.000 --> 00:03.000') && vtt.includes('Γεια σου <i>κόσμε</i>'));
  ff(...SRC, '-i', P('native.el.srt'), '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=ell', P('subbed.mp4'));
  const sb = (await probe('subbed.mp4')).info;
  assert.strictEqual(sb.subs.length, 1); assert.strictEqual(sb.subs[0].lang, 'ell'); assert.ok(!sb.subs[0].bitmap);
  assert.ok((await m.subtitles(P('subbed.mp4'), { track: 0 })).includes('Γεια σου'));
  ok('subtitles beside the file and inside it come as WebVTT');
  const th = await m.thumb(P('native.mp4'), 1); assert.ok(th && th.length > 500 && th[0] === 0xff);
  ok('a thumbnail for the bar');

  console.log('waveform, cover, snapshot');
  const w = await m.waveform(P('tone.wav'), 0, 100, 4);
  assert.ok(w.length >= 95 && w.length <= 105, `${w.length} bins`); assert.ok(w.slice(0, -1).every((x) => x > 0.1 && x <= 1), `peaks ${w.slice(0, 3)}`);
  const silent = await m.waveform(P('clip.braw'), 0, 100, 4);
  assert.deepStrictEqual(silent, []);
  ok('peaks of a tone, nothing from what is not sound');
  const snap = await m.frameAt(P('native.mp4'), 1.5, P('frame.png'));
  assert.ok(fs.statSync(snap).size > 1000);
  assert.ok(fs.statSync(await m.frameAt(P('native.mp4'), 1.5, P('frame.jpg'))).size > 1000);
  await assert.rejects(m.frameAt(P('clip.braw'), 0, P('bad.png')));
  ok('a frame as PNG, an error on what cannot be read');

  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${n} checks passed`);
})().catch((e) => { console.error(e); fs.rmSync(T, { recursive: true, force: true }); process.exit(1); });
