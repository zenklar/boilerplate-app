/**
 * Shared sizing rules for the title/idle preview frame used by every arcade
 * game (Asteroids, Tetris, Snake, Pong).
 *
 * The whole point of this module is that the four preview frames on the menu
 * MUST be the same size on every platform, every device. Each game imports
 * these constants instead of computing its own per-game box.
 */

/** Target outer dimensions of the preview frame, in DIPs. */
export const PREVIEW_W = 240;
export const PREVIEW_H = 480;

/** Vertical room reserved above the frame for the game title + HIGH SCORE. */
export const PREVIEW_RESERVE_TOP = 160;
/** Vertical room reserved below the frame for INSERT COIN + control hint. */
export const PREVIEW_RESERVE_BOTTOM = 150;

/**
 * Return the preview frame size for the current viewport, downscaling
 * uniformly when the screen is too small to fit the canonical 240×480 box.
 * The aspect ratio is preserved so all four games stay visually identical.
 */
export function fitPreview(availW: number, availH: number): {
  w: number;
  h: number;
  scale: number;
} {
  if (availW <= 0 || availH <= 0) {
    return { w: PREVIEW_W, h: PREVIEW_H, scale: 1 };
  }
  const maxW = Math.max(120, availW - 48);
  const maxH = Math.max(200, availH - PREVIEW_RESERVE_TOP - PREVIEW_RESERVE_BOTTOM);
  const scale = Math.min(1, maxW / PREVIEW_W, maxH / PREVIEW_H);
  return {
    w: Math.floor(PREVIEW_W * scale),
    h: Math.floor(PREVIEW_H * scale),
    scale,
  };
}
