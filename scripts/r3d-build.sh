#!/bin/bash
# The RED R3D reader for a Mac build (helper/r3d.cpp): the SDK from the draft release sdk-r3d (Alex sent it with
# RoarTransfer; the sdk.yml workflow keeps it), built universal, with RED's redistributable libraries beside it.
# Proved on Alex's own clip when the draft release sdk-r3d-clip holds one.
# Leaves build/helper/roarplay-r3d and build/helper/REDR3D*.dylib for the app's Resources/bin.
set -euo pipefail
cd "$(dirname "$0")/.."
W=$(mktemp -d)
gh release download sdk-r3d -R "${GITHUB_REPOSITORY:-alexisdigipro-hub/roarplay}" -D "$W/zip"
(cd "$W" && unzip -q "$(ls zip/*.zip | sort -V | tail -1)")
SDK=$(ls -d "$W"/R3DSDK* | head -1); echo "SDK: $SDK"
ls "$SDK/Lib" "$SDK/Lib/mac64" "$SDK/Redistributable" "$SDK/Redistributable/mac" 2>/dev/null || true
LIB=$(ls "$SDK"/Lib/mac64/libR3DSDK-libcpp*.a 2>/dev/null | head -1); echo "lib: $LIB"; lipo -info "$LIB" || true
# how RED's own Mac samples link
find "$SDK/Sample code" -iname "makefile*" | head -3 | while read -r m; do echo "== $m"; grep -i "mac\|darwin\|framework\|LDFLAGS\|LIBS" "$m" | head -12; done || true
mkdir -p build/helper
rm -f build/helper/roarplay-r3d build/helper/REDR3D*.dylib build/helper/RED*.dylib
cp "$SDK"/Redistributable/mac/*.dylib build/helper/
ARCHS=$(lipo -archs "$LIB" 2>/dev/null || echo "arm64 x86_64")
OUTS=()
for arch in $ARCHS; do
  clang++ -std=c++17 -O2 -arch "$arch" -mmacosx-version-min=11.0 -I "$SDK/Include" helper/r3d.cpp "$LIB" \
    -framework CoreFoundation -framework Foundation -framework IOKit -framework CoreVideo -framework Metal -framework OpenCL \
    -lc++ -o "$W/roarplay-r3d-$arch"
  OUTS+=("$W/roarplay-r3d-$arch")
done
lipo -create -output build/helper/roarplay-r3d "${OUTS[@]}"
lipo -info build/helper/roarplay-r3d
for f in build/helper/roarplay-r3d build/helper/*.dylib; do codesign --force --sign - "$f"; done
ls -la build/helper
# proof on Alex's clip, if there is one: facts, a frame at a quarter through ffmpeg, a second of sound
if gh release download sdk-r3d-clip -R "${GITHUB_REPOSITORY:-alexisdigipro-hub/roarplay}" -D "$W/clip" 2>/dev/null; then
  for P in "$W"/clip/*.part-aa; do if [ -e "$P" ]; then cat "${P%.part-aa}".part-* > "${P%.part-aa}" && rm "${P%.part-aa}".part-*; fi; done
  set +o pipefail # head stops the reader early on purpose
  C=$(ls "$W"/clip/*.R3D "$W"/clip/*.r3d 2>/dev/null | head -1)
  INFO=$(build/helper/roarplay-r3d info "$C"); echo "info: $INFO"
  WH=$(node -e "const i=JSON.parse(process.argv[1]); console.log(Math.floor(i.width/4)+'x'+Math.floor(i.height/4))" "$INFO")
  WANT=$(node -e "const [w,h]=process.argv[1].split('x'); console.log(w*h*4)" "$WH")
  GOT=$(build/helper/roarplay-r3d video "$C" 0 4 | head -c "$WANT" | wc -c | tr -d ' ')
  echo "quarter: $GOT bytes, want $WANT"; test "$GOT" = "$WANT"
  FF=${FFMPEG:-vendor/ffmpeg/darwin-$(uname -m | sed s/x86_64/x64/)/ffmpeg}
  build/helper/roarplay-r3d video "$C" 0 4 | "$FF" -hide_banner -loglevel error -y -f rawvideo -pix_fmt bgra -s "$WH" -i pipe:0 -frames:v 1 "$W/r3d.png"
  test -s "$W/r3d.png"
  build/helper/roarplay-r3d audio "$C" 0 | head -c 192000 | wc -c
fi
echo "RED R3D reader: ok"
