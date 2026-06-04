#!/usr/bin/env node
/**
 * Generates Hill Climb Racing assets:
 *   assets/cars/car_*.png   — 4 car sprites (160×90)
 *   assets/games/hill-climb.png — game cover (480×640)
 *
 * Pure Node.js (zlib + fs), no external dependencies.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── PNG encoder ────────────────────────────────────────────────────────────
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
function pngChunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function savePNG(rgba, w, h, filename) {
  const rowLen = w * 4;
  const raw = Buffer.alloc(h * (rowLen + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (rowLen + 1)] = 0;
    rgba.copy(raw, y * (rowLen + 1) + 1, y * rowLen, (y + 1) * rowLen);
  }
  const idat = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(filename, Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',idat), pngChunk('IEND',Buffer.alloc(0))]));
}

// ── Drawing primitives ─────────────────────────────────────────────────────
function mkBuf(w, h) { return Buffer.alloc(w * h * 4, 0); }
function sp(buf, w, x, y, r, g, b, a = 255) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || xi >= w || yi < 0 || yi >= buf.length / (w * 4)) return;
  const i = (yi * w + xi) * 4, al = a / 255;
  buf[i]   = (buf[i]   * (1-al) + r*al) | 0;
  buf[i+1] = (buf[i+1] * (1-al) + g*al) | 0;
  buf[i+2] = (buf[i+2] * (1-al) + b*al) | 0;
  buf[i+3] = Math.min(255, buf[i+3] + a);
}
function rect(buf, w, x, y, rw, rh, r, g, b, a = 255) {
  for (let dy = 0; dy < rh; dy++)
    for (let dx = 0; dx < rw; dx++) sp(buf, w, x+dx, y+dy, r, g, b, a);
}
function rrect(buf, w, x, y, rw, rh, rx, r, g, b, a = 255) {
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const px = x+dx, py = y+dy;
      let skip = false;
      if (px<x+rx&&py<y+rx){const cx=px-(x+rx),cy=py-(y+rx);if(cx*cx+cy*cy>rx*rx)skip=true;}
      if(!skip&&px>=x+rw-rx&&py<y+rx){const cx=px-(x+rw-rx),cy=py-(y+rx);if(cx*cx+cy*cy>rx*rx)skip=true;}
      if(!skip&&px<x+rx&&py>=y+rh-rx){const cx=px-(x+rx),cy=py-(y+rh-rx);if(cx*cx+cy*cy>rx*rx)skip=true;}
      if(!skip&&px>=x+rw-rx&&py>=y+rh-rx){const cx=px-(x+rw-rx),cy=py-(y+rh-rx);if(cx*cx+cy*cy>rx*rx)skip=true;}
      if (!skip) sp(buf, w, px, py, r, g, b, a);
    }
  }
}
function circle(buf, w, cx, cy, rad, r, g, b, a = 255) {
  for (let dy=-rad;dy<=rad;dy++)
    for (let dx=-rad;dx<=rad;dx++)
      if (dx*dx+dy*dy<=rad*rad) sp(buf,w,cx+dx,cy+dy,r,g,b,a);
}
function wheel(buf, w, cx, cy, outerR, rimR, hubR) {
  circle(buf,w,cx,cy,outerR,22,22,22);
  for(let a=0;a<6;a++){const ang=a*Math.PI/3;circle(buf,w,cx+Math.round(Math.cos(ang)*(outerR-4)),cy+Math.round(Math.sin(ang)*(outerR-4)),2,8,8,8);}
  circle(buf,w,cx,cy,rimR,140,140,150);circle(buf,w,cx,cy,rimR-3,170,170,180);
  circle(buf,w,cx,cy,hubR,210,210,215);circle(buf,w,cx,cy,3,85,85,90);
}

// ── Car sprites (160×90) ───────────────────────────────────────────────────
const CW = 160, CH = 90;

function carJeep() {
  const b=mkBuf(CW,CH);
  circle(b,CW,36,83,13,0,0,0,35);circle(b,CW,121,83,13,0,0,0,35);
  rrect(b,CW,9,20,141,40,7,210,38,38);rrect(b,CW,30,4,88,24,6,185,22,22);
  rrect(b,CW,34,7,32,17,4,140,200,230,200);rrect(b,CW,76,7,36,17,4,140,200,230,200);
  rect(b,CW,68,7,5,17,170,15,15);rect(b,CW,9,38,141,4,180,28,28);
  rrect(b,CW,143,26,10,22,3,155,28,28);rrect(b,CW,144,28,7,9,2,255,242,140);
  rect(b,CW,5,28,7,22,150,28,28);rect(b,CW,32,3,84,4,160,12,12);
  rect(b,CW,9,55,141,5,190,35,35);
  wheel(b,CW,36,70,18,12,6);wheel(b,CW,121,70,18,12,6);
  return b;
}
function carSports() {
  const b=mkBuf(CW,CH);
  circle(b,CW,32,83,15,0,0,0,35);circle(b,CW,124,83,15,0,0,0,35);
  rect(b,CW,4,24,16,5,200,162,0);rect(b,CW,4,29,8,4,165,133,0);
  rrect(b,CW,8,30,144,30,11,240,190,0);rrect(b,CW,38,9,74,27,6,210,165,0);
  rrect(b,CW,42,12,28,20,4,140,200,230,190);rrect(b,CW,74,12,34,20,4,140,200,230,190);
  rect(b,CW,70,12,5,20,190,150,0);rect(b,CW,8,44,144,3,200,165,0);
  circle(b,CW,8,50,3,80,80,80);circle(b,CW,8,56,3,80,80,80);
  rrect(b,CW,144,33,10,20,4,190,150,0);rrect(b,CW,145,35,7,7,2,255,248,145);
  rrect(b,CW,145,44,7,7,2,255,248,145);rect(b,CW,144,52,9,6,35,35,35);
  wheel(b,CW,32,70,19,13,7);wheel(b,CW,124,70,19,13,7);
  return b;
}
function carTruck() {
  const b=mkBuf(CW,CH);
  circle(b,CW,30,82,14,0,0,0,35);circle(b,CW,122,82,14,0,0,0,35);
  rrect(b,CW,5,22,76,40,5,25,80,175);rect(b,CW,5,22,76,5,18,62,145);
  rect(b,CW,5,22,5,40,18,62,145);rect(b,CW,75,22,5,40,18,62,145);
  rrect(b,CW,78,12,72,50,8,35,100,205);rrect(b,CW,84,16,60,27,5,140,200,230,200);
  rrect(b,CW,84,45,30,13,4,120,185,215,185);rect(b,CW,143,17,7,45,22,70,160);
  rrect(b,CW,143,20,7,11,2,255,245,145);rect(b,CW,143,35,7,15,12,48,100);
  for(let i=0;i<4;i++) rect(b,CW,144,36+i*4,6,2,45,100,180);
  rect(b,CW,5,40,76,3,15,60,148);
  wheel(b,CW,30,70,17,11,5);wheel(b,CW,122,70,17,11,5);
  return b;
}
function carMonster() {
  const b=mkBuf(CW,CH);
  circle(b,CW,27,83,19,0,0,0,35);circle(b,CW,133,83,19,0,0,0,35);
  rect(b,CW,18,58,14,14,75,75,85);rect(b,CW,13,62,22,5,65,65,75);
  rect(b,CW,128,58,14,14,75,75,85);rect(b,CW,125,62,22,5,65,65,75);
  rrect(b,CW,20,7,120,50,10,20,160,50);rect(b,CW,20,30,120,4,10,128,38);
  rrect(b,CW,35,0,88,18,8,10,128,35);rrect(b,CW,43,3,62,14,4,140,200,230,205);
  rect(b,CW,133,11,7,32,10,128,38);rrect(b,CW,133,13,7,8,2,255,248,145);
  rrect(b,CW,133,23,7,8,2,255,248,145);rect(b,CW,133,33,7,10,10,68,20);
  for(let i=0;i<3;i++) rect(b,CW,134,34+i*3,6,2,40,100,60);
  rect(b,CW,100,0,5,11,55,55,65);rect(b,CW,107,0,5,11,55,55,65);
  wheel(b,CW,27,65,20,14,7);wheel(b,CW,133,65,20,14,7);
  return b;
}

// ── Cover image (480×640) ─────────────────────────────────────────────────
const CVW = 480, CVH = 640;

function gameCover() {
  const b = mkBuf(CVW, CVH);

  // Sky gradient: deep night blue → twilight → orange horizon
  for (let y = 0; y < CVH * 0.55; y++) {
    const t = y / (CVH * 0.55);
    const r = Math.round(10 + t * 200);
    const g = Math.round(10 + t * 100);
    const bl= Math.round(40 + t * 60);
    rect(b, CVW, 0, y, CVW, 1, r, g, bl);
  }
  // Sunset horizon band
  for (let y = Math.round(CVH*0.45); y < Math.round(CVH*0.62); y++) {
    const t = (y - CVH*0.45) / (CVH*0.17);
    const r = Math.round(210 + t*45);
    const g = Math.round(110 - t*30);
    const bl = Math.round(100 - t*80);
    rect(b, CVW, 0, y, CVW, 1, Math.min(r,255), Math.max(g,0), Math.max(bl,0));
  }

  // Sun
  circle(b, CVW, 360, 130, 48, 255, 220, 60);
  circle(b, CVW, 360, 130, 42, 255, 240, 100);
  circle(b, CVW, 360, 130, 36, 255, 255, 180);

  // Far mountains (dark silhouette)
  const mPts = [[0,460],[60,350],[120,400],[180,310],[240,360],[300,290],[360,340],[420,300],[480,380],[480,500],[0,500]];
  for (let y = 0; y < CVH; y++) {
    for (let x = 0; x < CVW; x++) {
      if (inPolygon(mPts, x, y)) sp(b, CVW, x, y, 22, 55, 22);
    }
  }

  // Near hills (green)
  const hPts = [[0,520],[80,430],[160,470],[240,400],[320,450],[400,420],[480,460],[480,640],[0,640]];
  for (let y = 0; y < CVH; y++) {
    for (let x = 0; x < CVW; x++) {
      if (inPolygon(hPts, x, y)) {
        const shade = y > 520 ? 35 : 50 + Math.round((y-400)/120*20);
        sp(b, CVW, x, y, 20, shade+30, 15);
      }
    }
  }

  // Dirt road surface
  const rPts = [[0,530],[480,470],[480,500],[0,560]];
  for (let y = 0; y < CVH; y++) {
    for (let x = 0; x < CVW; x++) {
      if (inPolygon(rPts, x, y)) sp(b, CVW, x, y, 100, 70, 45);
    }
  }

  // Ground fill
  rect(b, CVW, 0, 555, CVW, CVH-555, 28, 80, 20);

  // Grass edge on road
  for (let x = 0; x < CVW; x++) {
    const roadY = Math.round(530 - x * 0.125);
    for (let dy = 0; dy < 6; dy++) sp(b, CVW, x, roadY+dy, 45, 120, 30);
  }

  // Car (large, positioned on the hill)
  const carX = 160, carY = 490;
  const angle = -0.18; // slight uphill tilt
  drawCarOnCover(b, carX, carY, angle);

  // Coins floating along path
  const coinPositions = [[80,510],[220,490],[320,470],[420,455]];
  for (const [cx,cy] of coinPositions) {
    circle(b, CVW, cx, cy, 12, 255, 215, 0);
    circle(b, CVW, cx, cy, 9, 255, 185, 0);
    circle(b, CVW, cx, cy, 5, 255, 240, 80);
    circle(b, CVW, cx, cy, 2, 255, 255, 200);
  }

  // Stars in sky
  const starPos = [[40,40],[120,25],[200,55],[320,30],[400,60],[60,90],[280,80],[450,45],[150,70],[370,20]];
  for (const [sx,sy] of starPos) {
    circle(b, CVW, sx, sy, 2, 255, 255, 220, 200);
    circle(b, CVW, sx, sy, 1, 255, 255, 255);
  }

  // Title text block at bottom
  rect(b, CVW, 0, CVH-120, CVW, 120, 0,0,0, 180);
  drawText(b, CVW, 'HILL CLIMB', 40, CVH-98, 30, 200,160,0);
  drawText(b, CVW, 'RACING', 100, CVH-55, 24, 255,220,50);

  return b;
}

// Draw a simplified car on the cover (scaled up, no transparency)
function drawCarOnCover(buf, cx, cy, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  function tp(dx, dy) {
    return [cx + dx*cos - dy*sin, cy + dx*sin + dy*cos];
  }
  function trect(x,y,w,h,r,g,bl,a=255){
    for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++){
      const [px,py]=tp(x+dx-w/2,y+dy-h/2);
      sp(buf,CVW,Math.round(px),Math.round(py),r,g,bl,a);
    }
  }
  function tcirc(dx,dy,rad,r,g,bl){
    for(let ddy=-rad;ddy<=rad;ddy++) for(let ddx=-rad;ddx<=rad;ddx++){
      if(ddx*ddx+ddy*ddy<=rad*rad){
        const[px,py]=tp(dx+ddx,dy+ddy); sp(buf,CVW,Math.round(px),Math.round(py),r,g,bl);
      }
    }
  }
  // Shadow
  for(let dx=-55;dx<=55;dx++) sp(buf,CVW,cx+dx,cy+18,0,0,0,50);
  // Body
  trect(0,-8,100,32,8,210,38,38);
  // Cabin
  trect(-5,-28,72,20,6,185,22,22);
  // Windows
  trect(-14,-28,26,15,3,140,200,230,200);trect(10,-28,24,15,3,140,200,230,200);
  // Details
  trect(0,-4,100,3,1,180,28,28);
  // Headlight
  trect(46,-10,8,10,2,255,242,140);
  // Wheels
  tcirc(-30,20,22,22,22,22);tcirc(-30,20,15,140,140,150);tcirc(-30,20,7,210,210,215);
  tcirc(30,20,22,22,22,22);tcirc(30,20,15,140,140,150);tcirc(30,20,7,210,210,215);
}

// Simple pixel text (5×8 glyphs scaled up)
const GLYPHS = {
  'H':[[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1]],
  'I':[[0,1,1,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  'L':[[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  'C':[[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0]],
  'M':[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'B':[[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0]],
  'R':[[1,1,1,0,0],[1,0,0,1,0],[1,1,1,0,0],[1,0,1,0,0],[1,0,0,1,0]],
  'A':[[0,1,1,1,0],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1]],
  'N':[[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1]],
  'G':[[0,1,1,1,0],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[0,1,1,1,0]],
  ' ':[[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
};
function drawText(buf, w, text, x, y, scale, r, g, bl) {
  const px = Math.round(scale * 0.7), py = scale;
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) { cx += px * 6; continue; }
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col]) {
          rect(buf, w, cx + col*px, y + row*py, px, py, r, g, bl);
        }
      }
    }
    cx += px * 6;
  }
}

// Point-in-polygon (ray casting)
function inPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length-1; i < poly.length; j = i++) {
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

// ── Generate all files ─────────────────────────────────────────────────────
const carsDir  = path.join(__dirname,'..','assets','cars');
const gamesDir = path.join(__dirname,'..','assets','games');
[carsDir,gamesDir].forEach(d => { if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); });

[
  [path.join(carsDir,'car_jeep.png'),    carJeep(),    CW, CH],
  [path.join(carsDir,'car_sports.png'),  carSports(),  CW, CH],
  [path.join(carsDir,'car_truck.png'),   carTruck(),   CW, CH],
  [path.join(carsDir,'car_monster.png'), carMonster(), CW, CH],
  [path.join(gamesDir,'hill-climb.png'), gameCover(),  CVW, CVH],
].forEach(([fn, buf, w, h]) => {
  savePNG(buf, w, h, fn);
  console.log('✓ Created', path.basename(fn));
});
