import React, { useState } from 'react';
import { useGameUIStore } from '../../store/gameStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import AsteroidsGame from '../../components/AsteroidsGame';
import ShipSelectScreen from '../../components/ShipSelectScreen';
import LeaderboardScreen from '../../components/LeaderboardScreen';
import EnemyCodexScreen from '../../components/EnemyCodexScreen';

type Tab = 'play' | 'ships' | 'enemies' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',    title: 'ASTEROIDS',   iconActive: 'game-controller', iconInactive: 'game-controller-outline' },
  { id: 'ships',       label: 'SHIPS',   title: 'SELECT SHIP', iconActive: 'rocket',          iconInactive: 'rocket-outline' },
  { id: 'enemies',     label: 'ENEMIES', title: 'ENEMY CODEX', iconActive: 'skull',           iconInactive: 'skull-outline' },
  { id: 'leaderboard', label: 'SCORES',  title: 'LEADERBOARD', iconActive: 'trophy',          iconInactive: 'trophy-outline' },
];

export default function AsteroidsPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = useGameUIStore((s) => s.isGamePlaying);

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <AsteroidsGame />}
      {tab === 'ships'       && <ShipSelectScreen />}
      {tab === 'enemies'     && <EnemyCodexScreen />}
      {tab === 'leaderboard' && <LeaderboardScreen />}
    </GameShell>
  );
}
