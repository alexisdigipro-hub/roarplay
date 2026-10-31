// Loudness as EBU R128 / ITU-R BS.1770 measures it, inside the audio thread: the signal K-weighted (a high shelf and
// a high pass), then the mean square of every 100 ms, per channel, sent to the page, which gathers 400 ms
// (momentary), 3 s (short-term) and the whole (integrated, with the gate). Also the sample peak of the same 100 ms.
class LufsProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const fs = sampleRate;
    // the two K-weighting stages for this sample rate (BS.1770-4 annex, derived as in libebur128)
    const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    const K = Math.tan(Math.PI * f0 / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    this.s1 = { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] };
    const f1 = 38.13547087602444, Q1 = 0.5003270373238773, K1 = Math.tan(Math.PI * f1 / fs);
    const d = 1 + K1 / Q1 + K1 * K1;
    this.s2 = { b: [1, -2, 1], a: [1, 2 * (K1 * K1 - 1) / d, (1 - K1 / Q1 + K1 * K1) / d] };
    this.z = [];
    this.block = Math.round(fs / 10);
    this.sum = []; this.peak = []; this.n = 0;
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length) return true;
    const ch = inp.length;
    while (this.z.length < ch) { this.z.push({ x1: 0, x2: 0, y1: 0, y2: 0, u1: 0, u2: 0, w1: 0, w2: 0 }); this.sum.push(0); this.peak.push(0); }
    const len = inp[0].length;
    for (let c = 0; c < ch; c++) {
      const x = inp[c], z = this.z[c];
      const { b: b1, a: a1 } = this.s1, { b: b2, a: a2 } = this.s2;
      let sum = this.sum[c], peak = this.peak[c];
      for (let i = 0; i < len; i++) {
        const xi = x[i];
        const ax = Math.abs(xi); if (ax > peak) peak = ax;
        const y = b1[0] * xi + b1[1] * z.x1 + b1[2] * z.x2 - a1[1] * z.y1 - a1[2] * z.y2;
        z.x2 = z.x1; z.x1 = xi; z.y2 = z.y1; z.y1 = y;
        const w = b2[0] * y + b2[1] * z.u1 + b2[2] * z.u2 - a2[1] * z.w1 - a2[2] * z.w2;
        z.u2 = z.u1; z.u1 = y; z.w2 = z.w1; z.w1 = w;
        sum += w * w;
      }
      this.sum[c] = sum; this.peak[c] = peak;
    }
    this.n += len;
    if (this.n >= this.block) {
      this.port.postMessage({ ms: this.sum.map((s) => s / this.n), peak: this.peak.slice(), channels: ch });
      this.sum = this.sum.map(() => 0); this.peak = this.peak.map(() => 0); this.n = 0;
    }
    return true;
  }
}
registerProcessor('lufs', LufsProcessor);
