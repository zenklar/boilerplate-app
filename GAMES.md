# Adding a New Game

Every game in this app follows the same pattern. Use this guide whenever you
add a new one — it keeps the look-and-feel consistent and minimizes the
amount of new code you have to write.

The current games (Asteroids, Tetris, Snake) are the reference
implementations. When in doubt, copy from **Tetris** — its frame size and
preview behavior are canonical.

## 1. Required pieces

For every new game you must add:

1. **Home-page tile** — a grid entry in `constants/gameList.ts`. Start as
   `available: false` (renders as a "SOON" placeholder tile, copying the
   placeholder cover image) until the game is playable.
2. **Route** — `app/game/<id>.tsx`. A tiny file that wires `GameShell` to the
   game and leaderboard components.
3. **Play page** — a fullscreen game component with a looping preview/demo
   shown on the title screen.
4. **Leaderboard page** — uses `<GameLeaderboard>` with per-game stat columns.
5. **Per-game store** — created with `createGameSessionStore`. Persists the
   high score and last 10 runs to AsyncStorage.

That is it. Headers, tab bars, coin counters, EXIT buttons, ∞ subscription
state, and best-score cards all come from shared components.

## 2. Unifying rules (do not break these)

- **Every game has a `play` tab and a `leaderboard` tab.** Extra tabs are
  allowed (Asteroids has `ships` and `enemies`) but `play` is always first
  and `leaderboard` is always last.
- **One coin = one run.** Before starting a run, call
  `useCoinStore.getState().spendCoin()` — unless `useSubscriptionStore`'s
  `isSubscribed` is true, in which case the run is free.
- **The play tab always shows a looping gameplay preview** behind the title
  card when the player is idle. The demo is the same component playing
  itself with a simple AI; it pauses/clears when the player inserts a coin.
- **The preview lives inside the game frame** — same board size, same
  borders, same position as during real play. Do not float the preview
  outside the frame. Tetris is the reference.
- **Menu colors are locked.** The bottom tab bar's active color is
  `GAME_ACCENT` (`#FFD700`, exported from `components/game/GameShell.tsx`).
  Inactive is `#777`. Header title and labels use the `MONO` font. Do not
  override these per game — the unified arcade look depends on it.
- **Coin counter behavior is shared.** `GameShell` already renders the coin
  pill in the header and shows `∞` when the Arcade Pass is active. Don't
  add a second counter.

## 3. Step-by-step: add a game called "Pong"

### 3.1. Add the home tile

In `constants/gameList.ts`, add an entry. Drop a cover image at
`assets/games/pong.png` (or reuse `placeholder.png` while a real cover is
being made):

```ts
{
  id: 'pong',
  title: 'Pong',
  year: '1972',
  genre: 'Paddle',
  available: false,                       // flip to true when ready
  route: '/game/pong',
  accentColor: '#FFD700',                 // legacy field, kept for parity
  image: require('../assets/games/pong.png'),
}
```

While `available` is false the tile renders with a "SOON" badge and is
unpressable — perfect placeholder state.

### 3.2. Create the per-game store

`store/pongStore.ts`:

```ts
import { createGameSessionStore } from './createGameSessionStore';

export type PongRun = {
  id: string;
  score: number;
  durationMs: number;
  date: number;
  rallies: number;                        // game-specific stat
};

export const usePongStore = createGameSessionStore<PongRun>('pong');
```

Storage keys are auto-namespaced to `@pong/high_score` and `@pong/runs`.

### 3.3. Build the game component

`components/PongGame.tsx`. Copy `components/SnakeGame.tsx` as a starting
skeleton — it's the smallest of the three. Keep these structural points:

- Use the same `Phase` union: `'idle' | 'demo' | 'coinanim' | 'countdown' | 'playing' | 'gameover'`.
- Render the demo *inside* the same `<View style={s.board} />` you use for
  real play. Reserve top/bottom padding when in demo so the title overlay
  has room.
- On `INSERT COIN`:
  - If `!isSubscribed && coins <= 0`, route to `/(app)/shop` instead.
  - Otherwise call `spendCoin()` only when `!isSubscribed`, then run the
    coin-drop → 3-2-1-GO countdown → start sequence. Copy this verbatim
    from Snake/Tetris.
- On game over: call `updateHighScore(score)` and `addRun({...})` on your
  store, then transition to the `'gameover'` overlay (PLAY AGAIN / MENU).
- Mobile controls go in a bottom overlay sized `CTRL_H = Platform.OS === 'web' ? 0 : <px>`.
- Sounds: import from `utils/sounds.ts` (`playCoinInsert`, `playCountdownBeep`,
  `playCountdownGo`, `playShipDestroyed`, etc.). Only `Platform.OS === 'web'`
  currently has audio wired — keep the guards.

### 3.4. Build the leaderboard

`components/PongLeaderboardScreen.tsx`:

```tsx
import React from 'react';
import { usePongStore, PongRun } from '../store/pongStore';
import GameLeaderboard, { StatColumn, timeColumn } from './game/GameLeaderboard';

const STATS: StatColumn<PongRun>[] = [
  { label: 'RALLIES', value: (r) => r.rallies },
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
```

Up to 3 stat columns render cleanly. `timeColumn()` is provided because
every game wants it.

### 3.5. Wire the route

`app/game/pong.tsx`:

```tsx
import React, { useState } from 'react';
import { usePongStore } from '../../store/pongStore';
import GameShell, { GameTab } from '../../components/game/GameShell';
import PongGame from '../../components/PongGame';
import PongLeaderboardScreen from '../../components/PongLeaderboardScreen';

type Tab = 'play' | 'leaderboard';

const TABS: GameTab<Tab>[] = [
  { id: 'play',        label: 'PLAY',   title: 'PONG',        iconActive: 'game-controller', iconInactive: 'game-controller-outline' },
  { id: 'leaderboard', label: 'SCORES', title: 'LEADERBOARD', iconActive: 'trophy',          iconInactive: 'trophy-outline' },
];

export default function PongPage() {
  const [tab, setTab] = useState<Tab>('play');
  const isGamePlaying = usePongStore((s) => s.isGamePlaying);

  return (
    <GameShell tab={tab} setTab={setTab} tabs={TABS} isGamePlaying={isGamePlaying}>
      {tab === 'play'        && <PongGame />}
      {tab === 'leaderboard' && <PongLeaderboardScreen />}
    </GameShell>
  );
}
```

That's the whole route file — it should never get bigger than this.

### 3.6. Adding extra tabs (optional)

If your game needs more than `play` + `leaderboard` (e.g. a shop, a codex,
a tutorial), append additional `GameTab` entries between them. See
`app/game/asteroids.tsx` for a 4-tab example.

## 4. Where things live

| Concern                     | File                                                |
|-----------------------------|-----------------------------------------------------|
| Game tile on home grid      | `constants/gameList.ts` + `assets/games/<id>.png`   |
| Route file                  | `app/game/<id>.tsx`                                 |
| Game component              | `components/<Name>Game.tsx`                         |
| Leaderboard component       | `components/<Name>LeaderboardScreen.tsx`            |
| Per-game store              | `store/<id>Store.ts`                                |
| Shared chrome (header+bar)  | `components/game/GameShell.tsx`                     |
| Shared leaderboard layout   | `components/game/GameLeaderboard.tsx`               |
| Shared store factory        | `store/createGameSessionStore.ts`                   |
| Coin balance + ∞ logic      | `store/coinStore.ts` · `store/subscriptionStore.ts` |
| Sound effects               | `utils/sounds.ts`                                   |
| Arcade coin icon            | `components/ArcadeCoin.tsx`                         |

## 5. Things you should NOT do

- **Don't** duplicate the header / coin counter / EXIT button in your game.
  `GameShell` already renders them and hides them during `isGamePlaying`.
- **Don't** show the coin balance manually anywhere outside `AppHeader` /
  `GameShell` — they already display `∞` when the pass is active.
- **Don't** pick custom colors for the bottom tab bar. The arcade gold
  (`#FFD700`) is part of the brand.
- **Don't** write a new AsyncStorage layer for high scores or runs — use
  `createGameSessionStore`.
- **Don't** charge a coin while `isSubscribed` is true. Always:
  ```ts
  if (!isSubscribed) spendCoin();
  ```
- **Don't** put the demo preview outside the game frame. Same size, same
  borders as real play.

## 6. Checklist

- [ ] Tile added to `constants/gameList.ts` (start `available: false`)
- [ ] Cover image at `assets/games/<id>.png`
- [ ] Store created with `createGameSessionStore<MyRun>('<id>')`
- [ ] Game component renders demo *inside the play frame*
- [ ] INSERT COIN respects `isSubscribed` and routes to shop on zero coins
- [ ] Game over calls `updateHighScore` and `addRun`
- [ ] Leaderboard uses `<GameLeaderboard>` with ≤3 stat columns + `timeColumn()`
- [ ] Route file `app/game/<id>.tsx` is ~20 lines, only wires `GameShell`
- [ ] No duplicated header / coin counter / EXIT button code
- [ ] Bottom tab bar uses default `GAME_ACCENT` (no per-game colors)
- [ ] Flip `available: true` once the game is playable end-to-end
