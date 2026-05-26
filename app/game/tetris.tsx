import React, { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { useTetrisStore } from '../../store/tetrisStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import TetrisGame from '../../components/TetrisGame';
import TetrisLeaderboardScreen from '../../components/TetrisLeaderboardScreen';

type Tab = 'play' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',   title: 'TETRIS',      iconActive: 'game-controller', iconInactive: 'game-controller-outline' },
  { id: 'leaderboard', label: 'SCORES', title: 'LEADERBOARD', iconActive: 'trophy',          iconInactive: 'trophy-outline' },
];

export default function TetrisPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useTetrisStore((s) => s.isGamePlaying);
  const setIsGamePlaying = useTetrisStore((s) => s.setIsGamePlaying);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/game/tetris') {
      setIsGamePlaying(false);
    }
  }, [pathname, setIsGamePlaying]);

  if (pathname !== '/game/tetris') return null;

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <TetrisGame />}
      {tab === 'leaderboard' && <TetrisLeaderboardScreen />}
    </GameShell>
  );
}
