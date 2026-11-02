#!/bin/bash
# The Blackmagic RAW reader for a Mac build (helper/braw.cpp): the SDK from the draft release sdk-braw (Alex sends it
# with RoarTransfer; the sdk.yml workflow keeps it), built universal, then proved on the SDK's own sample clip.
# Leaves build/helper/roarplay-braw and build/helper/BlackmagicRawAPI.framework for the app's Resources/bin.
set -euo pipefail
cd "$(dirname "$0")/.."
W=$(mktemp -d)
gh release download sdk-braw -R "${GITHUB_REPOSITORY:-alexisdigipro-hub/roarplay}" -D "$W/zip"
# the newest SDK kept there (Alex sent 4.3.1, then 6.0 for clips from newer cameras)
Z=$(ls "$W"/zip/*.zip | sort -V | tail -1); echo "SDK zip: $Z"
(cd "$W/zip" && unzip -q "$Z")
hdiutil attach -nobrowse -readonly -mountpoint "$W/dmg" "$(ls "$W"/zip/*.dmg | sort -V | tail -1)" >/dev/null
pkgutil --expand-full "$(ls "$W"/dmg/*.pkg | head -1)" "$W/pkg"
hdiutil detach "$W/dmg" -quiet || true
SDK=$(find "$W/pkg" -type d -name "Blackmagic RAW SDK" | head -1)
echo "SDK: $SDK"
mkdir -p build/helper
rm -rf build/helper/BlackmagicRawAPI.framework
ditto "$SDK/Mac/Libraries/BlackmagicRawAPI.framework" build/helper/BlackmagicRawAPI.framework
lipo -info build/helper/BlackmagicRawAPI.framework/BlackmagicRawAPI || true
# the GPU parts of the header the reader uses (Metal, 2 Nov), printed so a build that fails says why
H="$SDK/Mac/Include/BlackmagicRawAPI.h"
grep -n "CreatePipelineDeviceIterator\|SetFromDevice\|GetResourceManager\|GetResourceHostPointer\|blackmagicRawPipelineMetal\|blackmagicRawInteropNone\|IID_IBlackmagicRawConfigurationEx\|class BMD_PUBLIC IBlackmagicRawPipelineDevice\b" "$H" | head -30 || true
grep -n "class BMD_PUBLIC IBlackmagicRawPipelineDevice " -A 16 "$H" || true
grep -n "class BMD_PUBLIC IBlackmagicRawResourceManager" -A 12 "$H" || true
grep -n "blackmagicRawResourceUsage" "$H" | head || true
for arch in arm64 x86_64; do
  clang++ -std=c++17 -O2 -arch "$arch" -mmacosx-version-min=11.0 -I "$SDK/Mac/Include" \
    helper/braw.cpp "$SDK/Mac/Include/BlackmagicRawAPIDispatch.cpp" \
    -framework CoreFoundation -framework CoreServices -o "$W/roarplay-braw-$arch"
done
lipo -create -output build/helper/roarplay-braw "$W/roarplay-braw-arm64" "$W/roarplay-braw-x86_64"
codesign --force --sign - build/helper/roarplay-braw
codesign --force --deep --sign - build/helper/BlackmagicRawAPI.framework
# proof on the SDK's sample clip: its facts, one frame through ffmpeg as a PNG, a second of its sound
SAMPLE="$SDK/Media/sample.braw"
INFO=$(build/helper/roarplay-braw info "$SAMPLE"); echo "info: $INFO"
W2=$(node -e "const i=JSON.parse(process.argv[1]); console.log(Math.floor(i.width/4)+'x'+Math.floor(i.height/4))" "$INFO")
FF=${FFMPEG:-vendor/ffmpeg/darwin-$(uname -m | sed s/x86_64/x64/)/ffmpeg}
build/helper/roarplay-braw video "$SAMPLE" 0 4 | "$FF" -hide_banner -loglevel error -y -f rawvideo -pix_fmt rgba -s "$W2" -i pipe:0 -frames:v 1 "$W/frame.png"
ls -la "$W/frame.png"; test -s "$W/frame.png"
# every scale hands ffmpeg exactly the bytes of the size media.js tells it, or the picture shears
for S in 1 2 4 8; do
  WANT=$(node -e "const i=JSON.parse(process.argv[1]),s=+process.argv[2]; console.log(Math.floor(i.width/s)*Math.floor(i.height/s)*4*Math.max(1,i.frames))" "$INFO" "$S")
  GOT=$(build/helper/roarplay-braw video "$SAMPLE" 0 "$S" | wc -c | tr -d ' ')
  echo "scale $S: $GOT bytes, want $WANT"; test "$GOT" = "$WANT"
done
# the colours (Rec.709, the camera's LUT, as shot): each gives a whole frame, each a picture to look at
for L in 709 lut shot; do
  build/helper/roarplay-braw video "$SAMPLE" 0 4 "$L" | "$FF" -hide_banner -loglevel error -y -f rawvideo -pix_fmt rgba -s "$W2" -i pipe:0 -frames:v 1 "$W/look-$L.png"
  test -s "$W/look-$L.png"
done
if node -e "process.exit(JSON.parse(process.argv[1]).audio.channels ? 0 : 1)" "$INFO"; then
  build/helper/roarplay-braw audio "$SAMPLE" 0 | head -c 192000 | wc -c
fi
echo "Blackmagic RAW reader: ok"
