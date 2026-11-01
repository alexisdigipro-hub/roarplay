# RoarPlay · where we stopped (1 Nov 2026)

Start a new session by reading this, CLAUDE.md and README.md. Talk to Alex in Greek, friendly and concrete, no em dashes.

## Done (31 Oct to 1 Nov 2026)
- 0.1.0 to 0.3.2: the player, the pro side (scopes, loudness, QC, LUT, compare, notes), the minimal row, the bezel,
  Settings in pages, Open with RoarPlay as groups, a smooth start. Lab page at themadlions.com/lab/roarplay/.
- 0.4.0 to 0.4.5 Blackmagic RAW on the Mac: SDK 6.0 (draft release sdk-braw), colour Rec.709 / camera LUT / as shot,
  the stripes on URSA Cine / PYXIS fixed (the SDK pads the frame buffer to 4 KB pages; rows are packed).
  Proved in CI on Alex's clip A001_07061344_C106.braw (URSA Cine 17K 65, 11680x5360; draft release sdk-braw-clip).
  That clip decodes upside down while its metadata says rotation = 0: Alex is to say how it looks in Resolve.
- 0.5.0 RED R3D on the Mac: SDK 9.2.1 (draft release sdk-r3d), helper/r3d.cpp, scripts/r3d-build.sh. Proved on
  Alex's clip A037_C062_02253S_001.R3D (KOMODO 6K, 6144x3240; draft release sdk-r3d-clip), also inside the packed app.

## Alex still has to
- Update to 0.5.0 (Restart to update) and check: the BRAW clips (A001, the A038 ones from PYXIS 12K) without stripes,
  and the R3D clip with picture and sound. He wants to check himself before the Lab page says BRAW and RED play.

## Next
- When Alex confirms: update the Lab page (themadlions-projects public/site/lab/roarplay/, then themadlions-site) to
  say Blackmagic RAW and RED play on a Mac.
- Offered, not asked yet: Rec.709 for R3D (RED's ImageProcessingSettings), as BRAW has.
- Not yet: BRAW and R3D on Windows (needs Blackmagic's Windows SDK; the R3D SDK already has win64), ARRIRAW, Canon RAW.
- Leftover draft releases sdk-inbox, sdk-inbox2 can be deleted.

## How a camera fix is proved
Alex sends a clip with RoarTransfer; run sdk.yml with the link and name braw-clip or r3d-clip; braw-check.yml /
r3d-check.yml decode it at every scale and print a small JPEG as base64 between ==LOOK== markers: decode it and look
at it before any release. Never ship a camera fix unseen.
