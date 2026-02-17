# Matchmaking Plugin — Research & Design Brief

## How This Document Was Built

Three parallel research streams were synthesized:
1. **Codebase exploration** — Deep dive into the existing ranking plugin, activity/session system, and plugin architecture
2. **Real-world matchmaking research** — How sports clubs, recreational groups, and apps actually do matchmaking
3. **Technical algorithms research** — Rating systems, team balancing math, tournament pairing, data models

---

## Part 1: How Matchmaking Works in the Real World

### The Problem Matchmaking Solves

Every recreational group faces the same chaos: N people show up, and someone (usually the organizer) has to figure out who plays with/against whom. This is currently done via:
- Captain picks (slow, socially awkward)
- Random assignment (produces lopsided games)
- Organizer gut feeling (doesn't scale, knowledge walks out the door)

Matchmaking replaces this with an algorithm that produces balanced, fair, varied matches — then lets the organizer adjust.

### Five Core Matchmaking Patterns

| Pattern | Problem | Example |
|---------|---------|---------|
| **Session Matchmaking** | N players, C courts -> assign to balanced games | 16 padel players, 4 courts -> 4 matches of 2v2 |
| **Team Balancing** | N players -> K balanced teams | 14 soccer players -> 2 teams of 7 |
| **Opponent Matching** | Pair individuals/doubles for competitive play | Ladder night: match Player A vs Player B |
| **Round-Robin / Americano** | Everyone plays everyone, rotating partners | Social padel night: 8 players, all rotate |
| **Tournament Brackets** | Seeded elimination or Swiss pairings | Club championship: 32 players, Swiss 5 rounds |

### How Real Clubs & Apps Handle This

**Racquet sports (padel, tennis):**
- Playtomic: Self-assessment (1-7 scale) + Elo-like dynamic adjustment from match results
- DUPR (for pkl-ball): Modified Elo analyzing last 30 singles / 60 doubles matches, universal 2.0-8.0 scale
- Swish app: One-click court assignment, automatic round-robin rotation, live scoring, organizer override

**Team sports (basketball, soccer, volleyball):**
- Snake draft by skill rating is the most common algorithmic approach
- Iterative swap optimization improves balance after initial draft

**The Americano format** (hugely popular in social padel):
- All players rotate partners every round
- Individual points accumulate — you score your own points even in pairs
- Pre-generated schedule (Americano) or dynamic based on standings (Mexicano)

### The Central Tension: Competitive Fairness vs Social Enjoyment

- **Pure competitive** (strict skill-based): Every game is close but exhausting, no variety, social connections limited to skill bracket
- **Pure social** (random): Great for community but lopsided games frustrate everyone
- **The sweet spot**: Use skill tiers (not exact ratings), rotate partners frequently, let organizers override

### The Organizer Override Pattern

This is THE critical feature that separates real-world from video-game matchmaking:

> **Always generate algorithmically first, then let the organizer adjust.**

Organizers have context the algorithm can't capture (injuries, player conflicts, someone who drove 45 minutes and deserves more court time). Every successful platform (Swish, Playtomic, CommunityPass) follows this pattern.

---

## Part 2: Rating Systems & Algorithms

### Rating System Comparison

| System | Uncertainty | Teams | Patent | Best For |
|--------|------------|-------|--------|----------|
| **Elo** | No | No | Free | Simple 1v1, quick to implement |
| **Glicko-2** | Yes (RD + volatility) | No | Free | 1v1 with infrequent play |
| **TrueSkill** | Yes (mu + sigma) | Yes | **Microsoft patent** | Teams, multi-player |
| **OpenSkill (Weng-Lin)** | Yes (mu + sigma) | Yes | **Free / open** | Teams, patent-free TrueSkill alternative |

**Recommendation: OpenSkill** (`openskill` on npm)
- Patent-free Weng-Lin Bayesian rating
- Natively supports teams and multi-player
- TypeScript-ready
- `predictDraw()` function serves as match quality metric
- Up to 20x faster than TrueSkill

### How Ratings Drive Match Creation

**Expected Win Probability (Elo formula):**
```
E_a = 1 / (1 + 10^((R_b - R_a) / 400))
```
A 200-point difference is approximately a 75% win probability for the higher-rated player.

**Expanding Search Windows:**
1. Start with tight skill range (plus/minus 50 rating points)
2. Widen progressively if no match found
3. For real-world sessions: first try identical level, then relax to "close enough"

### Team Balancing Algorithms

**Snake Draft** (recommended default):
1. Sort all N players by rating descending
2. For T teams, assign in serpentine: T1, T2, ..., TK, TK, ..., T2, T1
3. O(n log n) sort + O(n) assignment. Simple, fair enough for casual play.

**Greedy Balanced Partition** (for 2 teams):
- Sort descending, always assign next player to the team with the lower total rating

**Swap Optimization** (refinement step):
- After initial assignment, try swapping players between strongest/weakest teams
- Keep swaps that reduce max deviation from average team rating
- Good for "better balance" mode

**Brute Force** (small groups):
- For 20 or fewer players, exhaustive search of all partitions is feasible
- Guarantees optimal balance

### Tournament Pairing Algorithms

**Swiss System:**
- Group by current score, pair top-half vs bottom-half within each group
- Never repeat opponents
- 7 rounds can rank 128 players (vs 127 games for full round-robin)

**Round-Robin (Circle Method):**
- Fix player #1, rotate all others clockwise each round
- For n players: n-1 rounds, every pair plays exactly once

**Single Elimination Seeding:**
- Standard pattern: #1 vs #16, #8 vs #9, etc. — ensures top seeds meet only in later rounds

### Handling Uneven Numbers

1. **Bye with rotation** — lowest-ranked unmatched player sits out, rotates each round
2. **Phantom player** — odd player gets average of their recent scores
3. **Asymmetric play** — 2v1 "cutthroat" in some sports, king-of-the-court in volleyball
4. **Waitlist/sub** — extra player waits for next round or subs in

---

## Part 3: How This Fits Into Gatherly

### What Already Exists (from codebase exploration)

**Plugin System:**
- Plugins are `org`-scoped or `activity`-scoped
- Activity-scoped plugins toggled via `activity.enabledPlugins` JSONB field
- Ranking plugin cannot be disabled once enabled (prevents data loss)
- Plugin registry pattern: `catalog.ts` -> `registry.ts` -> tRPC router composition

**Ranking Plugin (already built):**
- Per-activity ranking definitions with domain-specific logic
- `member_rank` table: cumulative stats per user per ranking (JSONB `stats`)
- `match_record` table: structured match data with derived stats
- `ranking_level` table: admin-assigned skill levels (Beginner to Pro)
- Domain abstraction: padel (set-based), laser-tag (point-based), 20+ sport domains
- Match recording: team selection -> score entry -> domain-specific validation -> stats accumulation
- Leaderboard with level-based sorting

**Session System:**
- Sessions have `maxCapacity`, `joinMode`, `status` state machine
- Participation: join/waitlist/cancel with pessimistic locking + auto-promote
- Match-mode ranking locks capacity to valid format (padel doubles = 4 players)

**Activity System:**
- Activities belong to organizations
- Activity membership: join modes (open, require_approval, invite)
- Each activity can independently enable plugins

### Where Matchmaking Fits

Matchmaking is a **natural peer to the ranking plugin**, not a sub-feature of it:

```
Organization
  +-- Activity
       +-- Ranking Plugin      <-- tracks skill ratings + match results
       +-- Matchmaking Plugin  <-- uses ratings to CREATE balanced matches
       +-- Sessions            <-- where matches actually happen
```

**Key integration points:**
1. **Rating data source**: Matchmaking reads from `member_rank.stats` and `ranking_level` to determine player skill
2. **Session binding**: Matchmaking generates matches for a specific session's attendees
3. **Result feedback loop**: Match results flow back into ranking via existing `match_record` system
4. **Domain awareness**: Matchmaking understands format rules (doubles = 2v2, team = flexible) from ranking domains

### Scoping Decision: Activity-Level Plugin

Matchmaking should be an **activity-scoped plugin**, same as ranking:
- Different activities need different matchmaking (padel = court assignment, soccer = team split)
- Configuration is per-activity (algorithm choice, constraints, weights)
- Requires ranking to be enabled first (needs ratings data)
- Can exist independently for simple random/manual matching

---

## Part 4: Proposed Architecture

### Data Model

```
matchmaking_config               -- Per-activity matchmaking settings
  id
  organization_id                -- FK to organization
  activity_id                    -- FK to activity (unique: one config per activity)
  ranking_definition_id          -- FK to ranking_definition (nullable)
  default_mode                   -- "court_assignment" | "team_split" | "round_robin" | "swiss" | "bracket"
  default_algorithm              -- "snake_draft" | "greedy" | "optimized" | "random" | "manual"
  config                         -- JSONB: { ratingWeight, varietyWeight, maxRatingDiff, avoidRepeatN }
  created_at, updated_at

matchmaking_session              -- One matchmaking run per session
  id
  organization_id
  matchmaking_config_id          -- FK to matchmaking_config
  session_id                     -- FK to event_session (nullable for standalone)
  status                         -- "collecting" | "generated" | "confirmed" | "completed"
  mode                           -- override mode for this specific run
  algorithm                      -- override algorithm for this specific run
  metadata                       -- JSONB: { roundCount, courtCount, notes }
  generated_by                   -- user who triggered generation
  confirmed_by                   -- user who confirmed proposals
  created_at

matchmaking_entry                -- Player in the matchmaking pool
  id
  matchmaking_session_id         -- FK to matchmaking_session
  user_id                        -- FK to user
  rating_snapshot                -- numeric: player's rating at pool entry time
  rating_deviation_snapshot      -- numeric: uncertainty (if using OpenSkill)
  preferences                   -- JSONB: { preferredPartners: [], avoidPlayers: [] }
  status                         -- "available" | "matched" | "bye"
  joined_at

matchmaking_proposal             -- Generated match/team suggestions
  id
  matchmaking_session_id         -- FK to matchmaking_session
  round_number                   -- For multi-round formats (1 for single round)
  court_number                   -- Optional: physical court/table assignment
  team1                          -- JSONB: string[] of user IDs
  team2                          -- JSONB: string[] of user IDs
  match_quality_score            -- 0-1 computed quality metric
  status                         -- "proposed" | "accepted" | "modified" | "rejected"
  modified_team1                 -- JSONB: admin-adjusted team1 (null if unmodified)
  modified_team2                 -- JSONB: admin-adjusted team2 (null if unmodified)
  created_at

matchmaking_history              -- Who played with/against whom (for variety tracking)
  id
  organization_id
  activity_id
  user_id
  opponent_id                    -- The other user
  relationship                   -- "teammate" | "opponent"
  session_id                     -- FK to event_session
  matchmaking_session_id         -- FK to matchmaking_session
  played_at
```

### Core Flow

```
1. SETUP:     Admin enables matchmaking plugin on an activity
              System reads ranking config to understand format rules

2. SESSION:   Admin creates a session (or uses existing one)
              Members RSVP / join the session

3. POOL:      Admin opens "Generate Matchups" for the session
              System snapshots current ratings from member_rank
              Creates matchmaking_session + matchmaking_entries

4. GENERATE:  System runs selected algorithm
              Produces matchmaking_proposals with quality scores
              Considers: ratings, variety (avoid recent pairings), preferences

5. REVIEW:    Admin sees proposed matches with quality indicators
              Can drag-drop to adjust teams/pairings
              Can regenerate with different settings
              Modified proposals tracked as "modified"

6. CONFIRM:   Admin confirms matchups
              Proposals marked "accepted" / "modified"
              Optionally: system pre-creates match_records in "pending" state

7. PLAY:      Matches are played

8. RECORD:    Admin records results via existing match recording dialog
              Results flow into ranking system (match_record -> member_rank)
              Matchmaking history updated for future variety

9. LOOP:      Updated ratings improve next session's matchmaking
```

### Integration with Existing Systems

**With Ranking Plugin:**
- Matchmaking reads `member_rank.stats` and `ranking_level.currentLevelId`
- If OpenSkill rating is added: store `mu` and `sigma` in `member_rank` (extend JSONB stats or add columns)
- Match results recorded via existing `recordMatch` flow — no duplication
- If no ranking enabled: matchmaking falls back to manual ratings or random

**With Session System:**
- Matchmaking pool populated from session participants (status = "joined")
- Court count derived from `maxCapacity / players_per_match`
- Session capacity validation already exists for match-mode rankings

**With Activity System:**
- New plugin entry in `catalog.ts`: `{ id: "matchmaking", scope: "activity" }`
- Requires ranking plugin to be enabled (soft dependency, not hard)
- Config stored in matchmaking_config table, not in activity.enabledPlugins

### Algorithm Selection Guide

| Scenario | Best Algorithm | Why |
|----------|---------------|-----|
| 8 players, 2 padel courts | Snake draft + court assignment | Fast, fair, simple |
| 14 players, pickup soccer | Greedy partition (2 teams) | Optimal for 2-team split |
| 16 players, social padel night | Round-robin / Americano | Everyone plays everyone |
| 32 players, club championship | Swiss system, 5 rounds | Efficient ranking without full round-robin |
| 8 players, competitive ladder | Rating-window opponent matching | Closest skill pairing |

### What NOT to Build (MVP scope)

- **Real-time queue matching** — Gatherly is session-based, not lobby-based
- **Automated scheduling** — Matchmaking generates pairings for a specific session, doesn't create sessions
- **Complex Elo/Glicko** — Use existing `member_rank` levels + stats for V1, defer OpenSkill integration
- **Tournament bracket management** — Separate "Tournament" plugin in the future
- **Async matchmaking** — All computation is synchronous in the request handler (N < 100 players)

---

## Part 5: Phased Rollout Suggestion

### Phase 1: Session Court/Match Assignment (MVP)
- **Input**: Session attendees + their ranking levels/stats
- **Output**: Balanced match proposals (who plays on which court)
- **Algorithm**: Snake draft for team formation, greedy for court assignment
- **UI**: "Generate Matchups" button on session page -> proposal list -> confirm/adjust
- **Tables**: `matchmaking_config`, `matchmaking_session`, `matchmaking_entry`, `matchmaking_proposal`

### Phase 2: Variety & History
- Track `matchmaking_history` (who played with/against whom)
- Add variety weight to avoid repeat pairings
- Show "last played together" info in the proposal UI

### Phase 3: Round-Robin / Americano
- Multi-round generation with partner rotation
- Live scoring integration
- Cumulative individual leaderboard per event

### Phase 4: OpenSkill Rating Integration
- Add `openskill` npm package
- Compute mu/sigma from match history
- Use `predictDraw()` for match quality scoring
- Optional: auto-promote ranking levels based on rating thresholds

### Phase 5: Tournament Formats
- Swiss-system pairing
- Elimination bracket seeding
- Could become a separate "Tournament" plugin that depends on both Ranking and Matchmaking

---

## Part 6: Open Questions

Before implementation, these need answers:

1. **Should matchmaking be a separate plugin or an extension of ranking?**
   - Pro separate: Cleaner boundaries, can exist without ranking (for simple random matching)
   - Pro extension: Fewer plugin entries, shared data model, simpler UX
   - **Recommendation**: Separate plugin that depends on ranking when available

2. **Per-session or per-activity matchmaking generation?**
   - Per-session: Each session gets its own matchmaking run. More granular.
   - Per-activity: Matchmaking settings apply to all sessions. Simpler config.
   - **Recommendation**: Config is per-activity, generation is per-session

3. **Manual ratings for activities without ranking?**
   - If ranking isn't enabled, should matchmaking allow manual skill entries (1-10 slider)?
   - This would make matchmaking useful even without the full ranking system
   - **Recommendation**: Yes, support a "manual rating" fallback

4. **Court/table assignment or just team generation?**
   - Some organizers have multiple courts and want "Court 1: Alice vs Bob, Court 2: Carol vs Dave"
   - Others just want "Team A vs Team B"
   - **Recommendation**: Support both — court assignment is just an ordering of proposals

5. **Rating system for V1: existing levels + stats or new OpenSkill?**
   - Existing: `ranking_level.order` + `member_rank.stats.wins` — already there, zero effort
   - OpenSkill: Better math, but requires new dependency + migration
   - **Recommendation**: V1 uses existing data, V2 adds OpenSkill

---

## References

### Products
- [DUPR](https://www.dupr.com/) — Universal pkl-ball rating
- [Playtomic](https://playtomic.com/) — Padel/tennis matchmaking
- [Swish Sports](https://swishsportsapp.com/) — Court assignment + round-robin
- [SquashLevels](https://squashlevels.com/) / [PadelLevels](https://padellevels.io/) — WSF-backed rating
- [Rankedin](https://www.rankedin.com/) — Racquet sports rankings

### Algorithms & Research
- [Elo Rating System (Wikipedia)](https://en.wikipedia.org/wiki/Elo_rating_system)
- [Glicko-2 Paper (Glickman)](https://glicko.net/glicko/glicko2.pdf)
- [TrueSkill (Microsoft Research)](https://www.microsoft.com/en-us/research/project/trueskill-ranking-system/)
- [OpenSkill (npm)](https://www.npmjs.com/package/openskill)
- [Automatic Matchmaking in 2v2 Sports (EDM 2024)](https://educationaldatamining.org/edm2024/proceedings/2024.EDM-short-papers.45/index.html)
- [Balanced Pickup Soccer Teams](https://lukmoda.medium.com/an-algorithm-to-generate-balanced-pickup-soccer-teams-26141556f854)
- [Swiss-system tournament (Wikipedia)](https://en.wikipedia.org/wiki/Swiss-system_tournament)
- [EOMM: Engagement Optimized Matchmaking (arxiv)](https://arxiv.org/pdf/1702.06820)
