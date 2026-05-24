import React from 'react';
import { usePongStore, PongRun } from '../store/pongStore';
import GameLeaderboard, { StatColumn, timeColumn } from './game/GameLeaderboard';

const STATS: StatColumn<PongRun>[] = [
  { label: 'CPU',    value: (r) => r.cpuScore },
  { label: 'RALLY',  value: (r) => r.longestRally },
  timeColumn<PongRun>(),
];

export default function PongLeaderboardScreen() {
  const highScore     = usePongStore((s) => s.highScore);
  const runs          = usePongStore((s) => s.runs);
  const loadHighScore = usePongStore((s) => s.loadHighScore);
  const loadRuns      = usePongStore((s) => s.loadRuns);

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
