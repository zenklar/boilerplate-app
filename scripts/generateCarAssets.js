#!/usr/bin/env node
/**
 * Generates 4 car PNG assets using only Node.js built-ins (zlib + fs).
 * Run: node scripts/generateCarAssets.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 160, H = 90;

// ── CRC32 ──────────────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG encoder ────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function savePNG(rgba, filename) {
  const rowLen = W * 4;
  const raw = Buffer.alloc(H * (rowLen + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (rowLen + 1)] = 0;
    rgba.copy(raw, y * (rowLen + 1) + 1, y * rowLen, (y + 1) * rowLen);
  }
  const idat = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(filename, Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',idat), pngChunk('IEND',Buffer.alloc(0))]));
}

// ── Drawing primitives ─────────────────────────────────────────────────────
const BUF = () => Buffer.alloc(W * H * 4, 0);
function sp(buf, x, y, r, g, b, a = 255) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
  const i = (yi * W + xi) * 4, al = a / 255;
  buf[i]   = (buf[i]   * (1 - al) + r * al) | 0;
  buf[i+1] = (buf[i+1] * (1 - al) + g * al) | 0;
  buf[i+2] = (buf[i+2] * (1 - al) + b * al) | 0;
  buf[i+3] = Math.min(255, buf[i+3] + a);
}
function rect(buf, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) sp(buf, x+dx, y+dy, r, g, b, a);
}
function rrect(buf, x, y, w, h, rx, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x+dx, py = y+dy;
      let skip = false;
      if (px < x+rx && py < y+rx) { const cx=px-(x+rx),cy=py-(y+rx); if(cx*cx+cy*cy>rx*rx) skip=true; }
      if (!skip && px >= x+w-rx && py < y+rx) { const cx=px-(x+w-rx),cy=py-(y+rx); if(cx*cx+cy*cy>rx*rx) skip=true; }
      if (!skip && px < x+rx && py >= y+h-rx) { const cx=px-(x+rx),cy=py-(y+h-rx); if(cx*cx+cy*cy>rx*rx) skip=true; }
      if (!skip && px >= x+w-rx && py >= y+h-rx) { const cx=px-(x+w-rx),cy=py-(y+h-rx); if(cx*cx+cy*cy>rx*rx) skip=true; }
      if (!skip) sp(buf, px, py, r, g, b, a);
    }
  }
}
function circle(buf, cx, cy, rad, r, g, b, a = 255) {
  for (let dy = -rad; dy <= rad; dy++)
    for (let dx = -rad; dx <= rad; dx++)
      if (dx*dx+dy*dy <= rad*rad) sp(buf, cx+dx, cy+dy, r, g, b, a);
}
function wheel(buf, cx, cy, outerR, rimR, hubR) {
  circle(buf, cx, cy, outerR, 22, 22, 22);
  for (let a = 0; a < 6; a++) {
    const ang = a * Math.PI / 3;
    circle(buf, cx + Math.round(Math.cos(ang)*(outerR-4)), cy + Math.round(Math.sin(ang)*(outerR-4)), 2, 8,8,8);
  }
  circle(buf, cx, cy, rimR,  140,140,150);
  circle(buf, cx, cy, rimR-3, 170,170,180);
  circle(buf, cx, cy, hubR,  210,210,215);
  circle(buf, cx, cy, 3,      85, 85, 90);
  for (let a = 0; a < 5; a++) {
    const ang = a * Math.PI * 2 / 5;
    const r2 = Math.round((rimR + hubR) / 2);
    rect(buf,
      cx + Math.round(Math.cos(ang)*r2) - 1,
      cy + Math.round(Math.sin(ang)*r2) - 1,
      2, 2, 160,160,170);
  }
}

// ── Car 1: Red Jeep ────────────────────────────────────────────────────────
function carJeep() {
  const b = BUF();
  circle(b, 36, 83, 13, 0,0,0, 35); circle(b, 121, 83, 13, 0,0,0, 35);
  rrect(b, 9, 20, 141, 40, 7,  210,38,38);
  rrect(b, 30, 4,  88, 24, 6,  185,22,22);
  rrect(b, 34, 7,  32, 17, 4,  140,200,230, 200);
  rrect(b, 76, 7,  36, 17, 4,  140,200,230, 200);
  rect(b, 68, 7,   5, 17,       170,15,15);
  rect(b, 9, 38, 141,  4,       180,28,28);
  rrect(b, 143, 26, 10, 22, 3, 155,28,28);
  rrect(b, 144, 28,  7,  9, 2, 255,242,140);
  rect(b, 5, 28,  7, 22,        150,28,28);
  rect(b, 32, 3,  84,  4,       160,12,12);
  rect(b, 9, 55, 141,  5,       190,35,35);
  wheel(b, 36, 70, 18, 12, 6);
  wheel(b, 121, 70, 18, 12, 6);
  return b;
}

// ── Car 2: Yellow Sports Car ───────────────────────────────────────────────
function carSports() {
  const b = BUF();
  circle(b, 32, 83, 15, 0,0,0, 35); circle(b, 124, 83, 15, 0,0,0, 35);
  rect(b,  4, 24, 16,  5, 200,162,0);
  rect(b,  4, 29,  8,  4, 165,133,0);
  rrect(b, 8, 30, 144, 30, 11, 240,190,0);
  rrect(b, 38, 9,  74, 27,  6, 210,165,0);
  rrect(b, 42, 12, 28, 20,  4, 140,200,230, 190);
  rrect(b, 74, 12, 34, 20,  4, 140,200,230, 190);
  rect(b, 70, 12,   5, 20,     190,150,0);
  rect(b, 8, 44, 144,  3,     200,165,0);
  circle(b, 8, 50, 3, 80,80,80);
  circle(b, 8, 56, 3, 80,80,80);
  rrect(b, 144, 33, 10, 20,  4, 190,150,0);
  rrect(b, 145, 35,  7,  7,  2, 255,248,145);
  rrect(b, 145, 44,  7,  7,  2, 255,248,145);
  rect(b, 144, 52,  9,  6, 35,35,35);
  wheel(b, 32, 70, 19, 13, 7);
  wheel(b, 124, 70, 19, 13, 7);
  return b;
}

// ── Car 3: Blue Truck ─────────────────────────────────────────────────────
function carTruck() {
  const b = BUF();
  circle(b, 30, 82, 14, 0,0,0, 35); circle(b, 122, 82, 14, 0,0,0, 35);
  rrect(b, 5, 22, 76, 40,  5,  25,80,175);
  rect(b,  5, 22, 76,  5,      18,62,145);
  rect(b,  5, 22,  5, 40,      18,62,145);
  rect(b, 75, 22,  5, 40,      18,62,145);
  rrect(b, 78, 12, 72, 50,  8,  35,100,205);
  rrect(b, 84, 16, 60, 27,  5, 140,200,230, 200);
  rrect(b, 84, 45, 30, 13,  4, 120,185,215, 185);
  rect(b, 143, 17,  7, 45,     22,70,160);
  rrect(b, 143, 20,  7, 11,  2, 255,245,145);
  rect(b, 143, 35,  7, 15,     12,48,100);
  for (let i = 0; i < 4; i++) rect(b, 144, 36+i*4, 6, 2, 45,100,180);
  rect(b, 5, 40, 76,  3,       15,60,148);
  wheel(b, 30, 70, 17, 11, 5);
  wheel(b, 122, 70, 17, 11, 5);
  return b;
}

// ── Car 4: Green Monster Truck ────────────────────────────────────────────
function carMonster() {
  const b = BUF();
  circle(b, 27, 83, 19, 0,0,0, 35); circle(b, 133, 83, 19, 0,0,0, 35);
  rect(b, 18, 58, 14, 14,       75,75,85);
  rect(b, 13, 62, 22,  5,       65,65,75);
  rect(b, 128, 58, 14, 14,      75,75,85);
  rect(b, 125, 62, 22,  5,      65,65,75);
  rrect(b, 20, 7, 120, 50, 10,  20,160,50);
  rect(b, 20, 30, 120,  4,      10,128,38);
  rrect(b, 35, 0,  88, 18,  8,  10,128,35);
  rrect(b, 43, 3,  62, 14,  4, 140,200,230, 205);
  rect(b, 133, 11,  7, 32,      10,128,38);
  rrect(b, 133, 13,  7,  8,  2, 255,248,145);
  rrect(b, 133, 23,  7,  8,  2, 255,248,145);
  rect(b, 133, 33,  7, 10,      10,68,20);
  for (let i = 0; i < 3; i++) rect(b, 134, 34+i*3, 6, 2, 40,100,60);
  rect(b, 100, 0,  5, 11,       55,55,65);
  rect(b, 107, 0,  5, 11,       55,55,65);
  wheel(b, 27, 65, 20, 14, 7);
  wheel(b, 133, 65, 20, 14, 7);
  return b;
}

// ── Generate files ─────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'assets', 'cars');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

[
  ['car_jeep.png',    carJeep()],
  ['car_sports.png',  carSports()],
  ['car_truck.png',   carTruck()],
  ['car_monster.png', carMonster()],
].forEach(([name, buf]) => {
  savePNG(buf, path.join(outDir, name));
  console.log('✓ Created', name);
});
console.log('Done — car assets saved to assets/cars/');
