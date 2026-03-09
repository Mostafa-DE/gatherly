import { useMemo, useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

type Round = { id: string; roundNumber: number; groupId: string | null }
type Match = {
  id: string
  roundId: string
  matchNumber: number
  status: string
  scores: unknown
  winnerEntryId: string | null
}
type MatchEntry = {
  id: string
  matchId: string
  entryId: string
  slot: number
  result: string | null
  score: unknown
}
type Edge = {
  id: string
  fromMatchId: string
  toMatchId: string
  outcomeType: string
  toSlot: number
}
type ParticipantSummary = {
  id: string
  userId?: string | null
  participantName: string
  participantImage: string | null
  seed: number | null
  rankPosition?: number | null
  rankLevelName?: string | null
  rankLevelColor?: string | null
}

type BracketTreeProps = {
  rounds: Round[]
  matches: Match[]
  matchEntries: MatchEntry[]
  edges: Edge[]
  participantMap: Map<string, ParticipantSummary>
  currentUserId?: string | null
  isAdmin: boolean
  format?: string
  onReportScore: (matchId: string) => void
  onForfeit: (matchId: string) => void
}

type RoundColumn = {
  round: Round
  matches: Match[]
}

// Compact layout constants — designed to fit without scrolling
const MATCH_W = 184
const MATCH_H = 54
const ROUND_GAP = 36
const V_GAP = 12
const PAD = 16
const HEADER_H = 28

export function BracketTree({
  rounds,
  matches,
  matchEntries,
  edges,
  participantMap,
  currentUserId,
  isAdmin,
  format,
  onReportScore,
  onForfeit: _onForfeit,
}: BracketTreeProps) {
  const allColumns = useMemo(() => {
    const sorted = [...rounds]
      .filter((r) => !r.groupId)
      .sort((a, b) => a.roundNumber - b.roundNumber)
    return sorted.map((round) => ({
      round,
      matches: matches
        .filter((m) => m.roundId === round.id)
        .sort((a, b) => a.matchNumber - b.matchNumber),
    }))
  }, [rounds, matches])

  if (allColumns.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No bracket data to display.
      </div>
    )
  }

  const sharedProps = {
    matchEntries,
    edges,
    participantMap,
    currentUserId,
    isAdmin,
    onReportScore,
  }

  if (format === "double_elimination") {
    const { wb, lb, gf } = splitDoubleElimination(allColumns)
    return (
      <div className="space-y-4">
        {wb.length > 0 && (
          <BracketSection
            label="Winners Bracket"
            accentClass="border-l-[var(--color-primary)]"
          >
            <AutoScaledBracket
              columns={wb}
              {...sharedProps}
              labelFn={makeWBLabel(wb.length)}
            />
          </BracketSection>
        )}
        {lb.length > 0 && (
          <BracketSection
            label="Losers Bracket"
            accentClass="border-l-amber-500"
          >
            <AutoScaledBracket
              columns={lb}
              {...sharedProps}
              labelFn={makeLBLabel(lb.length)}
            />
          </BracketSection>
        )}
        {gf.length > 0 && gf[0].matches.length > 0 && (
          <BracketSection
            label="Grand Final"
            accentClass="border-l-purple-500"
          >
            <GrandFinalCard
              match={gf[0].matches[0]}
              matchEntries={matchEntries}
              participantMap={participantMap}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReportScore={onReportScore}
            />
          </BracketSection>
        )}
      </div>
    )
  }

  // Single elimination or other bracket formats
  return (
    <AutoScaledBracket
      columns={allColumns}
      {...sharedProps}
      labelFn={makeSELabel(allColumns.length)}
    />
  )
}

// ---------------------------------------------------------------------------
// Double elimination round splitter
// ---------------------------------------------------------------------------

function splitDoubleElimination(columns: RoundColumn[]) {
  if (columns.length === 0) return { wb: [] as RoundColumn[], lb: [] as RoundColumn[], gf: [] as RoundColumn[] }

  // WB rounds follow a halving pattern: R1 has max matches, each round halves
  const wb: RoundColumn[] = []
  let expectedCount = columns[0].matches.length

  for (const col of columns) {
    if (col.matches.length === expectedCount && expectedCount >= 1) {
      wb.push(col)
      // WB final reached when we hit 1 match and have at least 2 rounds
      if (col.matches.length === 1 && wb.length > 1) break
      expectedCount = Math.max(1, Math.floor(expectedCount / 2))
    } else {
      break
    }
  }

  // Grand final is always the last column
  const gf =
    columns.length > wb.length ? [columns[columns.length - 1]] : []

  // Losers bracket is everything between WB and GF
  const lbStart = wb.length
  const lbEnd = gf.length > 0 ? columns.length - 1 : columns.length
  const lb = columns.slice(lbStart, lbEnd)

  return { wb, lb, gf }
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function BracketSection({
  label,
  accentClass,
  children,
}: {
  label: string
  accentClass: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/20 overflow-hidden">
      <div className={cn("border-l-[3px] px-4 py-2", accentClass)}>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </h3>
      </div>
      <div className="px-3 pb-3">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-scaled bracket renderer
// ---------------------------------------------------------------------------

function AutoScaledBracket({
  columns,
  edges,
  matchEntries,
  participantMap,
  currentUserId,
  isAdmin,
  onReportScore,
  labelFn,
}: {
  columns: RoundColumn[]
  edges: Edge[]
  matchEntries: MatchEntry[]
  participantMap: Map<string, ParticipantSummary>
  currentUserId?: string | null
  isAdmin: boolean
  onReportScore: (matchId: string) => void
  labelFn: (colIdx: number) => string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // Only show edges where both ends are in this section
  const sectionMatchIds = useMemo(() => {
    const ids = new Set<string>()
    for (const col of columns) {
      for (const m of col.matches) ids.add(m.id)
    }
    return ids
  }, [columns])

  const sectionEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          sectionMatchIds.has(e.fromMatchId) &&
          sectionMatchIds.has(e.toMatchId)
      ),
    [edges, sectionMatchIds]
  )

  // Compute dimensions
  const maxMatchCount = Math.max(
    ...columns.map((c) => c.matches.length),
    1
  )
  const sectionH =
    maxMatchCount * MATCH_H + Math.max(0, maxMatchCount - 1) * V_GAP
  const totalWidth =
    columns.length * (MATCH_W + ROUND_GAP) - ROUND_GAP + PAD * 2
  const totalHeight = sectionH + PAD * 2
  const fullHeight = totalHeight + HEADER_H

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setScale(Math.min(1, Math.max(0.7, w / totalWidth)))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [totalWidth])

  const visualW = totalWidth * scale
  const visualH = fullHeight * scale

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto overflow-y-hidden"
    >
      {/* Sized wrapper matches the visual (scaled) dimensions */}
      <div
        style={{
          width: `${visualW}px`,
          height: `${visualH}px`,
          position: "relative",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            width: `${totalWidth}px`,
            height: `${fullHeight}px`,
          }}
        >
          {/* Round headers */}
          <div className="flex" style={{ height: `${HEADER_H}px` }}>
            {columns.map((col, i) => (
              <div
                key={col.round.id}
                className="flex items-end justify-center"
                style={{
                  width: `${MATCH_W}px`,
                  marginLeft: i === 0 ? `${PAD}px` : `${ROUND_GAP}px`,
                }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {labelFn(i)}
                </span>
              </div>
            ))}
          </div>

          {/* Bracket area (SVG connectors + match nodes) */}
          <div
            className="relative"
            style={{
              width: `${totalWidth}px`,
              height: `${totalHeight}px`,
            }}
          >
            {/* SVG connector lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={totalWidth}
              height={totalHeight}
            >
              {columns.map((col, colIdx) => {
                if (colIdx === 0) return null
                return col.matches.map((match) => {
                  const incoming = sectionEdges.filter(
                    (e) => e.toMatchId === match.id
                  )
                  return incoming.map((edge) => {
                    // Find source match position
                    let fromColIdx = -1
                    let fromMatchIdx = -1
                    for (let ci = 0; ci < columns.length; ci++) {
                      const mi = columns[ci].matches.findIndex(
                        (m) => m.id === edge.fromMatchId
                      )
                      if (mi !== -1) {
                        fromColIdx = ci
                        fromMatchIdx = mi
                        break
                      }
                    }
                    if (fromColIdx === -1) return null

                    const toMatchIdx = col.matches.indexOf(match)

                    const fromY =
                      PAD +
                      matchCenterY(
                        fromMatchIdx,
                        columns[fromColIdx].matches.length,
                        sectionH
                      )
                    const toY =
                      PAD +
                      matchCenterY(
                        toMatchIdx,
                        col.matches.length,
                        sectionH
                      )

                    const fromX =
                      PAD +
                      fromColIdx * (MATCH_W + ROUND_GAP) +
                      MATCH_W
                    const toX =
                      PAD + colIdx * (MATCH_W + ROUND_GAP)
                    const midX = (fromX + toX) / 2

                    return (
                      <path
                        key={edge.id}
                        d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
                        fill="none"
                        stroke="var(--color-border)"
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    )
                  })
                })
              })}
            </svg>

            {/* Match nodes */}
            {columns.map((col, colIdx) =>
              col.matches.map((match, matchIdx) => {
                const centerY =
                  PAD +
                  matchCenterY(
                    matchIdx,
                    col.matches.length,
                    sectionH
                  )
                const x = PAD + colIdx * (MATCH_W + ROUND_GAP)
                const y = centerY - MATCH_H / 2

                const entries = matchEntries
                  .filter((me) => me.matchId === match.id)
                  .sort((a, b) => a.slot - b.slot)
                const canAct =
                  isAdmin &&
                  entries.length >= 2 &&
                  (match.status === "pending" ||
                    match.status === "in_progress")

                return (
                  <div
                    key={match.id}
                    className="absolute"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${MATCH_W}px`,
                      height: `${MATCH_H}px`,
                    }}
                  >
                    <CompactMatchNode
                      match={match}
                      entries={entries}
                      participantMap={participantMap}
                      currentUserId={currentUserId}
                      canAct={canAct}
                      onReportScore={() => onReportScore(match.id)}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Match center Y calculation
// ---------------------------------------------------------------------------

function matchCenterY(
  matchIdx: number,
  matchCount: number,
  sectionHeight: number
): number {
  if (matchCount === 1) return sectionHeight / 2
  const step = sectionHeight / matchCount
  return step * matchIdx + step / 2
}

// ---------------------------------------------------------------------------
// Compact match node
// ---------------------------------------------------------------------------

function CompactMatchNode({
  match,
  entries,
  participantMap,
  currentUserId,
  canAct,
  onReportScore,
}: {
  match: Match
  entries: MatchEntry[]
  participantMap: Map<string, ParticipantSummary>
  currentUserId?: string | null
  canAct: boolean
  onReportScore: () => void
}) {
  const isCompleted = match.status === "completed"
  const isForfeit = match.status === "forfeit"
  const isBye = match.status === "bye"

  return (
    <div
      className={cn(
        "h-full rounded-md border overflow-hidden flex flex-col bg-card",
        isCompleted
          ? "border-[var(--color-status-success)]/30"
          : isForfeit
            ? "border-red-400/30"
            : "border-border",
        canAct &&
          "cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors"
      )}
      onClick={canAct ? onReportScore : undefined}
    >
      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground">
          TBD
        </div>
      ) : (
        entries.map((entry, i) => {
          const participant = participantMap.get(entry.entryId)
          const participantLabel =
            participant?.userId && currentUserId && participant.userId === currentUserId
              ? "You"
              : participant?.participantName ?? "TBD"
          const isWinner = match.winnerEntryId === entry.entryId
          const score = entry.score as Record<string, unknown> | null

          return (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-1.5 px-2 flex-1 min-h-0",
                i > 0 && "border-t border-border/40",
                isWinner &&
                  isCompleted &&
                  "bg-[var(--color-badge-success-bg)]"
              )}
            >
              {participant?.rankPosition != null && (
                <span
                  className="inline-flex min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold leading-none"
                  style={{
                    backgroundColor: participant.rankLevelColor
                      ? `${participant.rankLevelColor}20`
                      : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color:
                      participant.rankLevelColor ?? "var(--color-primary)",
                  }}
                >
                  {participant.rankPosition}
                </span>
              )}
              <span
                className={cn(
                  "flex-1 truncate text-[11px] leading-tight",
                  isWinner && isCompleted && "font-semibold"
                )}
              >
                {participantLabel}
              </span>
              {score && "points" in score && (
                <span className="font-mono text-[10px] font-medium shrink-0">
                  {String(score.points)}
                </span>
              )}
              {entry.result === "forfeit" && (
                <span className="text-[8px] text-red-500 font-medium shrink-0">
                  FF
                </span>
              )}
            </div>
          )
        })
      )}
      {isBye && entries.length <= 1 && entries.length > 0 && (
        <div className="flex items-center justify-center flex-1 text-[11px] text-muted-foreground border-t border-border/40">
          BYE
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grand Final card (special prominent layout)
// ---------------------------------------------------------------------------

function GrandFinalCard({
  match,
  matchEntries,
  participantMap,
  currentUserId,
  isAdmin,
  onReportScore,
}: {
  match: Match
  matchEntries: MatchEntry[]
  participantMap: Map<string, ParticipantSummary>
  currentUserId?: string | null
  isAdmin: boolean
  onReportScore: (matchId: string) => void
}) {
  const entries = matchEntries
    .filter((me) => me.matchId === match.id)
    .sort((a, b) => a.slot - b.slot)
  const canAct =
    isAdmin &&
    entries.length >= 2 &&
    (match.status === "pending" || match.status === "in_progress")
  const isCompleted = match.status === "completed"

  const entry1 = entries[0]
  const entry2 = entries[1]
  const p1 = entry1 ? participantMap.get(entry1.entryId) : null
  const p2 = entry2 ? participantMap.get(entry2.entryId) : null
  const p1Label =
    p1?.userId && currentUserId && p1.userId === currentUserId
      ? "You"
      : p1?.participantName ?? "TBD"
  const p2Label =
    p2?.userId && currentUserId && p2.userId === currentUserId
      ? "You"
      : p2?.participantName ?? "TBD"
  const winner1 = entry1 && match.winnerEntryId === entry1.entryId
  const winner2 = entry2 && match.winnerEntryId === entry2.entryId

  return (
    <div
      className={cn(
        "max-w-md mx-auto rounded-lg border bg-card p-4",
        isCompleted
          ? "border-[var(--color-status-success)]/30"
          : "border-border",
        canAct &&
          "cursor-pointer hover:border-[var(--color-primary)]/50 transition-colors"
      )}
      onClick={canAct ? () => onReportScore(match.id) : undefined}
    >
      <div className="flex items-center gap-4">
        {/* Player 1 */}
        <div
          className={cn(
            "flex-1 rounded-md px-3 py-2.5 text-center",
            winner1 && isCompleted
              ? "bg-[var(--color-badge-success-bg)]"
              : "bg-muted/30"
          )}
        >
          {(p1?.rankPosition != null || p1?.rankLevelName) && (
            <div className="mb-1 flex justify-center gap-1">
              {p1?.rankPosition != null && (
                <span
                  className="inline-flex min-w-10 items-center justify-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold leading-none"
                  style={{
                    backgroundColor: p1.rankLevelColor
                      ? `${p1.rankLevelColor}20`
                      : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: p1.rankLevelColor ?? "var(--color-primary)",
                  }}
                >
                  {p1.rankPosition}
                </span>
              )}
              {p1?.rankLevelName && (
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none"
                  style={{
                    backgroundColor: p1.rankLevelColor
                      ? `${p1.rankLevelColor}20`
                      : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: p1.rankLevelColor ?? "var(--color-primary)",
                  }}
                >
                  {p1.rankLevelName}
                </span>
              )}
            </div>
          )}
          <div
            className={cn(
              "text-sm truncate",
              winner1 && isCompleted && "font-semibold"
            )}
          >
            {p1Label}
          </div>
          {entry1?.score &&
            typeof entry1.score === "object" &&
            entry1.score !== null &&
            "points" in entry1.score ? (
              <div className="text-xs font-mono font-medium mt-0.5">
                {String(
                  (entry1.score as { points: unknown }).points
                )}
              </div>
            ) : null}
        </div>

        {/* VS divider */}
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
          vs
        </span>

        {/* Player 2 */}
        <div
          className={cn(
            "flex-1 rounded-md px-3 py-2.5 text-center",
            winner2 && isCompleted
              ? "bg-[var(--color-badge-success-bg)]"
              : "bg-muted/30"
          )}
        >
          {(p2?.rankPosition != null || p2?.rankLevelName) && (
            <div className="mb-1 flex justify-center gap-1">
              {p2?.rankPosition != null && (
                <span
                  className="inline-flex min-w-10 items-center justify-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold leading-none"
                  style={{
                    backgroundColor: p2.rankLevelColor
                      ? `${p2.rankLevelColor}20`
                      : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: p2.rankLevelColor ?? "var(--color-primary)",
                  }}
                >
                  {p2.rankPosition}
                </span>
              )}
              {p2?.rankLevelName && (
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none"
                  style={{
                    backgroundColor: p2.rankLevelColor
                      ? `${p2.rankLevelColor}20`
                      : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: p2.rankLevelColor ?? "var(--color-primary)",
                  }}
                >
                  {p2.rankLevelName}
                </span>
              )}
            </div>
          )}
          <div
            className={cn(
              "text-sm truncate",
              winner2 && isCompleted && "font-semibold"
            )}
          >
            {p2Label}
          </div>
          {entry2?.score &&
            typeof entry2.score === "object" &&
            entry2.score !== null &&
            "points" in entry2.score ? (
              <div className="text-xs font-mono font-medium mt-0.5">
                {String(
                  (entry2.score as { points: unknown }).points
                )}
              </div>
            ) : null}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Round label generators
// ---------------------------------------------------------------------------

function makeSELabel(totalRounds: number) {
  return (colIdx: number) => {
    const roundNum = colIdx + 1
    if (roundNum === totalRounds) return "Final"
    if (roundNum === totalRounds - 1) return "Semi-Final"
    if (roundNum === totalRounds - 2) return "Quarter-Final"
    return `Round ${roundNum}`
  }
}

function makeWBLabel(totalRounds: number) {
  return (colIdx: number) => {
    const roundNum = colIdx + 1
    if (roundNum === totalRounds) return "WB Final"
    if (roundNum === totalRounds - 1 && totalRounds > 2) return "WB Semi"
    return `WB ${roundNum}`
  }
}

function makeLBLabel(totalRounds: number) {
  return (colIdx: number) => {
    const roundNum = colIdx + 1
    if (roundNum === totalRounds) return "LB Final"
    return `LB ${roundNum}`
  }
}
