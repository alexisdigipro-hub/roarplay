// RoarPlay's Blackmagic RAW reader (0.4, Alex 31 Oct: "play the RAW files"), built on a Mac in CI against the Blackmagic
// RAW SDK (kept in the draft release sdk-braw, never in this repository) and shipped as Resources/bin/roarplay-braw
// with the SDK's BlackmagicRawAPI.framework beside it. The SDK decodes; this only hands ffmpeg what it decoded:
//   roarplay-braw info  <clip>                         one line of JSON: size, rate, frames, timecode, sound
//   roarplay-braw video <clip> <first frame> <scale> [look]   raw RGBA frames on stdout, one after another (scale 1,
//                                                      2, 4, 8; look 709 = Rec.709, lut = the camera's LUT, shot = as set)
//   roarplay-braw audio <clip> <first sample>          the sound as raw signed little-endian PCM on stdout
// main.js runs it and pipes its stdout into an ffmpeg that reads rawvideo / PCM, as any other source.
#include "BlackmagicRawAPI.h"
#include <CoreFoundation/CoreFoundation.h>
#include <mach-o/dyld.h>
#include <atomic>
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <map>
#include <mutex>
#include <string>
#include <unistd.h>
#include <vector>

static std::string fromCF(CFStringRef s) {
  if (!s) return "";
  char buf[512];
  if (CFStringGetCString(s, buf, sizeof buf, kCFStringEncodingUTF8)) return buf;
  return "";
}
static CFStringRef toCF(const char* s) { return CFStringCreateWithCString(kCFAllocatorDefault, s, kCFStringEncodingUTF8); }

// frames come back out of order from the SDK's threads; they are written in order
struct Out {
  std::mutex m;
  std::condition_variable cv;
  std::map<uint64_t, std::vector<uint8_t>> done;
  std::atomic<int> inFlight{0};
  std::atomic<bool> failed{false};
};

class Callback : public IBlackmagicRawCallback {
 public:
  Callback(Out* o, BlackmagicRawResolutionScale scale, uint32_t w, uint32_t h, IBlackmagicRawClipProcessingAttributes* look)
      : out(o), scale(scale), W(w), H(h), look(look) {}
  virtual ~Callback() {}
  void ReadComplete(IBlackmagicRawJob* readJob, HRESULT result, IBlackmagicRawFrame* frame) override {
    uint64_t* idx = nullptr;
    readJob->GetUserData((void**)&idx);
    IBlackmagicRawJob* decodeJob = nullptr;
    if (result == S_OK) result = frame->SetResourceFormat(blackmagicRawResourceFormatRGBAU8);
    if (result == S_OK) result = frame->SetResolutionScale(scale);
    if (result == S_OK) result = frame->CreateJobDecodeAndProcessFrame(look, nullptr, &decodeJob);
    if (result == S_OK) result = decodeJob->SetUserData(idx);
    if (result == S_OK) result = decodeJob->Submit();
    if (result != S_OK) { if (decodeJob) decodeJob->Release(); finish(idx, {}); }
    readJob->Release();
  }
  void ProcessComplete(IBlackmagicRawJob* job, HRESULT result, IBlackmagicRawProcessedImage* image) override {
    uint64_t* idx = nullptr;
    job->GetUserData((void**)&idx);
    std::vector<uint8_t> bytes;
    void* data = nullptr; uint32_t size = 0, iw = 0, ih = 0;
    BlackmagicRawResourceFormat fmt = blackmagicRawResourceFormatRGBAU8;
    if (result == S_OK && image->GetResource(&data) == S_OK && image->GetResourceSizeBytes(&size) == S_OK && data &&
        image->GetWidth(&iw) == S_OK && image->GetHeight(&ih) == S_OK && image->GetResourceFormat(&fmt) == S_OK &&
        (data = host(image, data)))
      bytes = toRGBA((const uint8_t*)data, size, iw, ih, fmt);
    finish(idx, std::move(bytes));
    job->Release();
  }
  void DecodeComplete(IBlackmagicRawJob*, HRESULT) override {}
  void TrimProgress(IBlackmagicRawJob*, float) override {}
  void TrimComplete(IBlackmagicRawJob*, HRESULT) override {}
  void SidecarMetadataParseWarning(IBlackmagicRawClip*, CFStringRef, uint32_t, CFStringRef) override {}
  void SidecarMetadataParseError(IBlackmagicRawClip*, CFStringRef, uint32_t, CFStringRef) override {}
  void PreparePipelineComplete(void*, HRESULT) override {}
  // Blackmagic RAW 6.0 reads sound through jobs too; this reader asks for sound directly (GetAudioSamples)
  void ReadAudioComplete(IBlackmagicRawJob*, HRESULT, IBlackmagicRawAudioBuffer*) override {}
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID, LPVOID*) override { return E_NOTIMPL; }
  ULONG STDMETHODCALLTYPE AddRef(void) override { return 0; }
  ULONG STDMETHODCALLTYPE Release(void) override { return 0; }

 private:
  // the bytes of the picture: as they are from the CPU pipeline; from Metal, the buffer's own memory (on Apple Silicon
  // the GPU and the CPU share it, so nothing is copied)
  void* host(IBlackmagicRawProcessedImage* image, void* data) {
    BlackmagicRawResourceType t = blackmagicRawResourceTypeBufferCPU;
    if (image->GetResourceType(&t) != S_OK || t == blackmagicRawResourceTypeBufferCPU) return data;
    void* p = nullptr;
    if (rm && rm->GetResourceHostPointer(gpuContext, gpuQueue, data, t, &p) == S_OK && p) return p;
    fprintf(stderr, "braw: the picture came in GPU memory (0x%08X) and could not be read\n", (unsigned)t);
    return nullptr;
  }
  // what the SDK hands back, made exactly W x H RGBA 8-bit, the size ffmpeg was told: the SDK may decode a camera at
  // another size than asked (a scale it does not offer), pad its rows, or keep another format; any of these, written
  // as they came, shears the picture into grey stripes (Alex's URSA Cine clip, 31 Oct)
  std::vector<uint8_t> toRGBA(const uint8_t* src, uint32_t size, uint32_t iw, uint32_t ih, BlackmagicRawResourceFormat fmt) {
    int bpp = 0; bool bgr = false, wide = false;
    switch (fmt) {
      case blackmagicRawResourceFormatRGBAU8: bpp = 4; break;
      case blackmagicRawResourceFormatBGRAU8: bpp = 4; bgr = true; break;
      case blackmagicRawResourceFormatRGBAU16: bpp = 8; wide = true; break;
      case blackmagicRawResourceFormatBGRAU16: bpp = 8; wide = true; bgr = true; break;
      case blackmagicRawResourceFormatRGBU16: bpp = 6; wide = true; break;
      default: break;
    }
    if (!bpp || !iw || !ih) { note("format", fmt, iw, ih, size); return {}; }
    // the rows are packed; the SDK rounds the whole buffer up (to 4 KB pages), so the size says nothing about the rows:
    // reading size / height as the row length shifted each row by a few pixels (Alex's URSA Cine 17K clip, 1 Nov)
    const size_t stride = (size_t)iw * bpp;
    if ((size_t)size < stride * ih) { note("size", fmt, iw, ih, size); return {}; }
    if (iw != W || ih != H) note("scale", fmt, iw, ih, size);
    // the usual case: RGBA 8-bit at the size asked, handed on as it is (no pixel by pixel copy)
    if (iw == W && ih == H && fmt == blackmagicRawResourceFormatRGBAU8)
      return std::vector<uint8_t>(src, src + (size_t)W * H * 4);
    std::vector<uint8_t> o((size_t)W * H * 4);
    for (uint32_t y = 0; y < H; y++) {
      const uint8_t* row = src + (size_t)((uint64_t)y * ih / H) * stride;
      uint8_t* d = o.data() + (size_t)y * W * 4;
      for (uint32_t x = 0; x < W; x++, d += 4) {
        const uint8_t* p = row + (size_t)((uint64_t)x * iw / W) * bpp;
        uint8_t c[4];
        if (wide) { const uint16_t* q = (const uint16_t*)p; for (int i = 0; i < 3; i++) c[i] = q[i] >> 8; c[3] = 255; }
        else { c[0] = p[0]; c[1] = p[1]; c[2] = p[2]; c[3] = 255; }
        d[0] = bgr ? c[2] : c[0]; d[1] = c[1]; d[2] = bgr ? c[0] : c[2]; d[3] = c[3];
      }
    }
    return o;
  }
  void note(const char* what, int fmt, uint32_t iw, uint32_t ih, uint32_t size) {
    static std::atomic<bool> said{false};
    if (said.exchange(true)) return;
    fprintf(stderr, "braw %s: asked %ux%u, got %ux%u format 0x%08X, %u bytes\n", what, W, H, iw, ih, (unsigned)fmt, size);
  }
  void finish(uint64_t* idx, std::vector<uint8_t> bytes) {
    if (!idx) return;
    { std::lock_guard<std::mutex> l(out->m); if (bytes.empty()) out->failed = true; out->done[*idx] = std::move(bytes); out->inFlight--; }
    delete idx;
    out->cv.notify_all();
  }
  Out* out;
  // set when the codec runs on the Mac's GPU (Metal): the picture is read where it lies, through the resource manager
  IBlackmagicRawResourceManager* rm = nullptr;
  void* gpuContext = nullptr;
  void* gpuQueue = nullptr;
  BlackmagicRawResolutionScale scale;
  uint32_t W, H;
  IBlackmagicRawClipProcessingAttributes* look;
};

// the values the SDK offers for a string attribute (gamma, gamut, LUT mode), as text
static std::vector<std::string> choices(IBlackmagicRawClipProcessingAttributes* a, BlackmagicRawClipProcessingAttribute what) {
  std::vector<std::string> out;
  uint32_t n = 0; bool ro = false;
  if (a->GetClipAttributeList(what, nullptr, &n, &ro) != S_OK || !n) return out;
  std::vector<Variant> v(n);
  for (auto& x : v) VariantInit(&x);
  if (a->GetClipAttributeList(what, v.data(), &n, &ro) == S_OK)
    for (uint32_t i = 0; i < n; i++) if (v[i].vt == blackmagicRawVariantTypeString) out.push_back(fromCF(v[i].bstrVal));
  for (auto& x : v) VariantClear(&x);
  return out;
}
static std::string current(IBlackmagicRawClipProcessingAttributes* a, BlackmagicRawClipProcessingAttribute what) {
  Variant v; VariantInit(&v); std::string s;
  if (a->GetClipAttribute(what, &v) == S_OK && v.vt == blackmagicRawVariantTypeString) s = fromCF(v.bstrVal);
  VariantClear(&v);
  return s;
}
// the first offered value whose name has one of `want` in it (in that order), and not `avoid`
static std::string pick(const std::vector<std::string>& list, std::initializer_list<const char*> want, const char* avoid = nullptr) {
  for (const char* w : want)
    for (const auto& c : list)
      if (c.find(w) != std::string::npos && (!avoid || c.find(avoid) == std::string::npos)) return c;
  return "";
}
static bool setText(IBlackmagicRawClipProcessingAttributes* a, BlackmagicRawClipProcessingAttribute what, const std::string& val) {
  if (val.empty()) return false;
  Variant v; VariantInit(&v);
  v.vt = blackmagicRawVariantTypeString; v.bstrVal = toCF(val.c_str());
  bool ok = a->SetClipAttribute(what, &v) == S_OK;
  CFRelease(v.bstrVal);
  return ok;
}
static bool hasEmbeddedLut(IBlackmagicRawClipProcessingAttributes* a) {
  IBlackmagicRawPost3DLUT* lut = nullptr;
  if (a->GetEmbeddedPost3DLUT(&lut) == S_OK && lut) { lut->Release(); return true; }
  return false;
}
// the clip's colour as asked: 709 (Rec.709 gamma and gamut, no LUT), lut (the LUT the camera embedded, else 709),
// shot (untouched, as the camera was set)
static IBlackmagicRawClipProcessingAttributes* lookFor(IBlackmagicRawClip* clip, const std::string& look) {
  IBlackmagicRawClipProcessingAttributes* a = nullptr;
  if (look == "shot" || clip->CloneClipProcessingAttributes(&a) != S_OK || !a) return nullptr;
  auto modes = choices(a, blackmagicRawClipProcessingAttributePost3DLUTMode);
  if (look == "lut" && hasEmbeddedLut(a) && setText(a, blackmagicRawClipProcessingAttributePost3DLUTMode, pick(modes, {"Embedded"})))
    return a;
  setText(a, blackmagicRawClipProcessingAttributePost3DLUTMode, pick(modes, {"Disabled", "None", "Off"}));
  auto gammas = choices(a, blackmagicRawClipProcessingAttributeGamma);
  auto gamuts = choices(a, blackmagicRawClipProcessingAttributeGamut);
  std::string g = pick(gammas, {"Rec.709", "Rec 709", "709"}, "2100");
  if (g.empty()) g = pick(gammas, {"Video"}, "Extended");
  bool ok = setText(a, blackmagicRawClipProcessingAttributeGamma, g);
  setText(a, blackmagicRawClipProcessingAttributeGamut, pick(gamuts, {"Rec.709", "Rec 709", "709"}, "2100"));
  if (!ok) fprintf(stderr, "braw look: no Rec.709 gamma among %zu offered\n", gammas.size());
  return a;
}
// the sizes this camera's clips decode at (the 12K sensor of URSA Cine and PYXIS 12K has its own), and the scale the
// SDK itself picks for a size, so the reader never asks a camera for a scale it does not offer (Alex's PYXIS 12K, 31 Oct)
static std::string sizes(IBlackmagicRawClip* clip) {
  IBlackmagicRawClipResolutions* r = nullptr; std::string s;
  if (clip->QueryInterface(IID_IBlackmagicRawClipResolutions, (LPVOID*)&r) != S_OK || !r) return s;
  uint32_t n = 0; r->GetResolutionCount(&n);
  for (uint32_t i = 0; i < n; i++) { uint32_t w = 0, h = 0; if (r->GetResolution(i, &w, &h) == S_OK) { if (!s.empty()) s += "|"; s += std::to_string(w) + "x" + std::to_string(h); } }
  r->Release();
  return s;
}
static BlackmagicRawResolutionScale scaleFor(IBlackmagicRawClip* clip, uint32_t w, uint32_t h, BlackmagicRawResolutionScale fallback) {
  IBlackmagicRawClipResolutions* r = nullptr; BlackmagicRawResolutionScale s = fallback;
  if (clip->QueryInterface(IID_IBlackmagicRawClipResolutions, (LPVOID*)&r) != S_OK || !r) return s;
  if (r->GetClosestScaleForResolution(w, h, &s) != S_OK) s = fallback;
  r->Release();
  return s;
}
static std::string joined(const std::vector<std::string>& v) {
  std::string s;
  for (const auto& x : v) { if (!s.empty()) s += "|"; for (char c : x) if (c != '"' && c != '\\') s += c; }
  return s;
}

static int fail(const char* what) { fprintf(stderr, "%s\n", what); return 1; }

// the Mac's GPU (Alex, 2 Nov: "BRAW stutters, make it play like oil"): the codec is set to Metal, as Resolve does; the
// CPU pipeline stays when there is no Metal device or ROARPLAY_BRAW_CPU is set. Returns the device (kept for the
// codec's life) and fills the resource manager the pictures are read through.
static IBlackmagicRawPipelineDevice* useMetal(IBlackmagicRawFactory* f, IBlackmagicRaw* codec, Callback& cb) {
  if (getenv("ROARPLAY_BRAW_CPU")) return nullptr;
  IBlackmagicRawPipelineDeviceIterator* it = nullptr;
  if (f->CreatePipelineDeviceIterator(blackmagicRawPipelineMetal, blackmagicRawInteropNone, &it) != S_OK || !it) return nullptr;
  IBlackmagicRawPipelineDevice* dev = nullptr;
  HRESULT r = it->CreateDevice(&dev);
  it->Release();
  if (r != S_OK || !dev) return nullptr;
  IBlackmagicRawConfiguration* cfg = nullptr;
  IBlackmagicRawConfigurationEx* ex = nullptr;
  BlackmagicRawPipeline pipe = blackmagicRawPipelineCPU;
  bool ok = codec->QueryInterface(IID_IBlackmagicRawConfiguration, (LPVOID*)&cfg) == S_OK && cfg &&
            codec->QueryInterface(IID_IBlackmagicRawConfigurationEx, (LPVOID*)&ex) == S_OK && ex &&
            cfg->SetFromDevice(dev) == S_OK &&
            dev->GetPipeline(&pipe, &cb.gpuContext, &cb.gpuQueue) == S_OK &&
            ex->GetResourceManager(&cb.rm) == S_OK && cb.rm;
  if (cfg) cfg->Release();
  if (ex) ex->Release();
  if (!ok) { fprintf(stderr, "braw: Metal could not be set, the CPU decodes\n"); cb.rm = nullptr; dev->Release(); return nullptr; }
  return dev;
}

// the SDK's libraries sit beside this program (Resources/bin), or where ROARPLAY_BRAW_LIBS says
static IBlackmagicRawFactory* factory() {
  const char* env = getenv("ROARPLAY_BRAW_LIBS");
  std::string dir;
  if (env) dir = env;
  else {
    char self[4096]; uint32_t n = sizeof self;
    if (_NSGetExecutablePath(self, &n) == 0) { dir = self; dir = dir.substr(0, dir.rfind('/')); }
  }
  CFStringRef p = toCF(dir.c_str());
  IBlackmagicRawFactory* f = CreateBlackmagicRawFactoryInstanceFromPath(p);
  CFRelease(p);
  return f;
}

int main(int argc, char** argv) {
  if (argc < 3) return fail("usage: roarplay-braw info|video|audio <clip> ...");
  std::string cmd = argv[1];
  IBlackmagicRawFactory* f = factory();
  if (!f) return fail("The Blackmagic RAW libraries are missing");
  IBlackmagicRaw* codec = nullptr;
  if (f->CreateCodec(&codec) != S_OK || !codec) return fail("The Blackmagic RAW decoder could not start");
  // the CPU pipeline everywhere; the SDK picks Metal itself when told, which a later version can choose
  IBlackmagicRawClip* clip = nullptr;
  CFStringRef path = toCF(argv[2]);
  HRESULT r = codec->OpenClip(path, &clip);
  CFRelease(path);
  if (r != S_OK || !clip) {
    // the SDK's own code says why: a clip newer than this SDK, a file it cannot reach, a broken file
    fprintf(stderr, "Not a Blackmagic RAW clip, or it cannot be read (SDK code 0x%08X)\n", (unsigned)r);
    return 1;
  }

  uint32_t w = 0, h = 0; float fps = 0; uint64_t frames = 0;
  clip->GetWidth(&w); clip->GetHeight(&h); clip->GetFrameRate(&fps); clip->GetFrameCount(&frames);
  IBlackmagicRawClipAudio* audio = nullptr;
  clip->QueryInterface(IID_IBlackmagicRawClipAudio, (LPVOID*)&audio);

  if (cmd == "info") {
    CFStringRef tc = nullptr; std::string tcs;
    if (clip->GetTimecodeForFrame(0, &tc) == S_OK && tc) { tcs = fromCF(tc); CFRelease(tc); }
    uint32_t ach = 0, abits = 0, arate = 0; uint64_t asamples = 0;
    if (audio) { audio->GetAudioChannelCount(&ach); audio->GetAudioBitDepth(&abits); audio->GetAudioSampleRate(&arate); audio->GetAudioSampleCount(&asamples); }
    CFStringRef cam = nullptr; std::string camera;
    if (clip->GetCameraType(&cam) == S_OK && cam) { camera = fromCF(cam); CFRelease(cam); }
    // the colour as shot and what the SDK offers, for Info
    std::string gamma, gamut, gammas, gamuts; bool lut = false;
    IBlackmagicRawClipProcessingAttributes* a = nullptr;
    if (clip->CloneClipProcessingAttributes(&a) == S_OK && a) {
      gamma = current(a, blackmagicRawClipProcessingAttributeGamma); gamut = current(a, blackmagicRawClipProcessingAttributeGamut);
      gammas = joined(choices(a, blackmagicRawClipProcessingAttributeGamma)); gamuts = joined(choices(a, blackmagicRawClipProcessingAttributeGamut));
      lut = hasEmbeddedLut(a);
      a->Release();
    }
    printf("{\"width\":%u,\"height\":%u,\"fps\":%.6f,\"frames\":%llu,\"timecode\":\"%s\",\"camera\":\"%s\",\"audio\":{\"channels\":%u,\"bits\":%u,\"rate\":%u,\"samples\":%llu},"
           "\"gamma\":\"%s\",\"gamut\":\"%s\",\"cameraLut\":%s,\"gammas\":\"%s\",\"gamuts\":\"%s\",\"sizes\":\"%s\"}\n",
           w, h, fps, (unsigned long long)frames, tcs.c_str(), camera.c_str(), ach, abits, arate, (unsigned long long)asamples,
           gamma.c_str(), gamut.c_str(), lut ? "true" : "false", gammas.c_str(), gamuts.c_str(), sizes(clip).c_str());
    return 0;
  }

  // every metadata item of the clip and of frame 0, one per line, "key = value" (for Info and to find orientation)
  if (cmd == "meta") {
    auto dump = [](IBlackmagicRawMetadataIterator* it, const char* where) {
      if (!it) return;
      while (true) {
        CFStringRef k = nullptr; Variant v; VariantInit(&v);
        if (it->GetKey(&k) != S_OK) break;
        std::string val;
        if (it->GetData(&v) == S_OK) {
          char b[64] = "";
          switch (v.vt) {
            case blackmagicRawVariantTypeString: val = fromCF(v.bstrVal); break;
            case blackmagicRawVariantTypeU8: case blackmagicRawVariantTypeU16: snprintf(b, sizeof b, "%u", (unsigned)v.uiVal); val = b; break;
            case blackmagicRawVariantTypeS16: snprintf(b, sizeof b, "%d", (int)v.iVal); val = b; break;
            case blackmagicRawVariantTypeS32: snprintf(b, sizeof b, "%d", v.intVal); val = b; break;
            case blackmagicRawVariantTypeU32: snprintf(b, sizeof b, "%u", v.uintVal); val = b; break;
            case blackmagicRawVariantTypeFloat32: snprintf(b, sizeof b, "%g", v.fltVal); val = b; break;
            case blackmagicRawVariantTypeFloat64: snprintf(b, sizeof b, "%g", v.dblVal); val = b; break;
            default: val = "(array)"; break;
          }
        }
        printf("%s %s = %s\n", where, fromCF(k).c_str(), val.c_str());
        if (k) CFRelease(k);
        VariantClear(&v);
        if (it->Next() != S_OK) break;
      }
      it->Release();
    };
    IBlackmagicRawMetadataIterator* it = nullptr;
    if (clip->GetMetadataIterator(&it) == S_OK) dump(it, "clip");
    return 0;
  }

  if (cmd == "audio") {
    if (!audio) return fail("The clip has no sound");
    uint32_t ach = 0, abits = 0; uint64_t total = 0;
    audio->GetAudioChannelCount(&ach); audio->GetAudioBitDepth(&abits); audio->GetAudioSampleCount(&total);
    int64_t at = argc > 3 ? atoll(argv[3]) : 0;
    const uint32_t chunk = 48000;
    std::vector<uint8_t> buf((size_t)chunk * ach * ((abits + 7) / 8));
    while ((uint64_t)at < total) {
      uint32_t got = 0, bytes = 0;
      if (audio->GetAudioSamples(at, buf.data(), (uint32_t)buf.size(), chunk, &got, &bytes) != S_OK || !got) break;
      if (fwrite(buf.data(), 1, bytes, stdout) != bytes) break; // the reader let go
      at += got;
    }
    fflush(stdout);
    return 0;
  }

  if (cmd == "video") {
    uint64_t first = argc > 3 ? strtoull(argv[3], nullptr, 10) : 0;
    if (frames && first >= frames) first = frames - 1; // a seek at the very end shows the last frame
    int s = argc > 4 ? atoi(argv[4]) : 1;
    BlackmagicRawResolutionScale scale = s >= 8 ? blackmagicRawResolutionScaleEighth : s >= 4 ? blackmagicRawResolutionScaleQuarter : s >= 2 ? blackmagicRawResolutionScaleHalf : blackmagicRawResolutionScaleFull;
    Out out;
    const int sd = s >= 8 ? 8 : s >= 4 ? 4 : s >= 2 ? 2 : 1;
    scale = scaleFor(clip, w / sd, h / sd, scale); // a scale this camera offers; toRGBA makes it the size ffmpeg expects
    Callback cb(&out, scale, w / sd, h / sd, nullptr); // the size media.js brawSource tells ffmpeg
    // a second codec on the GPU, the clip opened again in it; if any of that fails, the CPU codec as before
    IBlackmagicRaw* const cpuCodec = codec; IBlackmagicRawClip* const cpuClip = clip;
    IBlackmagicRaw* gpu = nullptr; IBlackmagicRawClip* gclip = nullptr; IBlackmagicRawPipelineDevice* dev = nullptr;
    if (f->CreateCodec(&gpu) == S_OK && gpu && (dev = useMetal(f, gpu, cb))) {
      CFStringRef gp = toCF(argv[2]);
      if (gpu->OpenClip(gp, &gclip) == S_OK && gclip) { codec = gpu; clip = gclip; fprintf(stderr, "braw: Metal\n"); }
      else { cb.rm = nullptr; fprintf(stderr, "braw: Metal could not open the clip, the CPU decodes\n"); }
      CFRelease(gp);
    } else if (getenv("ROARPLAY_BRAW_SAY")) fprintf(stderr, "braw: CPU\n");
    IBlackmagicRawClipProcessingAttributes* look = lookFor(clip, argc > 5 ? argv[5] : "709");
    cb.look = look;

    codec->SetCallback(&cb);
    const int ahead = 6; // frames decoded at once on the SDK's threads
    uint64_t next = first, write = first;
    while (write < frames) {
      while (next < frames && out.inFlight < ahead && next - write < (uint64_t)ahead * 2) {
        IBlackmagicRawJob* job = nullptr;
        if (clip->CreateJobReadFrame(next, &job) != S_OK) return fail("A frame could not be read");
        job->SetUserData(new uint64_t(next));
        out.inFlight++;
        if (job->Submit() != S_OK) { job->Release(); out.inFlight--; return fail("A frame could not be read"); }
        next++;
      }
      std::unique_lock<std::mutex> l(out.m);
      out.cv.wait(l, [&] { return out.done.count(write) > 0; });
      std::vector<uint8_t> bytes = std::move(out.done[write]);
      out.done.erase(write);
      l.unlock();
      if (bytes.empty() && codec != cpuCodec && write == first) {
        // the GPU gave nothing for the first frame: the same again on the CPU, before anything was written
        fprintf(stderr, "braw: Metal gave no picture, the CPU decodes\n");
        codec->FlushJobs();
        { std::lock_guard<std::mutex> g(out.m); out.done.clear(); out.failed = false; out.inFlight = 0; }
        codec = cpuCodec; clip = cpuClip; cb.rm = nullptr; cb.gpuContext = cb.gpuQueue = nullptr;
        if (look) look->Release();
        look = lookFor(clip, argc > 5 ? argv[5] : "709"); cb.look = look;
        codec->SetCallback(&cb);
        next = first;
        continue;
      }
      if (bytes.empty()) { codec->FlushJobs(); return fail("A frame could not be decoded"); }
      if (fwrite(bytes.data(), 1, bytes.size(), stdout) != bytes.size()) break; // the reader let go: a seek, a close
      write++;
    }
    fflush(stdout);
    codec->FlushJobs();
    if (look) look->Release();
    return 0;
  }
  return fail("usage: roarplay-braw info|video|audio <clip> ...");
}
