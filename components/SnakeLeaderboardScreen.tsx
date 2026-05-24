import React from 'react';
import { useSnakeStore, SnakeRun } from '../store/snakeStore';
import GameLeaderboard, { StatColumn, timeColumn } from './game/GameLeaderboard';

const STATS: StatColumn<SnakeRun>[] = [
  { label: 'FOOD',  value: (r) => r.foodEaten },
  { label: 'LEVEL', value: (r) => `LV ${r.level}` },
  timeColumn<SnakeRun>(),
];

export default function SnakeLeaderboardScreen() {
  const highScore     = useSnakeStore((s) => s.highScore);
  const runs          = useSnakeStore((s) => s.runs);
  const loadHighScore = useSnakeStore((s) => s.loadHighScore);
  const loadRuns      = useSnakeStore((s) => s.loadRuns);

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
