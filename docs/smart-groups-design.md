# Smart Groups — Research & Architecture Design

## What This Document Covers

This is the comprehensive design for the **Smart Groups** feature — a general-purpose, form-driven grouping engine that takes people + their data and produces intelligent group assignments.

**Research streams synthesized:**
1. Codebase exploration — existing form system, ranking plugin, AI plugin, session/activity architecture
2. Real-world matchmaking — sports clubs, recreational groups, social platforms
3. Grouping/clustering algorithms — Gower distance, similarity metrics, team balancing
4. AI enhancement — embeddings, LLM-assisted labeling, natural language rules

**Supersedes:** `docs/matchmaking-plugin-research.md` (which focused narrowly on sports matchmaking)

---

## Part 1: The Vision

### What Smart Groups Solves

Every community organizer faces the same problem: you have N people and need to split them into meaningful groups. Today this is done by gut feeling, manual spreadsheets, or not at all.

Smart Groups replaces this with a **data-driven grouping engine** that:
1. **Collects** structured data about people via the existing form system
2. **Groups** them using configurable algorithms (split by attribute, cluster by similarity, balance by skill)
3. **Enhances** results with AI when available (semantic text understanding, creative group names)
4. **Lets organizers review and adjust** before confirming

### Use Cases (Not Just Sports)

| Use Case | Form Data | Grouping Logic | Output |
|----------|-----------|----------------|--------|
| Gender-split tournament | Gender field | Split by gender | Girls group + Boys group |
| Skill-balanced teams | Skill rating (form or ranking) | Balance across teams | Balanced teams for a session |
| Interest communities | Interest multi-select | Cluster by similarity | Sub-groups of like-minded people |
| Court assignment | Skill + preferences | Balance + variety | Who plays on which court |
| Mentorship pairing | Experience level + goals | Pair diverse (senior + junior) | Mentor-mentee pairs |
| Workshop breakouts | Topic preference + department | Split by topic, diversify department | Cross-functional topic groups |
| Onboarding cohorts | Start date + role + location | Cluster similar | Peer cohorts for new members |

### The Central Design Principle

> **Algorithm first, AI enhances, organizer decides.**

The system works in three layers:
1. **Core algorithm** — Deterministic, fast, works offline. Always produces valid groups.
2. **AI enhancement** — Optional. Improves text understanding, generates group names, interprets natural language rules.
3. **Organizer override** — Always the final say. Can adjust, regenerate, or manually reassign.

---

## Part 2: Data Sources

### Existing Form System (Already Built)

Forms exist at **3 levels**, each storing answers as JSONB:

| Level | Schema Column | Answers Column | When Collected |
|-------|--------------|----------------|----------------|
| **Organization** | `organizationSettings.joinFormSchema` | `joinRequest.formAnswers` / `groupMemberProfile.answers` | When joining the org |
| **Activity** | `activity.joinFormSchema` | `activityJoinRequest.formAnswers` | When joining the activity |
| **Session** | `eventSession.joinFormSchema` | `participation.formAnswers` | When joining the session |

**9 field types supported:** text, textarea, email, phone, number, select, multiselect, checkbox, date

**Answer shape** (flat JSONB):
```typescript
{
  "field_1739123456_abc12": "John Doe",           // text
  "field_1739123457_def34": 25,                   // number
  "field_1739123458_ghi56": "Option A",           // select
  "field_1739123459_jkl78": ["Tag1", "Tag2"],     // multiselect
  "field_1739123460_mno90": true,                 // checkbox
  "field_1739123461_pqr11": "2026-02-16"          // date
}
```

### Ranking Plugin Data (Already Built)

When the ranking plugin is enabled on an activity:
- `member_rank.stats` — Cumulative JSONB stats (wins, losses, sets, etc.)
- `ranking_level` — Admin-assigned skill levels (Beginner to Pro)
- `match_record` — Historical match results

Smart Groups can use ranking data as an additional signal alongside form answers.

### Data Priority

```
Primary:   Form answers (always available when forms are configured)
Secondary: Ranking data (available when ranking plugin is enabled)
Tertiary:  Profile data (name, join date — always available)
```

---

## Part 3: Grouping Modes

### Mode 1: Attribute Split (Deterministic)

Partition people by discrete attribute values. Simplest mode.

**Algorithm:** O(n) — iterate people, bucket by attribute value.

```
Input:  [Alice(F), Bob(M), Carol(F), Dave(M), Eve(F)]
Split by gender:
  -> "Female": [Alice, Carol, Eve]
  -> "Male":   [Bob, Dave]
```

**Multi-attribute split** creates cross-products:
```
Split by gender x skill_level:
  -> "Female + Beginner": [Alice, Eve]
  -> "Female + Advanced": [Carol]
  -> "Male + Beginner":   [Bob]
  -> "Male + Advanced":   [Dave]
```

**Best for:** Gender separation, skill-tier grouping, department splitting.

**Limitation:** Cross-products with 3+ attributes create many small/empty groups. Limit to 1-2 split attributes.

### Mode 2: Similarity Clustering

Group people with similar answers together. Uses Gower distance + greedy assignment.

**Gower Distance** handles mixed data types by normalizing each field to [0, 1]:

| Field Type | Distance Formula |
|-----------|-----------------|
| Number | `abs(a - b) / range` |
| Select (single) | `0 if same, 1 if different` |
| Multiselect | Jaccard distance: `1 - (intersection / union)` |
| Checkbox | `0 if same, 1 if different` |
| Text (without AI) | `0 if same, 1 if different` (exact match) |
| Text (with AI) | `1 - cosine_similarity(embedding_a, embedding_b)` |
| Date | `abs(days_between) / range_days` |

**Final distance** = weighted average of per-field distances.

**Algorithm:**
1. Compute NxN Gower distance matrix (200 people = 40,000 calculations — trivial)
2. Pick K seeds (most mutually distant people)
3. Greedy-assign: each unassigned person to group with lowest average distance
4. Respect min/max group size constraints
5. If balance criteria exist, run swap-based post-processing

**Best for:** Interest-based communities, like-minded cohorts, compatible pairs.

### Mode 3: Diversity Mixing

Ensure each group has a diverse mix. Same Gower distance, inverted objective.

**Algorithm:** Same as similarity but assign each person to the group where they are most DIFFERENT from existing members (maximize intra-group distance).

**Best for:** Cross-functional workshop breakouts, diverse learning groups, mixed-skill practice sessions.

### Mode 4: Balanced Teams (Sports)

Create N teams with roughly equal aggregate skill. Primarily for sports/competitive use.

**Snake Draft Algorithm:**
1. Sort all players by rating descending
2. For T teams, assign in serpentine: T1, T2, ..., TT, TT, ..., T2, T1

**Greedy Balanced Partition** (for 2 teams):
- Sort descending, assign next player to team with lower total rating

**Swap Optimization** (refinement):
- After initial assignment, try swapping between teams to reduce imbalance

**Best for:** Pickup games, session court assignment, league team formation.

### Mode 5: Composed Pipeline

The real power — combine modes:

```
Admin configures:
  1. SPLIT by "Track" (beginner / intermediate / advanced)
  2. Within each split, CLUSTER similar by "Interests"
  3. BALANCE by "Gender" within each cluster
```

This creates a pipeline:
1. **Split phase:** Partition by track -> 3 buckets
2. **Cluster phase:** Within each bucket, form groups by interest similarity
3. **Balance phase:** Swap members to equalize gender without destroying interest similarity

---

## Part 4: AI Enhancement Layer

### Design Principle: AI is a Decorator

```
+---------------------------------------------------+
|              Smart Groups Pipeline                  |
|                                                     |
|  +--------------+    +--------------+              |
|  | AI: Parse    |    | AI: Embed    |  OPTIONAL    |
|  | NL rules ->  |    | text fields  |  ENHANCE     |
|  | config       |    | -> vectors   |  LAYER       |
|  +------+-------+    +------+-------+              |
|         |                    |                       |
|         v                    v                       |
|  +-------------------------------------+           |
|  |  CORE: Gower Distance + Grouping    |  ALWAYS   |
|  |  Algorithms (works without AI)      |  WORKS    |
|  +-----------------+-------------------+           |
|                     |                                |
|                     v                                |
|  +--------------------------+                      |
|  | AI: Label groups with    |  OPTIONAL            |
|  | creative names/desc      |  ENHANCE             |
|  +--------------------------+                      |
+---------------------------------------------------+
```

### Enhancement 1: Text Embeddings for Similarity

**Problem:** Without AI, text fields use exact-match comparison (same = 0, different = 1). This misses semantic similarity — "I love hiking in the mountains" and "Outdoor trail running is my passion" would be treated as completely different.

**Solution:** When AI is available, generate vector embeddings for text answers and use cosine similarity instead.

**Recommended model:** `nomic-embed-text` via Ollama
- 768 dimensions, 8192 token context
- Outperforms OpenAI ada-002 on short-text benchmarks
- Runs locally, zero cost

**Integration point:**
```
For each text field in Gower distance:
  if AI available:
    embed all answers -> vectors
    distance = 1 - cosine_similarity(vec_a, vec_b)
  else:
    distance = exact_match (0 or 1)
```

**Latency:** ~2-15s for 200 people x 5 text fields (local Ollama).

### Enhancement 2: AI Group Labeling

**Problem:** Without AI, groups are "Group 1", "Group 2", etc.

**Solution:** After algorithm produces groups, send each group's collective answers to an LLM for naming.

**Prompt pattern:**
```
Group members answered these questions:
- "What are your hobbies?": ["hiking", "rock climbing", "trail running"]
- "Experience level": ["intermediate", "advanced", "intermediate"]

Generate a creative 2-4 word group name and one-sentence description.
Respond in JSON: { "name": "...", "description": "..." }
```

**Model:** Use existing Mistral 7B via Ollama (already deployed). Or `llama3.2:3b` for faster structured output.

**Fallback:** Without AI -> "Group 1", "Group 2", etc. Admin can manually name groups.

### Enhancement 3: Natural Language Grouping Rules

**Problem:** Admins have to manually configure field weights and strategies.

**Solution:** Admin types "group people with similar hobbies but mix experience levels" -> LLM translates to algorithm parameters.

**How it works:**
```
Input (admin types):
  "Group people with similar hobbies but mix experience levels"

LLM translates to:
  {
    criteria: [
      { fieldId: "hobbies", strategy: "similar", weight: 0.8 },
      { fieldId: "experience", strategy: "diverse", weight: 0.6 }
    ]
  }
```

**Fallback:** Without AI -> admin uses the manual configuration UI (field picker + strategy + weight sliders).

### Integration with Existing AI Plugin

The existing AI plugin (`src/plugins/ai/`) provides:
- Ollama HTTP client with streaming + non-streaming
- Health check (`checkOllamaHealth()`)
- Org-scoped access control
- Prompt builder pattern (role, task, examples, rules)
- React hooks with streaming, caching, error handling

Smart Groups will use the same Ollama client and follow the same patterns. The AI enhancement for Smart Groups will be an extension of the existing AI plugin, not a separate AI integration.

### AIProvider Abstraction

```typescript
type SmartGroupsAIProvider = {
  embedTexts(texts: string[]): Promise<number[][] | null>
  labelGroup(groupAnswers: Record<string, unknown>[], schema: FormField[]): Promise<{ name: string, description: string } | null>
  parseGroupingRules(naturalLanguage: string, fields: FormField[]): Promise<GroupingCriteria[] | null>
}

// NoopProvider — used when AI is disabled or unavailable
const noopProvider: SmartGroupsAIProvider = {
  embedTexts: async () => null,
  labelGroup: async () => null,
  parseGroupingRules: async () => null,
}
```

Every function returns `null` when AI is unavailable. Calling code has clean fallback paths.

### Embedding Model Setup

Add `nomic-embed-text` alongside existing `mistral:7b`:
```bash
ollama pull nomic-embed-text
```

Use Ollama's `/api/embed` endpoint (different from `/api/generate` used by existing AI features).

---

## Part 5: Relationship with Tournament Plugin

### How Smart Groups and Tournament Relate

```
Smart Groups Engine (core algorithms)
        |
        +-- Used by: Session-level grouping (direct)
        |     "Generate balanced teams for tonight's session"
        |
        +-- Used by: Activity-level grouping (direct)
        |     "Split members into interest-based sub-groups"
        |
        +-- Used by: Tournament Plugin (future, indirect)
              "For each round, generate pairings using Smart Groups"
```

**Smart Groups** = the engine that knows HOW to group people
**Tournament Plugin** = orchestrates multi-round structure (brackets, Swiss, round-robin) and calls Smart Groups for each round's pairings

### What This Means Architecturally

Smart Groups should be built as two layers:

1. **Core Engine** (pure functions, no DB, no UI):
   - `splitByAttribute(people, field) -> groups`
   - `clusterBySimilarity(people, fields, weights, groupCount) -> groups`
   - `balanceTeams(people, ratingField, teamCount) -> teams`
   - `computeGowerDistance(personA, personB, fields) -> number`
   - Can be imported by any plugin or feature

2. **Plugin Shell** (DB, UI, tRPC):
   - Config storage, proposal persistence, admin UI
   - Calls the core engine functions
   - Handles the "generate -> review -> confirm" flow

The future Tournament Plugin would import the core engine directly, without going through the plugin shell.

### Sports Matchmaking as a Smart Groups Mode

The original matchmaking research (court assignment, team balancing, opponent matching) maps directly to Smart Groups modes:

| Original Matchmaking Concept | Smart Groups Equivalent |
|------------------------------|------------------------|
| Court assignment | Balanced Teams mode with court numbering |
| Team balancing | Balanced Teams mode |
| Opponent matching | Similarity/Diversity mode with pair-size groups |
| Round-robin / Americano | Multi-round generation (Tournament Plugin territory) |
| Swiss pairing | Tournament Plugin (calls Smart Groups per round) |

---

## Part 6: Proposed Data Model

```sql
-- Per-activity Smart Groups configuration
smart_group_config
  id                      -- PK
  organization_id         -- FK to organization
  activity_id             -- FK to activity (unique: one config per activity)
  name                    -- Display name (e.g., "Skill-Based Court Assignment")
  data_sources            -- JSONB: which form levels to read + ranking data
  default_criteria         -- JSONB: GroupingCriteria[] (field mappings, strategies, weights)
  default_group_settings   -- JSONB: { mode, groupCount, targetSize, minSize, maxSize }
  ai_enhanced             -- boolean: whether to use AI enhancements
  created_at, updated_at

-- One grouping run (per session, or standalone)
smart_group_run
  id                      -- PK
  organization_id         -- FK
  smart_group_config_id   -- FK to smart_group_config
  session_id              -- FK to event_session (nullable for standalone runs)
  status                  -- "collecting" | "generated" | "confirmed" | "completed"
  criteria_override       -- JSONB: criteria used for this specific run (overrides config defaults)
  group_settings_override -- JSONB: group size/count overrides for this run
  ai_used                 -- boolean: whether AI was actually used in this run
  generated_by            -- user who triggered generation
  confirmed_by            -- user who confirmed
  metadata                -- JSONB: { generationTimeMs, algorithmUsed, aiModel }
  created_at

-- Person in the grouping pool with their data snapshot
smart_group_entry
  id                      -- PK
  smart_group_run_id      -- FK
  user_id                 -- FK to user
  data_snapshot           -- JSONB: merged form answers + ranking data at pool entry time
  status                  -- "available" | "grouped" | "excluded"
  joined_at

-- Generated group proposals
smart_group_proposal
  id                      -- PK
  smart_group_run_id      -- FK
  group_index             -- integer: 0, 1, 2... ordering
  group_name              -- string: "Group 1" or AI-generated name
  group_description       -- string: AI-generated or null
  member_ids              -- JSONB: string[] of user IDs
  quality_score           -- numeric: 0-1 computed quality metric
  status                  -- "proposed" | "accepted" | "modified" | "rejected"
  modified_member_ids     -- JSONB: admin-adjusted members (null if unmodified)
  created_at

-- History: who was grouped with whom (for variety tracking)
smart_group_history
  id                      -- PK
  organization_id         -- FK
  activity_id             -- FK
  user_id                 -- FK
  grouped_with_user_id    -- FK
  session_id              -- FK to event_session (nullable)
  smart_group_run_id      -- FK
  grouped_at
```

### Key Differences from Original Matchmaking Model

| Original | Smart Groups | Why |
|----------|-------------|-----|
| `matchmaking_config` | `smart_group_config` | Broader scope: not just matchmaking |
| `matchmaking_proposal.team1/team2` | `smart_group_proposal.member_ids` | Groups are not always 2 teams — could be 1 group of 8 |
| Hard-coded `algorithm` field | `criteria` JSONB with field-level strategies | More flexible: each field gets its own strategy |
| `rating_snapshot` on entries | `data_snapshot` JSONB | Captures all form data, not just a rating |
| `matchmaking_history.relationship` | `smart_group_history` (who grouped with whom) | Simpler — relationship type depends on context |

---

## Part 7: Core Flow

```
1. SETUP:     Admin enables Smart Groups plugin on an activity
              Admin configures: which form fields to use, strategies, weights
              Optional: link to ranking data for skill-based grouping

2. DATA:      Members join the activity/session and fill forms
              Form answers stored in existing JSONB columns

3. TRIGGER:   Admin opens "Generate Groups" for a session (or standalone)
              System snapshots form answers + ranking data from all participants
              Creates smart_group_run + smart_group_entries

4. GENERATE:  System runs the configured pipeline:
              a. If AI available and enabled: embed text fields, parse NL rules
              b. Run core algorithm (split / cluster / balance pipeline)
              c. Compute quality scores for each group
              d. If AI available: generate group names/descriptions

5. REVIEW:    Admin sees proposed groups with quality indicators
              Groups show: member names, shared traits, quality score
              Admin can drag-drop members between groups
              Admin can regenerate with different settings
              Modified proposals tracked

6. CONFIRM:   Admin confirms groups
              Groups marked "accepted" / "modified"
              History entries created for variety tracking

7. USE:       Groups are used for:
              - Session court/team assignment
              - Activity sub-groups
              - Tournament seeding (future)
              - Social pairing
```

---

## Part 8: Algorithm Implementation Details

### Gower Distance (Core)

~50-80 lines of TypeScript. No external dependencies.

```typescript
function gowerDistance(
  personA: Record<string, unknown>,
  personB: Record<string, unknown>,
  fields: FieldConfig[],
  embeddings?: Map<string, number[]>  // AI-provided, optional
): number {
  let totalWeight = 0
  let totalDistance = 0

  for (const field of fields) {
    const a = personA[field.id]
    const b = personB[field.id]

    // Skip if either value is missing (Gower handles missing data naturally)
    if (a == null || b == null) continue

    const weight = field.weight ?? 1.0
    let distance: number

    switch (field.type) {
      case "number":
        distance = Math.abs(Number(a) - Number(b)) / field.range
        break
      case "select":
      case "checkbox":
        distance = a === b ? 0 : 1
        break
      case "multiselect":
        distance = jaccardDistance(a as string[], b as string[])
        break
      case "text":
      case "textarea":
        if (embeddings) {
          const embA = embeddings.get(`${field.id}:${personA.userId}`)
          const embB = embeddings.get(`${field.id}:${personB.userId}`)
          distance = embA && embB ? 1 - cosineSimilarity(embA, embB) : 1
        } else {
          distance = a === b ? 0 : 1  // fallback: exact match
        }
        break
      case "date":
        distance = Math.abs(daysBetween(a, b)) / field.rangeDays
        break
      default:
        continue
    }

    totalWeight += weight
    totalDistance += weight * distance
  }

  return totalWeight > 0 ? totalDistance / totalWeight : 0
}
```

### Jaccard Distance

```typescript
function jaccardDistance(setA: string[], setB: string[]): number {
  const a = new Set(setA)
  const b = new Set(setB)
  const intersection = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  if (union.size === 0) return 0
  return 1 - intersection.size / union.size
}
```

### Cosine Similarity

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

### Greedy Group Assignment

```typescript
function greedyAssign(
  people: Person[],
  distanceMatrix: number[][],
  groupCount: number,
  minSize: number,
  maxSize: number,
  mode: "similar" | "diverse"
): Person[][] {
  // 1. Pick K seeds (most mutually distant for diversity, random for similar)
  const seeds = pickSeeds(distanceMatrix, groupCount, mode)
  const groups: Person[][] = seeds.map(s => [people[s]])
  const assigned = new Set(seeds)

  // 2. Assign remaining people
  for (let i = 0; i < people.length; i++) {
    if (assigned.has(i)) continue

    let bestGroup = -1
    let bestScore = mode === "similar" ? Infinity : -Infinity

    for (let g = 0; g < groups.length; g++) {
      if (groups[g].length >= maxSize) continue

      const avgDist = averageDistanceToGroup(i, groups[g], people, distanceMatrix)

      if (mode === "similar" && avgDist < bestScore) {
        bestScore = avgDist
        bestGroup = g
      } else if (mode === "diverse" && avgDist > bestScore) {
        bestScore = avgDist
        bestGroup = g
      }
    }

    if (bestGroup >= 0) {
      groups[bestGroup].push(people[i])
      assigned.add(i)
    }
  }

  // 3. Enforce minimum sizes (steal from largest groups)
  enforceMinSizes(groups, minSize, distanceMatrix, people)

  return groups
}
```

### Snake Draft (for Balanced Teams)

```typescript
function snakeDraft(
  people: Person[],
  teamCount: number,
  ratingField: string
): Person[][] {
  const sorted = [...people].sort((a, b) =>
    Number(b.data[ratingField]) - Number(a.data[ratingField])
  )

  const teams: Person[][] = Array.from({ length: teamCount }, () => [])
  let direction = 1
  let teamIdx = 0

  for (const person of sorted) {
    teams[teamIdx].push(person)
    teamIdx += direction
    if (teamIdx >= teamCount) { teamIdx = teamCount - 1; direction = -1 }
    if (teamIdx < 0) { teamIdx = 0; direction = 1 }
  }

  return teams
}
```

### Handling Missing Data

Gower distance naturally handles this: when computing distance between two people, skip any field where either value is missing. The final distance is the weighted average over fields where both values exist.

If a person filled fewer than 50% of grouping-relevant fields, flag them for manual assignment.

### Handling Uneven Group Sizes

For N people and K groups:
- Base size = floor(N / K)
- Remainder = N mod K
- First `remainder` groups get one extra member

---

## Part 9: Performance and Scalability

### Computation Cost

| People | Distance Matrix | Greedy Assignment | Total (no AI) | Total (with AI embeddings) |
|--------|----------------|-------------------|---------------|---------------------------|
| 20 | 400 ops | instant | < 1ms | ~2-5s (embedding) |
| 50 | 2,500 ops | instant | < 5ms | ~3-8s |
| 100 | 10,000 ops | < 10ms | < 15ms | ~5-15s |
| 200 | 40,000 ops | < 50ms | < 100ms | ~10-30s |

### Database Queries

Smart Groups needs to bulk-fetch form answers. Key queries:

```sql
-- Get all session participants with form answers
SELECT p.user_id, p.form_answers, u.name
FROM participation p
JOIN "user" u ON p.user_id = u.id
WHERE p.session_id = $1 AND p.status = 'joined'

-- Get all activity members with their join request answers
SELECT ajr.user_id, ajr.form_answers, u.name
FROM activity_join_request ajr
JOIN "user" u ON ajr.user_id = u.id
WHERE ajr.activity_id = $1 AND ajr.status = 'approved'

-- Get member ranking data (when ranking is enabled)
SELECT mr.user_id, mr.stats, rl.name as level_name, rl."order" as level_order
FROM member_rank mr
LEFT JOIN ranking_level rl ON mr.current_level_id = rl.id
WHERE mr.ranking_definition_id = $1
```

All queries use existing indexed columns. No new indexes needed for the grouping reads.

### Recommended Indexes for Smart Group Tables

```sql
CREATE INDEX idx_sg_run_session ON smart_group_run(session_id);
CREATE INDEX idx_sg_run_config ON smart_group_run(smart_group_config_id);
CREATE INDEX idx_sg_entry_run ON smart_group_entry(smart_group_run_id);
CREATE INDEX idx_sg_entry_user ON smart_group_entry(user_id);
CREATE INDEX idx_sg_proposal_run ON smart_group_proposal(smart_group_run_id);
CREATE INDEX idx_sg_history_activity_user ON smart_group_history(activity_id, user_id);
```

---

## Part 10: Phased Rollout

### Phase 1: Core Engine + Attribute Split (MVP)

**What:**
- Smart Groups as an activity-scoped plugin
- `smart_group_config`, `smart_group_run`, `smart_group_entry`, `smart_group_proposal` tables
- Attribute Split mode only (split by any form field value)
- Admin UI: "Generate Groups" button -> configure split field -> see groups -> confirm
- Uses session participant form answers as data source
- No AI in this phase

**Why start here:**
- Simplest algorithm (O(n) partition)
- Immediately useful (gender split, skill-tier split)
- Validates the full flow: config -> generate -> review -> confirm

### Phase 2: Similarity Clustering

**What:**
- Add Gower distance computation
- Add similarity and diversity grouping modes
- Per-field weight configuration in admin UI
- Group quality scores
- Support activity-level and org-level form data (not just session forms)

### Phase 3: Balanced Teams (Sports Mode)

**What:**
- Snake draft and greedy partition algorithms
- Integration with ranking plugin data
- Court/table assignment numbering
- Session-specific grouping tied to match recording

### Phase 4: AI Enhancement

**What:**
- Text embeddings via Ollama (`nomic-embed-text`) for better text-field similarity
- AI group labeling (creative names + descriptions via Mistral 7B)
- Natural language rule parsing
- All with clean fallbacks to non-AI behavior

### Phase 5: History and Variety

**What:**
- `smart_group_history` table
- Variety weight: avoid grouping same people repeatedly
- "Last grouped together" info in the review UI

### Phase 6: Tournament Integration

**What:**
- Tournament Plugin (separate) that calls Smart Groups core engine
- Multi-round generation with progressive pairing
- Swiss system, round-robin, elimination brackets
- Cross-round history tracking

---

## Part 11: Open Decisions

### Resolved (from this conversation)

| Decision | Answer |
|----------|--------|
| Name | **Smart Groups** |
| Core concept | General-purpose grouping engine, not just sports matchmaking |
| Data source | Form answers (primary), ranking data (secondary) |
| AI role | Optional enhancement layer, system works solidly without it |
| Plugin scope | Activity-scoped |
| Tournament relationship | Separate plugin that calls Smart Groups engine |

### Still Open

1. **Which form level(s) to read by default?**
   - Session forms only? Activity forms? Both merged?
   - Recommendation: Configurable per smart_group_config. Default to session forms for session-level grouping, activity forms for activity-level grouping.

2. **Should Smart Groups require forms, or work with just ranking data?**
   - Some activities may not have forms but have ranking data
   - Recommendation: Work with whatever data is available. If no forms and no ranking, offer only random grouping.

3. **Group output: just member lists, or linked to sessions/matches?**
   - Should confirming a group auto-create match records or session sub-groups?
   - Recommendation: Phase 1 outputs member lists. Phase 3 adds session/match integration.

4. **Can members see their group assignment, or only admins?**
   - Some use cases want members to see (tournament brackets), others are admin-only (balanced teams)
   - Recommendation: Configurable visibility per run.

---

## References

### Algorithms
- [Gower Distance for Mixed Data Types](https://en.wikipedia.org/wiki/Gower%27s_distance)
- [Jaccard Similarity (IBM)](https://www.ibm.com/think/topics/jaccard-similarity)
- [Balanced Maximally Diverse Grouping](https://link.springer.com/article/10.1007/s10878-023-01061-2)
- [FeedbackFruits Group Formation](https://feedbackfruits.com/solutions/group-formation)
- [GatorGrouper (GitHub)](https://github.com/GatorIncubator/gatorgrouper)

### AI Enhancement
- [nomic-embed-text (Ollama)](https://ollama.com/library/nomic-embed-text)
- [ClusterLLM: LLMs as Guide for Text Clustering (EMNLP 2023)](https://aclanthology.org/2023.emnlp-main.858/)
- [In-Context Clustering with LLMs](https://arxiv.org/html/2510.08466v1)
- [TnT-LLM: Text Mining at Scale (ACM)](https://dl.acm.org/doi/pdf/10.1145/3637528.3671647)

### Sports Matchmaking (from original research)
- [OpenSkill (npm)](https://www.npmjs.com/package/openskill) — Patent-free Bayesian rating
- [Swiss-system tournament (Wikipedia)](https://en.wikipedia.org/wiki/Swiss-system_tournament)
- [DUPR](https://www.dupr.com/) — Universal rating system
- [Playtomic](https://playtomic.com/) — Padel/tennis matchmaking
- [Swish Sports](https://swishsportsapp.com/) — Court assignment + round-robin

### Products
- [Bumble BFF](https://bumble.com/bff) — Interest-based friend grouping
- [Meetup](https://meetup.com/) — Interest-based community groups
- [FeedbackFruits](https://feedbackfruits.com/) — Educational group formation
