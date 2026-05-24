import React, { useState } from 'react';
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

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <SnakeGame />}
      {tab === 'leaderboard' && <SnakeLeaderboardScreen />}
    </GameShell>
  );
}
