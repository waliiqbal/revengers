# Match results, trophies, XP and coins: design

Status: **approved and implemented, not deployed.** Backend: `src/game/` (`rewards.ts` holds all the numbers). Unity: `MatchReporter.cs`, `NetworkPlayerComponent.cs`, `FusionGameManager.cs`. Decision on the open question below: **levels never drop.**

## Decisions already made

| Topic | Decision |
|---|---|
| Who reports the result | **Each player's game** reports. The server cross-checks the reports (below). |
| Host quits mid-match | Match is cancelled. **The host gets a loss** once at least 2 other players' games report the disconnect (1 if only one other player). |
| What decides level | **Trophies** (game design document): win +30, draw +10, loss −15, never below 0. **Level = 1 + trophies ÷ 75** (rounded down). |
| XP | Still earned and shown (needed later for the Double XP pass): win 100, draw 60, loss 40, +10 per kill, +5 per assist, max 300 per match. |
| Coins | Win 50, draw 30, loss 20. **MVP** +25, 2nd +15, 3rd +10. |
| Leavers | A player who leaves early gets a loss (−15 trophies, +1 match, +1 loss) and no XP or coins. |
| Kills / deaths / assists | Counted by the host during the match. An assist is any other enemy who hit the victim in the 10 seconds before the death. |

MVP score = kills × 2 + assists (fewest deaths breaks ties, then the winning team). Base captures are only counted per team today, so they aren't part of MVP yet.

## Match flow

```
 every player's game                         backend
 ───────────────────                         ───────
 local player spawned ── POST /Game/startGame {matchKey, team, isHost} ──▶ create or join the match
                                                                            (matchKey = Nakama match id, the same on all devices)
 ...match plays, host counts kills/deaths/assists (synced to everyone)...

 match ends ── POST /Game/GameWon {matchKey, winnerTeam, teamScores,  ──▶ store this player's report
                durationSeconds, scoreboard[all players]}                  when 2 reports agree → apply rewards to ALL players once
            ◀── { status: "completed" | "pending", myRewards }             (or after 2 min: use the report most players agree on)
 show "+30 🏆 +120 XP +50 coins" on the result screen, then GET users/getProfile

 host disconnected before the end ── POST /Game/hostLeft {matchKey} ──▶ 2 reports → match abandoned, host gets a loss
```

### Why "2 matching reports"
Every game sees the same synced scoreboard, so honest reports are identical. Waiting for two that match means one modified game can't hand out fake wins or kills. If only one player is left in the match, one report is enough. If reports never agree, after 2 minutes the server uses the version most players sent (ties go to the earliest).

### Protection rules (server side)
- All three endpoints need a login (JWT). Banned or removed players are already rejected.
- Only players who joined the match (`startGame`) can report for it. The scoreboard can only contain those players.
- **Each match pays out exactly once.** Repeated or late calls get the stored result back and nothing more.
- No rewards for matches shorter than 60 seconds. Matches never finished within 30 minutes are abandoned with no rewards.
- Numbers are clamped (e.g. at most 60 kills per player) and team scores must fit the 300-point / 5-minute rules.
- At most 8 players per match, 2 teams.

## Backend changes (`D:\Fazal\revengers`)
- `Game` schema: `matchKey` (unique), `status` (active / completed / abandoned), `hostUser`, `players[{user, team, isHost}]`, `reports[]`, `hostLeftReports[]`, `result{winnerTeam, teamScores, durationSeconds, scoreboard[{user, team, kills, deaths, assists, outcome, mvpRank, rewards}]}`, timestamps. Indexes on `matchKey`, `players.user`, `status`.
- `User` schema: new `trophies` field (default 0). Rewards use `$inc` (totalMatch, won/lost, kills, death, assists, totalXp, currentXp, coin, trophies), then the level is recalculated from trophies.
- Rewards are calculated in one place (`rewards.ts`), so Double XP / Double Coins can be added later.
- A small timer in the backend finalises "pending" matches after 2 minutes and abandons stale ones after 30 minutes.
- Admin dashboard: trophies in the player detail, plus a "Trophies" leaderboard option.
- `users/update-user` and the Coin / Gems / Diamonds shop stay **unchanged**.
- Tested with an in-memory database simulating 8 players: honest reports, a cheating report, a duplicate report, a leaver, and a host quitting.

## Unity changes (`D:\Fazal\tokyorevengersGame`)
- `FusionGameManager.TokenData`: add the player's backend user id (`Global.userData._id`). The host puts it on each player as a synced `UserId`.
- `NetworkPlayerComponent`: synced `Kills`, `Deaths`, `Assists`. In `OnLocalDamageReceived` / `ApplyNetworkedDamage` (host only) remember who hit whom and when; on death count the kill, the death and the assists (teammates don't count).
- New `MatchReporter` component:
  - when the local player spawns → `startGame`
  - on `ApplyMatchEnd` → build the scoreboard from all players → `GameWon` → show rewards → refresh the profile
  - on `OnShutdown` / `OnDisconnectedFromServer` before the match ends (and not the host) → `hostLeft`
- `APIRouteName`: add `Game/hostLeft`.
- `UserData`: add `trophies`. The Profile screen can show it.
- Needs a test with at least 2 devices (or ParrelSync clones). I can't run Unity multiplayer here.

## Open question
- **Can a player's level go down** when they lose trophies? The document ties level to trophies, which suggests yes. The alternative is that levels are kept once reached. (One existing player is above level 1 with 0 trophies; with "keep levels" their level is safe.)

## Not in this change
Ranked vs unranked modes, the Double XP / Double Coins pass, per-player captures, ascension stars, fixing the free coin bundles, and the coin/gem/diamond exchange rates. The shop panels use different rates than the document: the document says 100 coins → 10 diamonds and 2 diamonds → 1 gem.
