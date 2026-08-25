// Genera images/icon.png (128x128) sin dependencias externas.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 128;
const BG = [30, 30, 30];
const GREEN = [60, 135, 58];
const WHITE = [240, 240, 240];

function inHex(x, y, cx, cy, r) {
  // hexagono regular con vertices arriba/abajo (como el logo de Node)
  const dx = Math.abs(x - cx) / r;
  const dy = Math.abs(y - cy) / r;
  return dx <= Math.sqrt(3) / 2 && dy + dx / Math.sqrt(3) <= 1;
}

// Distancia de un punto al segmento AB
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function blend(dst, i, color, a) {
  for (let c = 0; c < 3; c++) dst[i + c] = Math.round(dst[i + c] * (1 - a) + color[c] * a);
}

function render() {
  const px = Buffer.alloc(S * S * 3);
  // fondo
  for (let i = 0; i < S * S; i++) {
    px[i * 3] = BG[0];
    px[i * 3 + 1] = BG[1];
    px[i * 3 + 2] = BG[2];
  }
  const cx = S / 2;
  const cy = S / 2;
  const r = 54;

  // hexagono verde con antialias por supersampling 3x3
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy++) {
        for (let sx = 0; sx < 3; sx++) {
          if (inHex(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3, cx, cy, r)) hits++;
        }
      }
      if (hits) blend(px, (y * S + x) * 3, GREEN, hits / 9);
    }
  }

  // chevron "v" blanco
  const ax = cx - 22, ay = cy - 14;
  const bx = cx, by = cy + 20;
  const dx2 = cx + 22, dy2 = cy - 14;
  const w = 6;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.min(
        distSeg(x + 0.5, y + 0.5, ax, ay, bx, by),
        distSeg(x + 0.5, y + 0.5, bx, by, dx2, dy2)
      );
      const a = Math.max(0, Math.min(1, w - d));
      if (a > 0) blend(px, (y * S + x) * 3, WHITE, a);
    }
  }
  return px;
}

function png(rgb) {
  // scanlines con filtro 0
  const raw = Buffer.alloc(S * (S * 3 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    rgb.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const out = path.join(__dirname, '..', 'images', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png(render()));
console.log('escrito', out);
