// Static image map for enemy saucer sprites. Metro requires literal require() calls.
const ENEMY_IMAGES: Record<number, ReturnType<typeof require>> = {
   1: require('../assets/ships/enemy/enemy_01.png'),
   2: require('../assets/ships/enemy/enemy_02.png'),
   3: require('../assets/ships/enemy/enemy_03.png'),
   4: require('../assets/ships/enemy/enemy_04.png'),
   5: require('../assets/ships/enemy/enemy_05.png'),
   6: require('../assets/ships/enemy/enemy_06.png'),
   7: require('../assets/ships/enemy/enemy_07.png'),
   8: require('../assets/ships/enemy/enemy_08.png'),
   9: require('../assets/ships/enemy/enemy_09.png'),
  10: require('../assets/ships/enemy/enemy_10.png'),
  11: require('../assets/ships/enemy/enemy_11.png'),
  12: require('../assets/ships/enemy/enemy_12.png'),
  13: require('../assets/ships/enemy/enemy_13.png'),
  14: require('../assets/ships/enemy/enemy_14.png'),
  15: require('../assets/ships/enemy/enemy_15.png'),
  16: require('../assets/ships/enemy/enemy_16.png'),
  17: require('../assets/ships/enemy/enemy_17.png'),
  18: require('../assets/ships/enemy/enemy_18.png'),
};

export const ENEMY_DESIGN_IDS = Object.keys(ENEMY_IMAGES).map(Number);

export default ENEMY_IMAGES;
