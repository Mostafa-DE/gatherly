import type { RankingDomain } from "./types"
import { padelDomain } from "./padel/index"
import { footballDomain } from "./football/index"
import { readingDomain } from "./reading/index"
import { badmintonDomain } from "./badminton/index"
import { volleyballDomain } from "./volleyball/index"
import { tennisDomain } from "./tennis/index"
import { pingPongDomain } from "./ping-pong/index"
import { laserTagDomain } from "./laser-tag/index"

export type {
  RankingDomain,
  StatField,
  TieBreakRule,
  MatchFormat,
  MatchScoreValidation,
  DerivedStats,
  MatchResult,
  FormatRule,
  MatchInputProps,
  MatchDisplayProps,
  MatchConfig,
  SessionConfig,
} from "./types"

import type { MatchFormat, FormatRule } from "./types"

const domainRegistry = new Map<string, RankingDomain>([
  [padelDomain.id, padelDomain],
  [footballDomain.id, footballDomain],
  [readingDomain.id, readingDomain],
  [badmintonDomain.id, badmintonDomain],
  [volleyballDomain.id, volleyballDomain],
  [tennisDomain.id, tennisDomain],
  [pingPongDomain.id, pingPongDomain],
  [laserTagDomain.id, laserTagDomain],
])

export function getDomain(domainId: string): RankingDomain | undefined {
  return domainRegistry.get(domainId)
}

export function listDomains(): RankingDomain[] {
  return Array.from(domainRegistry.values())
}

export function isDomainValid(domainId: string): boolean {
  return domainRegistry.has(domainId)
}

/** Get valid match formats for a domain (returns null if not match-mode) */
export function getMatchModeFormats(domainId: string): {
  formats: MatchFormat[]
  defaultFormat: MatchFormat
  formatRules: Record<MatchFormat, FormatRule>
} | null {
  const domain = domainRegistry.get(domainId)
  if (!domain?.sessionConfig || domain.sessionConfig.mode !== "match" || !domain.matchConfig) {
    return null
  }
  return {
    formats: domain.matchConfig.supportedFormats,
    defaultFormat: domain.matchConfig.defaultFormat,
    formatRules: domain.matchConfig.formatRules,
  }
}

/** Reverse-derive format from capacity (for edit form) */
export function getFormatFromCapacity(domainId: string, capacity: number): MatchFormat | null {
  const domain = domainRegistry.get(domainId)
  if (!domain?.matchConfig) return null
  for (const [format, rule] of Object.entries(domain.matchConfig.formatRules)) {
    if (rule.playersPerTeam && rule.playersPerTeam * 2 === capacity) return format
    if (rule.minPlayersPerTeam != null && rule.maxPlayersPerTeam != null) {
      if (capacity >= rule.minPlayersPerTeam * 2 && capacity <= rule.maxPlayersPerTeam * 2) return format
    }
  }
  return null
}
