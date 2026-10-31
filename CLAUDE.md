# RoarPlay · instructions for Claude Code

RoarPlay plays every video and every sound file on your own computer: ProRes, DNxHD/HR, MXF, MKV, AVI, MPEG-2, WAV, FLAC,
AC3, AIFF and the rest, with a director's transport (timecode, J K L, frame steps, in and out, a frame as PNG).
The Mad Lions Lab (Alex Konstantinidis, film director, Athens; not a developer). Talk to him in Greek, friendly and
concrete, no em dashes; the app's own text is English by default, with Greek as a choice (renderer.js: `t()` and the
`EL` table, English text as the key; in index.html `data-i18n`, `data-i18n-html`, `data-i18n-label`). Every new text
goes through `t()` or a data-i18n attribute and gets its Greek.

- Electron app (Mac and Windows), no build step: `src/index.html`, `renderer.js`, `styles.css` are the page;
  `src/main.js` the window, the IPC and the `rp://` protocol; `src/preload.js` what the page may ask; `src/updater.js`
  the self-update (from the newest GitHub release, Restart to update, and the offer to move itself to Applications).
- `src/media.js` is the engine, plain Node around ffmpeg (no ffprobe: `ffmpeg -i` is read): `probe` (what a file is
  made of), `plan` (how it is played: native / remux / transcode / audio / none), `streamArgs` + `mimeOf` (the ffmpeg
  that plays it and what the window is told), `firstPacket` (the keyframe a copied picture starts at), `waveform`,
  `cover`, `frameAt`. Change it only with `npm test` passing (`FFMPEG=/usr/bin/ffmpeg npm test` where npm cannot install).
- How it plays: what the window decodes itself (H.264, HEVC on Mac and Windows, VP9, AV1; AAC, MP3, FLAC, Opus, PCM) is the
  `<video>`'s src. Everything else comes in pieces through a Media Source: the picture and the sound each from their own
  ffmpeg (`rp://play/<id>`, a fragmented MP4 whose zero `timestampOffset` puts at its place in the file), each started
  again at a seek outside what has come, never more than `AHEAD` seconds ahead (renderer.js feed / keepFed). A copied
  picture (remux) keeps its own codec; a made-again one is H.264 (VideoToolbox on a Mac, x264 elsewhere); sound is AAC
  for a film, FLAC for a sound file. Camera RAW (BRAW, R3D, ARRIRAW…) is refused with the name of the tool that opens it.
- Frames and timecode count from the file's first frame (`info.phase`, firstPacket at 0); the frame on screen is
  `shownTime` (requestVideoFrameCallback), the steps and the marks go from it; drop-frame when the file's timecode has `;`.
- ffmpeg is a static binary per platform in `vendor/ffmpeg/<platform>-<arch>/` (scripts/fetch-ffmpeg.js, run by
  `npm install`); packaged as `resources/bin/ffmpeg`. The Mac build makes arm64 and x64 from one machine.
- Look: RoarMail's Simba as the other Lab apps (floating graphite glass cards, red #d40000 that glows, the chosen thing
  lit from inside, 12px corners, Jost wordmark from src/fonts). Keep it in step with RoarMorph's theme.css.
- Settings (the gear, Cmd/Ctrl+,): language, what happens at the end of a file, what the clock shows, playing quality
  (1080p or full), sequence fps, resume, the window, saved frames, Open with RoarPlay, updates, the keys. New settings go
  there, as a DEFAULTS key in renderer.js.
- 0.2.0 (Alex, 31 Oct, from the players' comparison): subtitles (media.js subtitles -> WebVTT, drawn by the page in #subs,
  tracks inside and files beside), speed with pitch kept, chapters, the Picture popover (fit/fill/1:1, aspect mask #mask,
  zoom, turn, look as CSS filter; the window takes the picture's shape through main.js 'fit' = setAspectRatio), the Sound
  popover (Web Audio graph in renderer.js audioStart: channel gains, delay, 10 biquads; output device by setSinkId),
  resume positions, the queue kept and as M3U, thumbnails on the bar (media.js thumb), image sequences (media.js
  sequenceOf / inputArgs), web addresses, picture in picture, always on top, the small bezel (body.compact, main.js
  'compact'), full Info (media.js parseDetail), Open with RoarPlay (helper/setdefault.swift built in CI, Resources/bin).
- 0.3.0 (the professional side, Alex 31 Oct): the player is an object (`main`, and `B` for the compare) so startAt / feed /
  keepFed / closeMse take a player; Scopes tab: meters and loudness (src/lufs-worklet.js, K-weighting and 100 ms blocks;
  renderer.js onLufsBlock gates and sums), scopes from a 192px copy of the frame (drawScopeNow), GOP and bitrate from
  media.js packets (framecrc, no decoding), the QC report from media.js qc (blackdetect, freezedetect, silencedetect,
  ebur128, decode errors) plus packet gaps; Notes tab: rating and markers in localStorage 'notes', CSV and EDL out
  (main.js save-text); LUT: media.js parseCube, a WebGL2 3D texture in #glc over the video (applyLut / drawLutFrame);
  compare: B player over A, wipe or side by side, syncB every 300 ms; six-channel downmix in applyAudio.
- 0.4.0 Blackmagic RAW (Alex, 31 Oct): helper/braw.cpp against the Blackmagic RAW SDK, which is never in the repo: Alex
  sends it with RoarTransfer, `.github/workflows/sdk.yml` (manual, token + name) copies it into the draft release
  `sdk-braw`, `scripts/braw-build.sh` (desktop.yml and braw-check.yml, Mac) builds the reader universal and proves it
  on the SDK's sample.braw. Shipped as Resources/bin/roarplay-braw with BlackmagicRawAPI.framework beside it. media.js:
  probeBraw, brawSource (reader args + ffmpeg rawvideo / PCM input), brawScale; main.js pipes the reader into ffmpeg.
- 0.4.1 to 0.4.5 (Alex, 31 Oct, on his own clips): the quarantine mark is taken off Resources/bin at start; the build
  takes the newest SDK zip (BRAW 6.0); the BRAW colour (Settings > Playing: Rec.709 / camera LUT / as shot, braw.cpp
  lookFor, media.js setBrawLook); braw.cpp toRGBA makes any SDK output the size ffmpeg was told, and rows are packed
  (the SDK rounds the buffer up to 4 KB pages: size / height is not the row length; this was the stripes on URSA Cine).
- 0.5.0 RED R3D: helper/r3d.cpp, scripts/r3d-build.sh (universal, RED's dylibs beside it), SDK in draft release sdk-r3d.
  media.js carries a RED clip as info.braw with reader 'r3d' (readerPath, BGRA, s32le), one path for both readers.
- Camera clips to prove on: Alex sends them with RoarTransfer, sdk.yml (name braw-clip / r3d-clip) keeps them in
  draft releases (over 2 GB in parts); braw-check.yml and r3d-check.yml decode them at every scale and print a small
  picture as base64 between ==LOOK== markers, to be looked at before a release. Never ship a camera fix unseen.
- Releases: bump `version` in package.json, tag `vX.Y.Z`, push the tag (.github/workflows/desktop.yml); the release's
  files are the download links (themadlions.com/lab/roarplay/) and what src/updater.js looks at.
- Work on a branch, open a PR, wait for the green check (.github/workflows/check.yml), merge it yourself.
