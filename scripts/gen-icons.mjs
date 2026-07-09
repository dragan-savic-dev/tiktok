import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2];

// --- PNG encoder (RGBA, no deps) ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- helpers ---
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const CYAN = [0x25, 0xf4, 0xee];
const PINK = [0xfe, 0x2c, 0x55];
const BG0 = [0x12, 0x12, 0x1c];
const BG1 = [0x05, 0x05, 0x05];

function roundedRectCoverage(x, y, N, cr) {
  const h = N / 2;
  const qx = Math.abs(x + 0.5 - h) - (h - cr);
  const qy = Math.abs(y + 0.5 - h) - (h - cr);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  const outside = Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - cr;
  return clamp(0.5 - outside, 0, 1);
}

function draw(N, style) {
  const rgba = Buffer.alloc(N * N * 4, 0);
  const cx = (N - 1) / 2;
  const cy = (N - 1) / 2;
  const R = N / 2;
  const cornerR = N * 0.22;
  const contentScale = style === "any" ? 0.78 : 0.62; // maskable: content in safe zone
  const maxR = (N * contentScale) / 2;
  const rings = 4;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const bgA = style === "maskable" ? 1 : roundedRectCoverage(x, y, N, cornerR);
      const idx = (y * N + x) * 4;
      if (bgA <= 0) {
        rgba[idx + 3] = 0;
        continue;
      }
      // radial gradient background
      const t = clamp(Math.hypot(x - cx, y - cy) / (R * 1.05), 0, 1);
      let r = lerp(BG0[0], BG1[0], t);
      let g = lerp(BG0[1], BG1[1], t);
      let b = lerp(BG0[2], BG1[2], t);

      const dist = Math.hypot(x - cx, y - cy);

      // concentric rings, cyan -> pink
      for (let i = 0; i < rings; i++) {
        const rr = maxR * (0.3 + (0.7 * i) / (rings - 1));
        const w = maxR * 0.1;
        const d = Math.abs(dist - rr);
        const cov = clamp(w * 0.5 - d + 0.5, 0, 1);
        if (cov <= 0) continue;
        const tt = i / (rings - 1);
        r = lerp(r, lerp(CYAN[0], PINK[0], tt), cov);
        g = lerp(g, lerp(CYAN[1], PINK[1], tt), cov);
        b = lerp(b, lerp(CYAN[2], PINK[2], tt), cov);
      }

      // center dot
      const dotCov = clamp(maxR * 0.13 - dist + 0.5, 0, 1);
      r = lerp(r, 0xe6, dotCov);
      g = lerp(g, 0xff, dotCov);
      b = lerp(b, 0xff, dotCov);

      rgba[idx] = Math.round(r);
      rgba[idx + 1] = Math.round(g);
      rgba[idx + 2] = Math.round(b);
      rgba[idx + 3] = Math.round(bgA * 255);
    }
  }
  return encodePNG(N, N, rgba);
}

const files = [
  ["icon-192.png", 192, "any"],
  ["icon-512.png", 512, "any"],
  ["icon-maskable-512.png", 512, "maskable"],
  ["apple-icon-180.png", 180, "maskable"],
];
for (const [name, N, style] of files) {
  fs.writeFileSync(path.join(OUT, name), draw(N, style));
  console.log("wrote", name);
}
