import React, { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { useGameUIStore } from '../../store/gameStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import GoGame from '../../components/GoGame';
import GoLeaderboardScreen from '../../components/GoLeaderboardScreen';

type Tab = 'play' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',   title: 'GO',          iconActive: 'grid',    iconInactive: 'grid-outline' },
  { id: 'leaderboard', label: 'SCORES', title: 'LEADERBOARD', iconActive: 'trophy',  iconInactive: 'trophy-outline' },
];

export default function GoPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying    = useGameUIStore((s) => s.isGamePlaying);
  const setIsGamePlaying = useGameUIStore((s) => s.setIsGamePlaying);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/game/go') setIsGamePlaying(false);
  }, [pathname, setIsGamePlaying]);

  if (pathname !== '/game/go') return null;

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <GoGame />}
      {tab === 'leaderboard' && <GoLeaderboardScreen />}
    </GameShell>
  );
}
