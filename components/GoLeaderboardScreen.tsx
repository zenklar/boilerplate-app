import React from 'react';
import { useGoGameStore, GoRunRecord } from '../store/goGameStore';
import GameLeaderboard, { StatColumn, timeColumn } from './game/GameLeaderboard';

const STATS: StatColumn<GoRunRecord>[] = [
  { label: 'COLOR',    value: (r) => r.playerColor === 'black' ? '●' : '○' },
  { label: 'CAPTURES', value: (r) => r.captures },
  { label: 'RESULT',   value: (r) => r.won ? 'WIN' : 'LOSS' },
  timeColumn<GoRunRecord>(),
];

export default function GoLeaderboardScreen() {
  const highScore     = useGoGameStore((s) => s.highScore);
  const runs          = useGoGameStore((s) => s.runs);
  const loadHighScore = useGoGameStore((s) => s.loadHighScore);
  const loadRuns      = useGoGameStore((s) => s.loadRuns);

  return (
    <GameLeaderboard
      highScore={highScore}
      runs={runs}
      stats={STATS}
      loadHighScore={loadHighScore}
      loadRuns={loadRuns}
    />
  );
}
