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
- **VJ and LED-wall codecs**: Resolume DXV (every quality, with or without alpha), HAP, NotchLC.
- **Image sequences**: DPX, EXR, PNG, TIFF, JPEG, DNG (CinemaDNG) numbered frames play as one clip, at 24, 25 or 30 fps (Settings).
- **Web addresses**: a direct http(s) link to a video or sound file (Cmd/Ctrl+U, or drop the link on the window).
- **Blackmagic RAW** (.braw, on a Mac): decoded by Blackmagic's own SDK (6.0, every camera up to URSA Cine 17K and
  PYXIS 12K), at the size the screen needs, with its timecode, its sound, the camera's name, frame steps, In/Out, saved
  frames. Colour (Settings > Playing > Blackmagic RAW colour): Rec.709 (the default), the camera's LUT, or as shot.
  Info shows the clip's gamma, gamut, LUT and the sizes it decodes at.
- **REDCODE RAW** (.R3D, on a Mac, since 0.5.0): decoded by RED's own SDK (9.2.1), the same way: the size the screen
  needs, timecode, sound, the camera's name.
- **Camera RAW resolution** (since 0.5.1, Alex: "no reason to play it full"): a **Full / Half / Low / Proxy** button in the bar, only
  for BRAW and R3D clips, decodes at 1/1, 1/2, 1/4 or 1/8 of the clip's size (Proxy since 0.5.2); Half to start with. A press goes on from the same frame.
- **Smooth RAW** (0.5.2, Alex: "make it play like oil"): Blackmagic RAW is decoded on the Mac's GPU (Metal), as Resolve
  does, with the CPU as before when Metal is not there; the picture is then made H.264 no larger than 4K (Full), 1440p
  (Half) or 1080p (Low, Proxy), so the Mac's own encoder always takes it (it stops at 4096x2304: Half of a 12K or 17K clip
  used to fall back to the slow software encoder).
- **Not yet**: ARRIRAW, Canon RAW, Nikon N-RAW, and BRAW and R3D on Windows. RoarPlay says which tool opens each.

What the computer decodes itself (H.264, HEVC, VP9, AV1; AAC, MP3, FLAC, Opus, WAV) plays as it is. Everything else is
made playable by ffmpeg while it plays, on your own computer, with nothing written to disk: a picture the computer can
decode in a wrapper it cannot read (H.264 in MKV, AVI, TS) is only re-wrapped; a picture it cannot decode (ProRes,
DNxHR, MPEG-2…) is made H.264 on the fly (with the Mac's own encoder), at 1080p for smooth playing on every computer
(Settings > Full keeps the size); sound the computer cannot play comes as FLAC, lossless. The Info tab says which of
these is happening.

## The player

- **Turn** (since 0.5.1): the round-arrow button beside Picture turns the picture 90° at each press, fitted whole in the
  window; Picture > Turn keeps 0°, 90°, 180°, 270° and the flips.

- **Clock**: timecode from the file's own (01:00:00:00, drop-frame as 01:00:00;00), or time, or frames. Click it to switch.
- **J K L** as in the edit suite: J back, L forward, faster with each press (up to 8×), K stops. K held with J or L: one frame.
- **Arrows**: one frame back or forward; with Shift, one second. Home and End.
- **I and O** mark in and out; Shift+I / Shift+O go there; `/` plays from in to out; Cmd/Ctrl+L loops; Alt+X clears.
- **Cmd/Ctrl+Shift+S** (or the camera) saves the frame on screen as a PNG, full size, beside the file, named with its timecode.
  The In and Out handles on the bar clear with a click; the × beside them clears both.
- **Subtitles** (S, or the subtitle button): the tracks inside the file (MKV, MOV, MP4) and any .srt/.ass/.vtt/.sub beside
  it (Film.srt, Film.el.srt), or a file you pick; three sizes; delay in half seconds. Bitmap subtitles (DVD, Blu-ray) are
  named but cannot be shown.
- **Speed** 0.25× to 4× (the 1× button, or [ and ], \ for normal), the voices keeping their pitch.
- **Chapters**: ticks on the bar with their names, Page Up and Page Down, the list in Info.
- **Picture** (the frame button, behind ⋯): Fit, Fill or 1:1; an aspect (2.39, 2.00, 1.85, 16:9, 4:3, 1:1, 4:5, 9:16) that
  reshapes the window itself and fills it with the picture (in full screen or the bezel, dark bands show the frame instead);
  zoom; turn, mirror, upside down; brightness, contrast, saturation. The window takes the picture's shape when a file
  opens and keeps it while you resize (can be turned off).
- **Sound** (the bars button): the sound track; what you hear (stereo, left only, right only, mono, swapped); a delay in
  50 ms steps; the output device; a ten-band equalizer with presets.
- **Sound files** show the album picture, the title and the artist, and a waveform you can scrub.
- **Queue**: drop files and folders (folders open in name order); the next file plays when one ends (or Stop, or Repeat,
  in Settings); shuffle; the list is kept for next time and can be saved as M3U (and M3U files open as a list).
  Cmd/Ctrl+← → go to the previous and next file. A file stopped in the middle opens there again (can be turned off).
- **Thumbnails** on the bar as the mouse moves over it.
- **Info**: everything the file says: wrapper and its tags, every stream (picture: codec, profile, pixel format, range,
  primaries, transfer, matrix, aspect ratios, bitrate, rates; sound: codec, rate, channels, sample format; subtitles,
  data and timecode tracks, attachments) with its tags, flags and side data, chapters, dates, and the whole ffmpeg
  report. Copy all puts it on the clipboard.
- **Small bezel** (B, or the bezel button): only the picture inside a thin frame, no bars; a small bar with play, the
  clock, Always on top and the way back comes when the mouse moves. Picture in picture with P.
- **Full screen** with F or a double click; the controls hide when the mouse rests.
- **Minimal by default**: the row shows the clock, In and Out, the frame steps, J, play, L, the volume, the bezel and full
  screen; everything else (loop, speed, subtitles, picture, sound, the saved frame, picture in picture) sits behind ⋯.
  While a file plays and the mouse rests, every control fades and only the picture stays (Settings > Window).
- **Open with RoarPlay** (Settings): turn on groups of kinds (common video, camera and broadcast, music, studio sound…)
  or single kinds, press Apply once. RoarPlay asks the Mac first for the general kinds (two confirmations), then only for
  what is still missing, and shows which kinds already open with it. On Windows the system's Default apps page opens.
- **Settings** in pages: General, Playing, Picture, Sound, Subtitles, Window, Saved frames, Open with RoarPlay, Keys,
  with the list kept or not, play on open, the Shift jump, the look and the sound kept from file to file, a preferred
  subtitle language, the fade delay, the side at start, the bezel on top, the saved frame's name.
- A stream starts playing once two seconds have come, and the window takes its shape before it starts, so the first
  seconds do not stutter.

## The professional side (Scopes and Notes tabs)

- **Meters** per channel (sample peak, with a peak hold) and **loudness** as EBU R128 measures it: momentary, short-term,
  integrated (gated), loudness range and peak, of what you hear. A button starts the integrated reading again.
- **Scopes** of the picture on screen: luma waveform, RGB parade, vectorscope (with the 75% targets), histogram.
- **GOP**: read the packets once (no decoding) and see every frame around the playhead as I, P or B, the keyframes on
  the bar, the bitrate over the whole file, the average GOP.
- **QC report**: one pass over the whole file finds black stretches, frozen picture, silence, missing frames and decode
  errors, each with its time (a click goes there), and measures the loudness (integrated, range, true peak). Save it as text.
- **LUT**: a .cube (3D or 1D, from Resolve or any grading tool) on the picture, with an amount slider, through the GPU.
- **Compare**: a second file over the first, as a wipe you drag or side by side, locked to the first's clock, with an
  offset in frames.
- **Notes**: a rating (1 to 5, the number keys) and markers with a note (N at the frame on screen), shown on the bar,
  saved as CSV or as an EDL that DaVinci Resolve imports as timeline markers.
- **Hear**: with 5.1 sound, the centre alone (dialogue) or the surrounds alone, besides left, right, mono and swapped.
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
