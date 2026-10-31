// RoarPlay's RED R3D reader (0.5, Alex 31 Oct), built in CI against the RED R3D SDK (kept in the draft release sdk-r3d,
// never in this repository) and shipped as Resources/bin/roarplay-r3d with the SDK's redistributable libraries beside
// it. The R3D SDK also reads Nikon N-RAW (.nev). The SDK decodes; this only hands ffmpeg what it decoded:
//   roarplay-r3d info  <clip>                         one line of JSON: size, rate, frames, timecode, camera, sound
//   roarplay-r3d video <clip> <first frame> <scale>   raw BGRA frames on stdout, one after another (scale 1, 2, 4, 8)
//   roarplay-r3d audio <clip> <first sample>          the sound as raw signed 32-bit little-endian PCM on stdout
// main.js runs it and pipes its stdout into an ffmpeg that reads rawvideo / PCM, as any other source.
#include "R3DSDK.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <windows.h>
#else
#include <unistd.h>
#endif
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

using namespace R3DSDK;

static int fail(const char* what) { fprintf(stderr, "%s\n", what); return 1; }

// the folder this program sits in: the SDK's libraries are beside it (or where ROARPLAY_R3D_LIBS says)
static std::string selfDir() {
  if (const char* env = getenv("ROARPLAY_R3D_LIBS")) return env;
  char buf[4096] = {0};
#if defined(_WIN32)
  GetModuleFileNameA(nullptr, buf, sizeof buf);
  std::string p = buf; return p.substr(0, p.find_last_of("\\/"));
#elif defined(__APPLE__)
  uint32_t n = sizeof buf; _NSGetExecutablePath(buf, &n);
  std::string p = buf; return p.substr(0, p.rfind('/'));
#else
  ssize_t n = readlink("/proc/self/exe", buf, sizeof buf - 1); if (n > 0) buf[n] = 0;
  std::string p = buf; return p.substr(0, p.rfind('/'));
#endif
}

static void* aligned(size_t size, size_t align) {
#ifdef _WIN32
  return _aligned_malloc(size, align);
#else
  void* p = nullptr; return posix_memalign(&p, align, size) == 0 ? p : nullptr;
#endif
}
static void unaligned(void* p) {
#ifdef _WIN32
  _aligned_free(p);
#else
  free(p);
#endif
}

static std::string esc(const char* s) {
  std::string o;
  for (; s && *s; s++) { if (*s == '"' || *s == '\\') o += '\\'; if ((unsigned char)*s >= 32) o += *s; }
  return o;
}

int main(int argc, char** argv) {
#ifdef _WIN32
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  if (argc < 3) return fail("usage: roarplay-r3d info|video|audio <clip> ...");
  std::string cmd = argv[1];
  // CPU decoding only: REDR3D and REDDecoder from the folder beside this program
  if (InitializeSdk(selfDir().c_str(), OPTION_RED_NONE) != ISInitializeOK) return fail("The RED R3D libraries are missing");
  Clip* clip = new Clip(argv[2]);
  if (clip->Status() != LSClipLoaded) { delete clip; FinalizeSdk(); return fail("Not a RED or N-RAW clip, or it cannot be read"); }

  const size_t w = clip->Width(), h = clip->Height();
  const float fps = clip->VideoAudioFramerate();
  const size_t frames = clip->VideoFrameCount();

  if (cmd == "info") {
    const char* tc = clip->Timecode(0);
    std::string camera;
    if (clip->MetadataExists(RMD_CAMERA_MODEL)) camera = clip->MetadataItemAsString(RMD_CAMERA_MODEL);
    printf("{\"width\":%zu,\"height\":%zu,\"fps\":%.6f,\"frames\":%zu,\"timecode\":\"%s\",\"camera\":\"%s\",\"audio\":{\"channels\":%zu,\"bits\":32,\"rate\":%zu,\"samples\":%llu}}\n",
           w, h, fps, frames, esc(tc).c_str(), esc(camera.c_str()).c_str(), clip->AudioChannelCount(), (size_t)clip->AudioSampleRate(),
           (unsigned long long)clip->AudioSampleCount());
    delete clip; FinalizeSdk(); return 0;
  }

  if (cmd == "video") {
    size_t first = argc > 3 ? strtoull(argv[3], nullptr, 10) : 0;
    if (frames && first >= frames) first = frames - 1;
    int s = argc > 4 ? atoi(argv[4]) : 1;
    VideoDecodeMode mode = s >= 8 ? DECODE_EIGHT_RES_GOOD : s >= 4 ? DECODE_QUARTER_RES_GOOD : s >= 2 ? DECODE_HALF_RES_GOOD : DECODE_FULL_RES_PREMIUM;
    const size_t ow = w / (s >= 8 ? 8 : s >= 4 ? 4 : s >= 2 ? 2 : 1), oh = h / (s >= 8 ? 8 : s >= 4 ? 4 : s >= 2 ? 2 : 1);
    const size_t row = ow * 4, size = row * oh;
    uint8_t* buf = (uint8_t*)aligned(size, 16);
    if (!buf) return fail("Out of memory");
    ImageProcessingSettings ips;
    clip->GetDefaultImageProcessingSettings(ips);
    VideoDecodeJob job;
    job.Mode = mode;
    job.PixelType = PixelType_8Bit_BGRA_Interleaved;
    job.BytesPerRow = row;
    job.OutputBuffer = buf;
    job.OutputBufferSize = size;
    job.ImageProcessing = &ips;
    for (size_t f = first; f < frames; f++) {
      if (clip->DecodeVideoFrame(f, job) != DSDecodeOK) { unaligned(buf); delete clip; FinalizeSdk(); return fail("A frame could not be decoded"); }
      if (fwrite(buf, 1, size, stdout) != size) break; // the reader let go: a seek, a close
    }
    fflush(stdout);
    unaligned(buf); delete clip; FinalizeSdk(); return 0;
  }

  if (cmd == "audio") {
    const size_t ch = clip->AudioChannelCount();
    if (!ch) { delete clip; FinalizeSdk(); return fail("The clip has no sound"); }
    unsigned long long at = argc > 3 ? strtoull(argv[3], nullptr, 10) : 0;
    const unsigned long long total = clip->AudioSampleCount();
    const size_t chunk = 48000;
    size_t bytes = chunk * ch * 4;
    uint8_t* buf = (uint8_t*)aligned(bytes, 512);
    std::vector<uint8_t> le(bytes);
    while (at < total) {
      size_t n = chunk;
      if (clip->DecodeAudio(at, &n, buf, bytes) != DSDecodeOK || !n) break;
      // the SDK gives 32-bit big-endian samples; ffmpeg is told little-endian
      const size_t got = n * ch * 4;
      for (size_t i = 0; i < got; i += 4) { le[i] = buf[i + 3]; le[i + 1] = buf[i + 2]; le[i + 2] = buf[i + 1]; le[i + 3] = buf[i]; }
      if (fwrite(le.data(), 1, got, stdout) != got) break;
      at += n;
    }
    fflush(stdout);
    unaligned(buf); delete clip; FinalizeSdk(); return 0;
  }
  delete clip; FinalizeSdk();
  return fail("usage: roarplay-r3d info|video|audio <clip> ...");
}
