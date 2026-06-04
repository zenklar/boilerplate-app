export const TERRAIN_STEP = 12;
export const CAR_SCREEN_X_RATIO = 0.38;

export function terrainY(worldX: number, gameHeight: number): number {
  const baseline = gameHeight * 0.56;
  if (worldX <= 0) return baseline;
  if (worldX < 300) {
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

export function terrainAngle(worldX: number, gameHeight: number): number {
  const dx = 6;
  return Math.atan2(
    terrainY(worldX + dx, gameHeight) - terrainY(worldX - dx, gameHeight),
    dx * 2,
  );
}

export function buildTerrainPath(cameraX: number, screenWidth: number, gameHeight: number): string {
  const startWX = Math.floor(cameraX / TERRAIN_STEP) * TERRAIN_STEP - TERRAIN_STEP;
  const endWX = cameraX + screenWidth + TERRAIN_STEP * 2;
  const pts: string[] = [];
  for (let wx = startWX; wx <= endWX; wx += TERRAIN_STEP) {
    pts.push(`${(wx - cameraX).toFixed(1)},${terrainY(wx, gameHeight).toFixed(1)}`);
  }
  if (pts.length < 2) return '';
  const lastX = (endWX - cameraX).toFixed(1);
  const firstX = (startWX - cameraX).toFixed(1);
  const bottom = (gameHeight + 5).toFixed(1);
  return `M ${pts.join(' L ')} L ${lastX},${bottom} L ${firstX},${bottom} Z`;
}

export function generateCoins(count: number, gameHeight: number): Array<{ worldX: number; worldY: number }> {
  return Array.from({ length: count }, (_, i) => {
    const wx = 350 + i * 160 + (i % 3) * 40;
    return { worldX: wx, worldY: terrainY(wx, gameHeight) - 35 };
  });
}
