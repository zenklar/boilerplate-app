import React, { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { useHillClimbStore } from '../../store/hillClimbStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import HillClimbGame from '../../components/games/hillclimb/HillClimbGame';
import HillClimbLeaderboard from '../../components/games/hillclimb/HillClimbLeaderboard';

type Tab = 'play' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',   title: 'HILL CLIMB', iconActive: 'car-sport',  iconInactive: 'car-sport-outline'  },
  { id: 'leaderboard', label: 'SCORES', title: 'BEST RUNS',  iconActive: 'trophy',     iconInactive: 'trophy-outline'     },
];

export default function HillClimbPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useHillClimbStore(s => s.isGamePlaying);
  const setIsGamePlaying = useHillClimbStore(s => s.setIsGamePlaying);
  const load = useHillClimbStore(s => s.load);
  const pathname = usePathname();

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (pathname !== '/game/hill-climb') setIsGamePlaying(false);
  }, [pathname, setIsGamePlaying]);

  if (pathname !== '/game/hill-climb') return null;

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <HillClimbGame />}
      {tab === 'leaderboard' && <HillClimbLeaderboard />}
    </GameShell>
  );
}
