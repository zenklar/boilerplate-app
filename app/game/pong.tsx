import React, { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { usePongStore } from '../../store/pongStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import PongGame from '../../components/PongGame';
import PongLeaderboardScreen from '../../components/PongLeaderboardScreen';

type Tab = 'play' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',   title: 'PONG',        iconActive: 'game-controller', iconInactive: 'game-controller-outline' },
  { id: 'leaderboard', label: 'SCORES', title: 'LEADERBOARD', iconActive: 'trophy',          iconInactive: 'trophy-outline' },
];

export default function PongPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = usePongStore((s) => s.isGamePlaying);
  const setIsGamePlaying = usePongStore((s) => s.setIsGamePlaying);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/game/pong') {
      setIsGamePlaying(false);
    }
  }, [pathname, setIsGamePlaying]);

  if (pathname !== '/game/pong') return null;

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <PongGame />}
      {tab === 'leaderboard' && <PongLeaderboardScreen />}
    </GameShell>
  );
}
