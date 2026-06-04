/**
 * Procedural terrain generation for Hill Climb Racing.
 *
 * Screen Y increases downward. Higher Y = lower on screen (valleys).
 * Lower Y = higher on screen (hill peaks).
 *
 * terrainY(x, gameHeight) returns the screen Y of the terrain surface at world x.
 */

export const TERRAIN_STEP = 12; // world pixels between terrain sample points
export const CAR_SCREEN_X_RATIO = 0.38; // car is rendered at this fraction of screen width

/**
 * Returns terrain surface Y (screen pixels) at world X.
 * Combines several sine waves for a natural-looking landscape.
 */
export function terrainY(worldX: number, gameHeight: number): number {
  const baseline = gameHeight * 0.56;
  if (worldX <= 0) return baseline;
  if (worldX < 300) {
    // flat starting area, gentle blend into hills
    const t = worldX / 300;
    return baseline * (1 - t) + (baseline + hillOffset(worldX)) * t;
  }
  return baseline + hillOffset(worldX);
}

function hillOffset(x: number): number {
  return (
    Math.sin(x * 0.0055) * 95 +
    Math.sin(x * 0.017)  * 50 +
    Math.sin(x * 0.038)  * 22 +
    Math.sin(x * 0.09)   * 8
  );
}

/**
 * Returns the terrain slope angle (radians) at world X.
 * Positive angle = going downhill (Y increases).
 * Negative angle = going uphill (Y decreases).
 */
export function terrainAngle(worldX: number, gameHeight: number): number {
  const dx = 6;
  const y1 = terrainY(worldX - dx, gameHeight);
  const y2 = terrainY(worldX + dx, gameHeight);
  return Math.atan2(y2 - y1, dx * 2);
}

/**
 * Builds an SVG path string for the terrain fill polygon visible in [cameraX, cameraX + screenWidth].
 */
export function buildTerrainPath(
  cameraX: number,
  screenWidth: number,
  gameHeight: number,
): string {
  const startWX = Math.floor(cameraX / TERRAIN_STEP) * TERRAIN_STEP - TERRAIN_STEP;
  const endWX = cameraX + screenWidth + TERRAIN_STEP * 2;
  const points: string[] = [];

  for (let wx = startWX; wx <= endWX; wx += TERRAIN_STEP) {
    const sx = wx - cameraX;
    const sy = terrainY(wx, gameHeight);
    points.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
  }

  if (points.length < 2) return '';

  const lastX = (endWX - cameraX).toFixed(1);
  const firstX = (startWX - cameraX).toFixed(1);
  const bottom = (gameHeight + 5).toFixed(1);

  return `M ${points.join(' L ')} L ${lastX},${bottom} L ${firstX},${bottom} Z`;
}

/**
 * Returns coin world positions for a run.
 * Coins are placed floating above the terrain at regular intervals.
 */
export function generateCoins(
  count: number,
  gameHeight: number,
): Array<{ worldX: number; worldY: number }> {
  const coins: Array<{ worldX: number; worldY: number }> = [];
  for (let i = 0; i < count; i++) {
    const wx = 350 + i * 160 + (i % 3) * 40;
    const wy = terrainY(wx, gameHeight) - 35;
    coins.push({ worldX: wx, worldY: wy });
  }
  return coins;
}
