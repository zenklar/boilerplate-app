// Tetris piece definitions — classic 7 tetrominoes with their rotation states.
// Each rotation is a 2D array of 0/1 marking which cells the piece fills.
export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export const TETROMINOS: Record<TetrominoType, number[][][]> = {
  I: [
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
  ],
  O: [
    [[1, 1], [1, 1]],
  ],
  T: [
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 1], [1, 0]],
    [[1, 1, 1], [0, 1, 0]],
    [[0, 1], [1, 1], [0, 1]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0]],
    [[1, 0], [1, 1], [0, 1]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1], [1, 1], [1, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1]],
    [[1, 1], [1, 0], [1, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[0, 1], [0, 1], [1, 1]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1]],
    [[1, 0], [1, 0], [1, 1]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1], [0, 1], [0, 1]],
  ],
};

// Classic NES Tetris-ish palette, tuned for the arcade pixel look.
export const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: '#4DD8FF',
  O: '#FFD24A',
  T: '#C77DFF',
  S: '#5BE26B',
  Z: '#FF5B5B',
  J: '#4D7AFF',
  L: '#FF9A3C',
};

export const BOARD_W = 10;
export const BOARD_H = 20;

// Score table (BPS): bonus per simultaneous line clear, multiplied by level.
export const LINE_SCORE = [0, 40, 100, 300, 1200];

// Frames per cell drop at each level (1 frame = 16ms tick).
export const DROP_FRAMES_PER_LEVEL = (level: number): number => {
  const table = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2];
  return table[Math.min(level - 1, table.length - 1)] ?? 2;
};

export const TETROMINO_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
