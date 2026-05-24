import React from 'react';
import { useTetrisStore, TetrisRun } from '../store/tetrisStore';
import GameLeaderboard, { StatColumn, timeColumn } from './game/GameLeaderboard';

const STATS: StatColumn<TetrisRun>[] = [
  { label: 'LINES', value: (r) => r.lines },
  { label: 'LEVEL', value: (r) => `LV ${r.level}` },
  timeColumn<TetrisRun>(),
];

export default function TetrisLeaderboardScreen() {
  const highScore     = useTetrisStore((s) => s.highScore);
  const runs          = useTetrisStore((s) => s.runs);
  const loadHighScore = useTetrisStore((s) => s.loadHighScore);
  const loadRuns      = useTetrisStore((s) => s.loadRuns);

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
