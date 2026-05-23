/**
 * Legendary spaceship designs for the Asteroids ship-selection screen.
 *
 * Design space: 100×100 units (scaled by size/100 in the renderer).
 * Nose/front points UP  →  y=0 is top, y=100 is bottom (engines).
 *
 * Each primitive:
 *   rect   { x, y, w, h, r?, angle?, col }
 *          x/y  = top-left corner BEFORE rotation
 *          angle = degrees; React Native rotates around the rect's own center
 *          col  = 'm' (main color) | 'a' (accent color)
 *
 *   circle { cx, cy, d, col }
 *          cx/cy = CENTER of circle, d = diameter
 *          col   = 'm' | 'a'
 *
 * Angle math for a line from A=(x1,y1) to B=(x2,y2):
 *   center = ((x1+x2)/2, (y1+y2)/2)
 *   length = sqrt((x2-x1)²+(y2-y1)²)
 *   angle  = atan2(y2-y1, x2-x1) * 180/PI
 *   → place rect at (center.x - length/2, center.y - h/2), w=length
 */

export type RectPrim = {
  x: number;   // left edge of unrotated rect
  y: number;   // top  edge of unrotated rect
  w: number;
  h: number;
  r?: number;  // borderRadius
  angle?: number;
  col: 'm' | 'a';
};

export type CirclePrim = {
  cx: number;  // center x
  cy: number;  // center y
  d: number;   // diameter
  col: 'm' | 'a';
};

export type ShipDef = {
  id: number;
  name: string;
  from: string;
  quote: string;
  scoreRequired: number;
  color: string;   // main color
  accent: string;  // accent / engine-glow color
  rects: RectPrim[];
  circles: CirclePrim[];
};

// ---------------------------------------------------------------------------
// Helper – convert a stroke from A→B into a rotated rect definition.
// h = stroke thickness (default 6).
// ---------------------------------------------------------------------------
// function lineRect(x1:number,y1:number,x2:number,y2:number,h=6,col:'m'|'a'='m'):RectPrim {
//   const cx=(x1+x2)/2, cy=(y1+y2)/2;
//   const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
//   const angle=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
//   return { x:cx-len/2, y:cy-h/2, w:len, h, angle, col };
// }
// (kept for reference; coordinates below are pre-computed)

export const SHIPS: ShipDef[] = [

  // ── 1 · X-Wing ─────────────────────────────────────────────────────────
  // Classic twin-engine fighter.  Fuselage runs center 10–85.
  // Two pairs of s-foils spread at ±45° from center.
  {
    id: 1,
    name: 'X-Wing',
    from: 'Star Wars',
    quote: 'May the Force be with you.',
    scoreRequired: 0,
    color: '#4FC3F7',
    accent: '#FF6D00',

    rects: [
      // Central fuselage (tall, thin)
      { x: 43, y: 8, w: 14, h: 76, r: 4, col: 'm' },

      // Top-left s-foil: from body (48,30) to tip (10,10)
      // center=(29,20) len=sqrt(38²+20²)=sqrt(1444+400)=sqrt(1844)≈42.9  angle=atan2(-20,-38)≈-152.2°
      { x: 7.5, y: 17, w: 43, h: 6, r: 2, angle: -152, col: 'm' },

      // Top-right s-foil: from (52,30) to (90,10)
      // center=(71,20) angle=atan2(-20,38)≈-27.8°
      { x: 49.5, y: 17, w: 43, h: 6, r: 2, angle: -28, col: 'm' },

      // Bottom-left s-foil: from (48,60) to (10,80)
      // center=(29,70) angle=atan2(20,-38)≈152°
      { x: 7.5, y: 67, w: 43, h: 6, r: 2, angle: 152, col: 'm' },

      // Bottom-right s-foil: from (52,60) to (90,80)
      // center=(71,70) angle=atan2(20,38)≈28°
      { x: 49.5, y: 67, w: 43, h: 6, r: 2, angle: 28, col: 'm' },

      // Cockpit blister
      { x: 41, y: 22, w: 18, h: 12, r: 5, col: 'a' },
    ],

    circles: [
      // Left engine pair (accent glow)
      { cx: 13, cy: 86, d: 9, col: 'a' },
      // Right engine pair (accent glow)
      { cx: 87, cy: 86, d: 9, col: 'a' },
    ],
  },


  // ── 2 · Millennium Falcon ───────────────────────────────────────────────
  // Iconic saucer with offset cockpit tube to the right.
  {
    id: 2,
    name: 'Millennium Falcon',
    from: 'Star Wars',
    quote: 'She may not look like much, but she\'s got it where it counts.',
    scoreRequired: 500,
    color: '#C8B89A',
    accent: '#00B0FF',

    rects: [
      // Main disc body (wide, short)
      { x: 10, y: 28, w: 80, h: 48, r: 24, col: 'm' },

      // Cockpit tube extending right — from right edge of disc to further right
      // A short horizontal arm at y≈50 center
      { x: 72, y: 47, w: 22, h: 10, r: 4, col: 'm' },

      // Forward mandibles — left prong
      // from (28,28) upward-left to (18,12): center=(23,20) len≈20.6 angle≈ -77°
      { x: 12.7, y: 17.7, w: 22, h: 5, r: 2, angle: -77, col: 'm' },

      // Forward mandibles — right prong
      // from (52,28) to (62,12): center=(57,20) angle≈ -57°
      { x: 46, y: 17.7, w: 22, h: 5, r: 2, angle: -57, col: 'm' },

      // Engine bank at rear (bottom)
      { x: 28, y: 70, w: 44, h: 10, r: 3, col: 'm' },
    ],

    circles: [
      // Cockpit bubble
      { cx: 90, cy: 52, d: 12, col: 'a' },
      // Deflector dish (top center of hull)
      { cx: 38, cy: 43, d: 14, col: 'a' },
      // Engine glow
      { cx: 50, cy: 78, d: 10, col: 'a' },
    ],
  },


  // ── 3 · USS Enterprise (NCC-1701) ──────────────────────────────────────
  // Saucer section at top, engineering hull below, two nacelles on pylons.
  {
    id: 3,
    name: 'USS Enterprise',
    from: 'Star Trek',
    quote: 'To boldly go where no man has gone before.',
    scoreRequired: 1000,
    color: '#90CAF9',
    accent: '#E040FB',

    rects: [
      // Engineering hull (thin vertical spine, lower half)
      { x: 45, y: 42, w: 10, h: 36, r: 3, col: 'm' },

      // Left pylon: from spine (48,65) to left nacelle center (18,72)
      // center=(33,68.5) len≈sqrt(30²+7²)=sqrt(900+49)=sqrt(949)≈30.8 angle=atan2(7,-30)≈167°
      { x: 17.6, y: 65.5, w: 31, h: 5, r: 1, angle: 167, col: 'm' },

      // Right pylon: from (52,65) to (82,72)
      // center=(67,68.5) angle=atan2(7,30)≈13°
      { x: 51.5, y: 65.5, w: 31, h: 5, r: 1, angle: 13, col: 'm' },

      // Left nacelle
      { x: 6, y: 68, w: 24, h: 10, r: 5, col: 'm' },

      // Right nacelle
      { x: 70, y: 68, w: 24, h: 10, r: 5, col: 'm' },
    ],

    circles: [
      // Saucer section
      { cx: 50, cy: 28, d: 44, col: 'm' },
      // Bridge dome on top of saucer
      { cx: 50, cy: 14, d: 10, col: 'a' },
      // Bussard collector glow (left; right handled by rect nacelle accent)
      { cx: 18, cy: 68, d: 8, col: 'a' },
    ],
  },


  // ── 4 · TIE Fighter ────────────────────────────────────────────────────
  // Spherical cockpit pod flanked by two large hexagonal solar panels.
  {
    id: 4,
    name: 'TIE Fighter',
    from: 'Star Wars',
    quote: 'TIE fighters do not require hyperdrive.',
    scoreRequired: 2000,
    color: '#CFD8DC',
    accent: '#FF1744',

    rects: [
      // Left solar panel (tall rectangle)
      { x: 4, y: 16, w: 26, h: 68, r: 3, col: 'm' },

      // Right solar panel
      { x: 70, y: 16, w: 26, h: 68, r: 3, col: 'm' },

      // Left wing brace (horizontal strut connecting pod to panel)
      // center x: 4+26/2=17→pod edge≈38; span: from 30 to 38; y center≈50
      { x: 30, y: 47, w: 8, h: 6, col: 'm' },

      // Right wing brace
      { x: 62, y: 47, w: 8, h: 6, col: 'm' },
    ],

    circles: [
      // Central cockpit ball
      { cx: 50, cy: 50, d: 32, col: 'm' },
      // Cockpit viewport (accent)
      { cx: 50, cy: 46, d: 14, col: 'a' },
      // Left panel center detail
      { cx: 17, cy: 50, d: 10, col: 'a' },
      // Right panel center detail
      { cx: 83, cy: 50, d: 10, col: 'a' },
    ],
  },


  // ── 5 · Viper Mk II (Battlestar Galactica) ─────────────────────────────
  // Sleek twin-engine interceptor with swept wings and needle nose.
  {
    id: 5,
    name: 'Viper Mk II',
    from: 'Battlestar Galactica',
    quote: 'So say we all.',
    scoreRequired: 3500,
    color: '#ECEFF1',
    accent: '#FF6F00',

    rects: [
      // Needle nose + fuselage (full length)
      { x: 44, y: 5, w: 12, h: 72, r: 6, col: 'm' },

      // Left swept wing: from fuselage (44,40) to tip (8,70)
      // center=(26,55) len=sqrt(36²+30²)=sqrt(1296+900)=sqrt(2196)≈46.9 angle=atan2(30,-36)≈140°
      { x: 2.6, y: 52.2, w: 47, h: 7, r: 2, angle: 140, col: 'm' },

      // Right swept wing: from (56,40) to (92,70)
      // center=(74,55) angle=atan2(30,36)≈40°
      { x: 50.6, y: 52.2, w: 47, h: 7, r: 2, angle: 40, col: 'm' },

      // Left engine nacelle
      { x: 12, y: 68, w: 16, h: 22, r: 6, col: 'm' },

      // Right engine nacelle
      { x: 72, y: 68, w: 16, h: 22, r: 6, col: 'm' },
    ],

    circles: [
      // Cockpit canopy
      { cx: 50, cy: 30, d: 14, col: 'a' },
      // Left engine glow
      { cx: 20, cy: 89, d: 10, col: 'a' },
      // Right engine glow
      { cx: 80, cy: 89, d: 10, col: 'a' },
    ],
  },


  // ── 6 · Serenity (Firefly) ─────────────────────────────────────────────
  // Blocky transport with wide cargo bay, two top-mounted engine pods,
  // and a large aft main engine.
  {
    id: 6,
    name: 'Serenity',
    from: 'Firefly',
    quote: 'She\'s a good ship. She\'ll keep flying.',
    scoreRequired: 5000,
    color: '#81C784',
    accent: '#FFD740',

    rects: [
      // Main hull (wide body)
      { x: 20, y: 25, w: 60, h: 52, r: 6, col: 'm' },

      // Nose cone (narrower, above main hull)
      { x: 34, y: 8, w: 32, h: 22, r: 8, col: 'm' },

      // Left engine pod (top, canted outward)
      { x: 8, y: 18, w: 18, h: 32, r: 6, col: 'm' },

      // Right engine pod
      { x: 74, y: 18, w: 18, h: 32, r: 6, col: 'm' },

      // Aft engine bell (wide, bottom-center)
      { x: 30, y: 72, w: 40, h: 18, r: 5, col: 'm' },
    ],

    circles: [
      // Left pod engine glow
      { cx: 17, cy: 48, d: 14, col: 'a' },
      // Right pod engine glow
      { cx: 83, cy: 48, d: 14, col: 'a' },
      // Main aft engine glow
      { cx: 50, cy: 89, d: 16, col: 'a' },
    ],
  },


  // ── 7 · Eagle Transporter (Space: 1999) ────────────────────────────────
  // X-frame spine with a command module up front, cargo pod in middle,
  // and four thruster pods at corners.
  {
    id: 7,
    name: 'Eagle Transporter',
    from: 'Space: 1999',
    quote: 'Moonbase Alpha, this is Eagle One.',
    scoreRequired: 7500,
    color: '#90A4AE',
    accent: '#69F0AE',

    rects: [
      // Central spine (vertical)
      { x: 46, y: 10, w: 8, h: 80, r: 2, col: 'm' },

      // Cross-beam (horizontal, mid-ship)
      { x: 10, y: 46, w: 80, h: 8, r: 2, col: 'm' },

      // Command module (forward box)
      { x: 36, y: 8, w: 28, h: 18, r: 5, col: 'm' },

      // Cargo pod (center box)
      { x: 30, y: 38, w: 40, h: 24, r: 4, col: 'm' },
    ],

    circles: [
      // Front command sphere
      { cx: 50, cy: 14, d: 14, col: 'a' },
      // Left thruster pod (implies symmetric right via cross-beam)
      { cx: 14, cy: 50, d: 14, col: 'm' },
      // Right thruster pod
      { cx: 86, cy: 50, d: 14, col: 'm' },
      // Aft engine glow (bottom of spine)
      { cx: 50, cy: 88, d: 12, col: 'a' },
    ],
  },


  // ── 8 · Discovery One (2001: A Space Odyssey) ──────────────────────────
  // Iconic long spine: spherical command sphere at top, long thin boom,
  // nuclear reactor section at bottom, radiator panels mid-ship.
  {
    id: 8,
    name: 'Discovery One',
    from: '2001: A Space Odyssey',
    quote: 'I\'m sorry Dave, I\'m afraid I can\'t do that.',
    scoreRequired: 10000,
    color: '#CE93D8',
    accent: '#E91E63',

    rects: [
      // Central spine / boom (very thin, runs most of the height)
      { x: 48, y: 22, w: 4, h: 68, r: 1, col: 'm' },

      // Left radiator panel (horizontal, mid-ship)
      { x: 14, y: 48, w: 30, h: 6, r: 1, col: 'm' },

      // Right radiator panel
      { x: 56, y: 48, w: 30, h: 6, r: 1, col: 'm' },

      // Reactor module (bottom – wider block)
      { x: 38, y: 78, w: 24, h: 14, r: 3, col: 'm' },

      // Engine bell cluster (very bottom)
      { x: 42, y: 88, w: 16, h: 8, r: 2, col: 'm' },
    ],

    circles: [
      // Command sphere (large, at top)
      { cx: 50, cy: 16, d: 30, col: 'm' },
      // HAL 9000 eye (accent, on sphere)
      { cx: 50, cy: 13, d: 10, col: 'a' },
      // Engine glow (bottom)
      { cx: 50, cy: 94, d: 10, col: 'a' },
    ],
  },


  // ── 9 · Nostromo (Alien) ────────────────────────────────────────────────
  // Massive industrial tug: flat wide forward superstructure,
  // long boom connecting to the huge ore refinery at the back.
  {
    id: 9,
    name: 'Nostromo',
    from: 'Alien',
    quote: 'In space, no one can hear you scream.',
    scoreRequired: 15000,
    color: '#FF8A65',
    accent: '#76FF03',

    rects: [
      // Forward superstructure (wide, flat)
      { x: 16, y: 8, w: 68, h: 28, r: 4, col: 'm' },

      // Central connecting spine
      { x: 46, y: 34, w: 8, h: 36, r: 1, col: 'm' },

      // Left hull strake (angled out from center)
      // from (46,36) to (20,60): center=(33,48) len=sqrt(26²+24²)=sqrt(676+576)=sqrt(1252)≈35.4 angle≈atan2(24,-26)=≈137°
      { x: 15.3, y: 45.3, w: 35, h: 5, r: 1, angle: 137, col: 'm' },

      // Right hull strake: from (54,36) to (80,60)
      // center=(67,48) angle=atan2(24,26)≈43°
      { x: 49.5, y: 45.3, w: 35, h: 5, r: 1, angle: 43, col: 'm' },

      // Aft refinery / ore sled (wide base, bottom)
      { x: 12, y: 68, w: 76, h: 22, r: 6, col: 'm' },
    ],

    circles: [
      // Bridge viewport (top center)
      { cx: 50, cy: 16, d: 12, col: 'a' },
      // Left engine nozzle
      { cx: 26, cy: 88, d: 12, col: 'a' },
      // Right engine nozzle
      { cx: 74, cy: 88, d: 12, col: 'a' },
    ],
  },

];
