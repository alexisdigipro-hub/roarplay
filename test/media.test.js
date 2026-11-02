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
  ff('-i', P('native.mp4'), '-i', P('native.el.srt'), '-map', '0', '-map', '1:s', '-c', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=ell', P('subbed.mp4'));
  const sb = (await probe('subbed.mp4')).info;
  assert.strictEqual(sb.subs.length, 1); assert.strictEqual(sb.subs[0].lang, 'ell'); assert.ok(!sb.subs[0].bitmap);
  assert.ok((await m.subtitles(P('subbed.mp4'), { track: 0 })).includes('Γεια σου'));
  ok('subtitles beside the file and inside it come as WebVTT');
  const th = await m.thumb(P('native.mp4'), 1); assert.ok(th && th.length > 500 && th[0] === 0xff);
  ok('a thumbnail for the bar');

  console.log('the packets, the QC report, a LUT');
  const pk = await m.packets(P('h264.mkv'), mk);
  assert.strictEqual(pk.t.length, 100); assert.strictEqual(pk.k.reduce((a, b) => a + b, 0), 4); assert.ok(pk.t.every((x, i) => i === 0 || x >= pk.t[i - 1]));
  assert.ok(pk.b.reduce((a, b) => a + b, 0) > 10, 'B-frames seen');
  const pf = m.packetFindings(pk, 25); assert.strictEqual(pf.length, 0); assert.strictEqual(pf.summary.keyframes, 4);
  ok('every packet in show order: keyframes, B-frames, sizes');
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25', '-f', 'lavfi', '-i', 'sine=f=300:sample_rate=48000', '-t', '8', '-vf', "drawbox=enable='between(t,2,3)':c=black:t=fill", '-af', "volume=enable='between(t,5,7.5)':volume=0", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', P('qc.mp4'));
  const q = await m.qc(P('qc.mp4'), (await probe('qc.mp4')).info);
  const kinds = q.findings.map((x) => x.kind);
  assert.ok(kinds.includes('black') && kinds.includes('silence'), kinds.join(','));
  const bl = q.findings.find((x) => x.kind === 'black'); assert.ok(Math.abs(bl.t - 2) < 0.1 && Math.abs(bl.end - 3) < 0.1);
  const sil = q.findings.find((x) => x.kind === 'silence'); assert.ok(Math.abs(sil.t - 5) < 0.1);
  assert.ok(typeof q.summary.integrated === 'number' && q.summary.integrated < -10 && q.summary.integrated > -40, `LUFS ${q.summary.integrated}`);
  assert.ok(typeof q.summary.truePeak === 'number');
  ok('black and silence found with their times, the loudness measured');
  const cube = m.parseCube('TITLE "x"\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n');
  assert.strictEqual(cube.size, 2); assert.strictEqual(cube.dim, 3); assert.strictEqual(cube.data.length, 24); assert.strictEqual(cube.title, 'x');
  assert.strictEqual(m.parseCube('LUT_1D_SIZE 2\n0 0 0\n1 1 1\n').dim, 1);
  assert.throws(() => m.parseCube('hello'));
  ok('a .cube read, 3D and 1D, and what is not one refused');

  console.log('Blackmagic RAW');
  assert.strictEqual(m.brawScale(2160, 1080), 2); assert.strictEqual(m.brawScale(4320, 1080), 4); assert.strictEqual(m.brawScale(1080, 1080), 1); assert.strictEqual(m.brawScale(6144, 0), 1); assert.strictEqual(m.brawScale(12288, 720), 8);
  const bi = { braw: { width: 6144, height: 3456, fps: 24, frames: 240, audio: { channels: 2, bits: 24, rate: 48000 } }, video: { fps: 24 }, audio: [{}] };
  const sv = m.brawSource('/x/A001.braw', bi, 'video', 2.5, 1080);
  assert.deepStrictEqual(sv.cmd, ['video', '/x/A001.braw', '60', '4', '709']); m.setBrawLook('lut'); assert.strictEqual(m.brawSource('/x/A001.braw', bi, 'video', 0, 1080).cmd[4], 'lut'); m.setBrawLook('nonsense'); assert.strictEqual(m.brawLook(), '709'); assert.ok(sv.input.join(' ').includes('-pix_fmt rgba -s 1536x864 -r 24 -i pipe:0'));
  const sa = m.brawSource('/x/A001.braw', bi, 'audio', 2.5, 1080);
  assert.deepStrictEqual(sa.cmd, ['audio', '/x/A001.braw', '120000']); assert.ok(sa.input.join(' ').includes('-f s24le -ar 48000 -ac 2 -i pipe:0'));
  assert.strictEqual(m.plan(bi, '/x/A001.braw').mode, 'transcode');
  assert.strictEqual(m.plan({ error: 'x', video: null, audio: [] }, '/x/A001.braw').why, 'raw');
  const sva = m.streamArgs('/x/A001.braw', bi, 'transcode', 2.5, { part: 'video' });
  assert.ok(!sva.includes('-ss') && sva.includes('pipe:0'));
  // a 17K clip: whatever the reader decodes, VideoToolbox gets no more than 4K, 1440p or 1080p (it stops at 4096x2304)
  const big = { braw: { width: 11680, height: 5360, fps: 24, frames: 48, audio: null }, video: { fps: 24 }, audio: [] };
  const vf = (h) => { const a = m.streamArgs('/x/A001.braw', big, 'transcode', 0, { part: 'video', hw: true, platform: 'darwin', maxH: h }); return a[a.indexOf('-vf') + 1] + ' ' + a[a.indexOf('-b:v') + 1]; };
  assert.ok(vf(5360).includes("min(iw,3840)':h='min(ih,2160)'") && vf(5360).endsWith('40M'), vf(5360));
  assert.ok(vf(2680).includes("min(iw,2560)':h='min(ih,1440)'"), vf(2680));
  assert.ok(vf(1340).includes("min(iw,1920)':h='min(ih,1080)'") && vf(1340).endsWith('16M'), vf(1340));
  assert.ok(vf(670).includes("min(iw,1920)'") && m.brawSource('/x/A001.braw', big, 'video', 0, 670).input.join(' ').includes('-s 1460x670'));
  ok('a BRAW clip: the reader\'s frame, scale and sample, ffmpeg reading its pipe, the picture boxed for the encoder');
  const ri = { braw: { reader: 'r3d', width: 6144, height: 3240, fps: 24, frames: 100, audio: { channels: 2, bits: 32, rate: 48000 } }, video: { fps: 24 }, audio: [{}] };
  const rv = m.brawSource('/x/A037.R3D', ri, 'video', 1, 1080);
  assert.deepStrictEqual(rv.cmd, ['video', '/x/A037.R3D', '24', '4']); assert.ok(rv.input.join(' ').includes('-pix_fmt bgra -s 1536x810'));
  assert.ok(m.brawSource('/x/A037.R3D', ri, 'audio', 0, 1080).input.join(' ').includes('-f s32le -ar 48000 -ac 2'));
  assert.ok(m.isR3d('/x/A.R3D') && m.isR3d('/x/b.nev') && !m.isR3d('/x/c.mov'));
  ok('a RED clip: BGRA frames at a quarter, 32-bit sound');

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
