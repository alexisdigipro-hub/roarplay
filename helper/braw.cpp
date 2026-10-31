// RoarPlay's Blackmagic RAW reader (0.4, Alex 31 Oct: "play the RAW files"), built on a Mac in CI against the Blackmagic
// RAW SDK (kept in the draft release sdk-braw, never in this repository) and shipped as Resources/bin/roarplay-braw
// with the SDK's BlackmagicRawAPI.framework beside it. The SDK decodes; this only hands ffmpeg what it decoded:
//   roarplay-braw info  <clip>                         one line of JSON: size, rate, frames, timecode, sound
//   roarplay-braw video <clip> <first frame> <scale>   raw RGBA frames on stdout, one after another (scale 1, 2, 4, 8)
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
  explicit Callback(Out* o, BlackmagicRawResolutionScale scale) : out(o), scale(scale) {}
  virtual ~Callback() {}
  void ReadComplete(IBlackmagicRawJob* readJob, HRESULT result, IBlackmagicRawFrame* frame) override {
    uint64_t* idx = nullptr;
    readJob->GetUserData((void**)&idx);
    IBlackmagicRawJob* decodeJob = nullptr;
    if (result == S_OK) result = frame->SetResourceFormat(blackmagicRawResourceFormatRGBAU8);
    if (result == S_OK) result = frame->SetResolutionScale(scale);
    if (result == S_OK) result = frame->CreateJobDecodeAndProcessFrame(nullptr, nullptr, &decodeJob);
    if (result == S_OK) result = decodeJob->SetUserData(idx);
    if (result == S_OK) result = decodeJob->Submit();
    if (result != S_OK) { if (decodeJob) decodeJob->Release(); finish(idx, {}); }
    readJob->Release();
  }
  void ProcessComplete(IBlackmagicRawJob* job, HRESULT result, IBlackmagicRawProcessedImage* image) override {
    uint64_t* idx = nullptr;
    job->GetUserData((void**)&idx);
    std::vector<uint8_t> bytes;
    void* data = nullptr; uint32_t size = 0;
    if (result == S_OK && image->GetResource(&data) == S_OK && image->GetResourceSizeBytes(&size) == S_OK && data)
      bytes.assign((uint8_t*)data, (uint8_t*)data + size);
    finish(idx, std::move(bytes));
    job->Release();
  }
  void DecodeComplete(IBlackmagicRawJob*, HRESULT) override {}
  void TrimProgress(IBlackmagicRawJob*, float) override {}
  void TrimComplete(IBlackmagicRawJob*, HRESULT) override {}
  void SidecarMetadataParseWarning(IBlackmagicRawClip*, CFStringRef, uint32_t, CFStringRef) override {}
  void SidecarMetadataParseError(IBlackmagicRawClip*, CFStringRef, uint32_t, CFStringRef) override {}
  void PreparePipelineComplete(void*, HRESULT) override {}
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID, LPVOID*) override { return E_NOTIMPL; }
  ULONG STDMETHODCALLTYPE AddRef(void) override { return 0; }
  ULONG STDMETHODCALLTYPE Release(void) override { return 0; }

 private:
  void finish(uint64_t* idx, std::vector<uint8_t> bytes) {
    if (!idx) return;
    { std::lock_guard<std::mutex> l(out->m); if (bytes.empty()) out->failed = true; out->done[*idx] = std::move(bytes); out->inFlight--; }
    delete idx;
    out->cv.notify_all();
  }
  Out* out;
  BlackmagicRawResolutionScale scale;
};

static int fail(const char* what) { fprintf(stderr, "%s\n", what); return 1; }

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
  if (r != S_OK || !clip) return fail("Not a Blackmagic RAW clip, or it cannot be read");

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
    printf("{\"width\":%u,\"height\":%u,\"fps\":%.6f,\"frames\":%llu,\"timecode\":\"%s\",\"camera\":\"%s\",\"audio\":{\"channels\":%u,\"bits\":%u,\"rate\":%u,\"samples\":%llu}}\n",
           w, h, fps, (unsigned long long)frames, tcs.c_str(), camera.c_str(), ach, abits, arate, (unsigned long long)asamples);
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
    Callback cb(&out, scale);
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
      if (bytes.empty()) { codec->FlushJobs(); return fail("A frame could not be decoded"); }
      if (fwrite(bytes.data(), 1, bytes.size(), stdout) != bytes.size()) break; // the reader let go: a seek, a close
      write++;
    }
    fflush(stdout);
    codec->FlushJobs();
    return 0;
  }
  return fail("usage: roarplay-braw info|video|audio <clip> ...");
}
