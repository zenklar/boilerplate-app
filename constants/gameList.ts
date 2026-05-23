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

const PLACEHOLDER = require('../assets/games/placeholder.png');

export const GAME_LIST: GameEntry[] = [
  {
    id: 'asteroids',
    title: 'Asteroids',
    year: '1979',
    genre: 'Space Shooter',
    available: true,
    route: '/game/asteroids',
    accentColor: '#4FC3F7',
    image: require('../assets/games/asteroids.png'),
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    year: '1978',
    genre: 'Shooter',
    available: false,
    accentColor: '#69F0AE',
    image: PLACEHOLDER,
  },
  {
    id: 'pacman',
    title: 'Pac-Man',
    year: '1980',
    genre: 'Maze',
    available: false,
    accentColor: '#FFD700',
    image: PLACEHOLDER,
  },
  {
    id: 'tetris',
    title: 'Tetris',
    year: '1984',
    genre: 'Puzzle',
    available: false,
    accentColor: '#7C4DFF',
    image: PLACEHOLDER,
  },
  {
    id: 'centipede',
    title: 'Centipede',
    year: '1980',
    genre: 'Shooter',
    available: false,
    accentColor: '#8BC34A',
    image: PLACEHOLDER,
  },
  {
    id: 'donkeykong',
    title: 'Donkey Kong',
    year: '1981',
    genre: 'Platform',
    available: false,
    accentColor: '#FF6D00',
    image: PLACEHOLDER,
  },
  {
    id: 'galaga',
    title: 'Galaga',
    year: '1981',
    genre: 'Shooter',
    available: false,
    accentColor: '#E040FB',
    image: PLACEHOLDER,
  },
  {
    id: 'frogger',
    title: 'Frogger',
    year: '1981',
    genre: 'Action',
    available: false,
    accentColor: '#26A69A',
    image: PLACEHOLDER,
  },
  {
    id: 'breakout',
    title: 'Breakout',
    year: '1976',
    genre: 'Action',
    available: false,
    accentColor: '#FF5252',
    image: PLACEHOLDER,
  },
];
