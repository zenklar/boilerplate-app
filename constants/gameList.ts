// Drop replacement images into assets/games/ with the matching filename.
// Each entry's `image` uses a static require() so Metro can bundle it.
export type GameEntry = {
  id: string;
  title: string;
  year: string;
  genre: string;
  available: boolean;
  route?: string;
  accentColor: string;
  image: ReturnType<typeof require>;
};

export const GAME_LIST: GameEntry[] = [
  {
    id: 'asteroids',
    title: 'Asteroids',
    year: '1979',
    genre: 'Space Shooter',
    available: true,
    route: '/game/asteroids',
    accentColor: '#4FC3F7',
    image: require('../assets/games/asteroidsBW.png'),
  },
  {
    id: 'tetris',
    title: 'Tetris',
    year: '1984',
    genre: 'Puzzle',
    available: true,
    route: '/game/tetris',
    accentColor: '#4DD8FF',
    image: require('../assets/games/tetrisBW.png'),
  },
  {
    id: 'snake',
    title: 'Snake',
    year: '1997',
    genre: 'Arcade',
    available: true,
    route: '/game/snake',
    accentColor: '#4ED31F',
    image: require('../assets/games/snakeBW.png'),
  },
  {
    id: 'pong',
    title: 'Pong',
    year: '1972',
    genre: 'Paddle',
    available: true,
    route: '/game/pong',
    accentColor: '#FFFFFF',
    image: require('../assets/games/pongBW.png'),
  },
];
