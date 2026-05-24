import React from 'react';
import { useGameUIStore, RunRecord } from '../store/gameStore';
import GameLeaderboard, { StatColumn, timeColumn } from './game/GameLeaderboard';

const STATS: StatColumn<RunRecord>[] = [
  { label: 'SHOTS',     value: (r) => r.bulletsShot },
  { label: 'ASTEROIDS', value: (r) => r.asteroidsDestroyed },
  timeColumn<RunRecord>(),
];

export default function LeaderboardScreen() {
  const highScore     = useGameUIStore((s) => s.highScore);
  const runs          = useGameUIStore((s) => s.runs);
  const loadHighScore = useGameUIStore((s) => s.loadHighScore);
  const loadRuns      = useGameUIStore((s) => s.loadRuns);

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
