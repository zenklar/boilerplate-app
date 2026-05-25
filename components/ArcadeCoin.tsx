import { Image } from 'react-native';

export default function ArcadeCoin({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/coin packs/coin.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
