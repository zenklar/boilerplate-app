import React, { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { useSnakeStore } from '../../store/snakeStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import SnakeGame from '../../components/SnakeGame';
import SnakeLeaderboardScreen from '../../components/SnakeLeaderboardScreen';

type Tab = 'play' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',   title: 'SNAKE',       iconActive: 'game-controller', iconInactive: 'game-controller-outline' },
  { id: 'leaderboard', label: 'SCORES', title: 'LEADERBOARD', iconActive: 'trophy',          iconInactive: 'trophy-outline' },
];

export default function SnakePage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useSnakeStore((s) => s.isGamePlaying);
  const setIsGamePlaying = useSnakeStore((s) => s.setIsGamePlaying);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/game/snake') {
      setIsGamePlaying(false);
    }
  }, [pathname, setIsGamePlaying]);

  if (pathname !== '/game/snake') return null;

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <SnakeGame />}
      {tab === 'leaderboard' && <SnakeLeaderboardScreen />}
    </GameShell>
  );
}
