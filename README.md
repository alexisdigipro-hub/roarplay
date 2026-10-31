# RoarPlay

**Plays everything.** Every video and every sound file, on your own computer. The Mad Lions Lab.

Download: [Mac with Apple Silicon](https://github.com/alexisdigipro-hub/roarplay/releases/latest/download/RoarPlay-Mac-arm64.dmg) ·
[Mac with Intel](https://github.com/alexisdigipro-hub/roarplay/releases/latest/download/RoarPlay-Mac-x64.dmg) ·
[Windows](https://github.com/alexisdigipro-hub/roarplay/releases/latest/download/RoarPlay-Windows-Setup.exe)

First open on a Mac: right-click RoarPlay > Open (or System Settings > Privacy & Security > Open Anyway), once.
RoarPlay offers to move itself to Applications; from there it updates itself.

## What it plays

- **Video**: MP4, MOV, M4V, MKV, WebM, AVI, WMV, FLV, MPEG-1/2 (MPG, VOB, TS, MTS, M2TS), 3GP, OGV, MXF, DV, GIF, and
  everything else ffmpeg reads. Codecs: H.264, HEVC, VP8/9, AV1, ProRes (every flavour), DNxHD and DNxHR, XDCAM, MPEG-2,
  MPEG-4, DV, MJPEG, Cinepak, and the rest.
- **Sound**: MP3, WAV (and BWF), AIFF, FLAC, ALAC, AAC/M4A, Ogg, Opus, WMA, AC3, E-AC3, DTS, APE, WavPack, AMR, CAF, and more.
- **Not yet**: camera RAW (Blackmagic RAW, REDCODE, ARRIRAW, Canon RAW, Nikon N-RAW). RoarPlay says which tool opens each.

What the computer decodes itself (H.264, HEVC, VP9, AV1; AAC, MP3, FLAC, Opus, WAV) plays as it is. Everything else is
made playable by ffmpeg while it plays, on your own computer, with nothing written to disk: a picture the computer can
decode in a wrapper it cannot read (H.264 in MKV, AVI, TS) is only re-wrapped; a picture it cannot decode (ProRes,
DNxHR, MPEG-2…) is made H.264 on the fly (with the Mac's own encoder); sound the computer cannot play comes as FLAC,
lossless. The Info tab says which of these is happening.

## The player

- **Clock**: timecode from the file's own (01:00:00:00, drop-frame as 01:00:00;00), or time, or frames. Click it to switch.
- **J K L** as in the edit suite: J back, L forward, faster with each press (up to 8×), K stops. K held with J or L: one frame.
- **Arrows**: one frame back or forward; with Shift, one second. Home and End.
- **I and O** mark in and out; Shift+I / Shift+O go there; `/` plays from in to out; Cmd/Ctrl+L loops; Alt+X clears.
- **Cmd/Ctrl+Shift+S** (or the camera) saves the frame on screen as a PNG, full size, beside the file, named with its timecode.
- **Sound files** show the album picture, the title and the artist, and a waveform you can scrub.
- **Several sound tracks**: choose one in Info (language, codec, channels).
- **Queue**: drop files and folders (folders open in name order); the next file plays when one ends (or Stop, or Repeat,
  in Settings). Cmd/Ctrl+← → go to the previous and next file.
- **Info**: wrapper, length, bitrate, timecode, codec and profile, frame size, frame rate, colour, interlacing, sound codec,
  sample rate, bit depth, channels, subtitles.
- **Full screen** with F or a double click; the controls hide when the mouse rests.
- Double-click a file in the Finder or Explorer, or drop it on the app, and RoarPlay opens it.
- **Settings** (the gear, Cmd/Ctrl+,): English or Greek, what happens at the end of a file, what the clock shows,
  automatic updates, the list of keys.

## For developers

Electron, no build step, no dependencies beyond Electron itself; ffmpeg comes as a static binary per platform.

```bash
npm install          # also fetches ffmpeg for this computer into vendor/
npm start
npm test             # the engine on real files made with ffmpeg
```

A release: bump `version` in package.json, tag `vX.Y.Z`, push the tag. The workflow builds the Mac (.dmg, Apple Silicon
and Intel) and Windows (.exe) installers and puts them on a GitHub release, which is where the app's updater looks.
