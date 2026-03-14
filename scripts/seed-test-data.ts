/**
 * Seed realistic test data for Gatherly.
 *
 * Usage:
 *   pnpm db:seed:test          # seed test data
 *   pnpm db:seed:test --clean  # remove seeded test data (restore previous state)
 *
 * What it creates:
 *   - 1 admin user (the "owner") + 104 member users (with gender + nationality)
 *   - 1 organization ("Seed Community TEST") with settings
 *     - Org join form: Gender, Nationality, Age Range (general questions)
 *   - All members added to the org with profile answers
 *   - 19 domain-specific activities: Padel, Football, Badminton, Volleyball,
 *     Tennis, Ping Pong, Laser Tag, Basketball, Hockey, etc. — each with:
 *     - Ranking definitions and levels
 *     - Sport-specific join forms (e.g. Padel: preferred side, dominant hand,
 *       weight/height range, own racket; Football: position, preferred foot, etc.)
 *     - Smart Groups + Tournaments plugins enabled + config
 *   - Historical + upcoming published sessions across all activities (some with session join forms)
 *   - Match records with realistic scores per domain
 *   - Member ranks with accumulated stats and levels
 *   - Activity join requests with sport-specific form answers
 *   - Participations (some with session form answers), member notes, join requests, invite links
 *   - Tournaments across activities (draft, registration, in-progress, completed) with brackets + scores
 *
 * All seeded records use a deterministic ID prefix "seed_" so cleanup is safe.
 */

import { eq, like, inArray, and } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { auth } from "../src/auth"
import { db } from "../src/db"
import {
  user,
  organization,
  member,
  organizationSettings,
  activity,
  activityMember,
  eventSession,
  participation,
  joinRequest,
  activityJoinRequest,
  groupMemberProfile,
  memberNote,
  inviteLink,
} from "../src/db/schema"
import {
  rankingDefinition,
  rankingLevel,
  memberRank,
  matchRecord,
  rankStatEntry,
} from "../src/plugins/ranking/schema"
import { resolvePadelMatch } from "../src/plugins/ranking/domains/padel"
import { resolveFootballMatch } from "../src/plugins/ranking/domains/football"
import { resolveBadmintonMatch } from "../src/plugins/ranking/domains/badminton"
import { resolveVolleyballMatch } from "../src/plugins/ranking/domains/volleyball"
import { resolveTennisMatch } from "../src/plugins/ranking/domains/tennis"
import { resolvePingPongMatch } from "../src/plugins/ranking/domains/ping-pong"
import { resolveLaserTagMatch } from "../src/plugins/ranking/domains/laser-tag"
import { resolveBasketballMatch } from "../src/plugins/ranking/domains/basketball"
import { resolveHockeyMatch } from "../src/plugins/ranking/domains/hockey"
import { resolveFlagFootballMatch } from "../src/plugins/ranking/domains/flag-football"
import { resolveKickballMatch } from "../src/plugins/ranking/domains/kickball"
import { resolveDodgeballMatch } from "../src/plugins/ranking/domains/dodgeball"
import { resolveFoosballMatch } from "../src/plugins/ranking/domains/foosball"
import { resolveBowlingMatch } from "../src/plugins/ranking/domains/bowling"
import { resolvePoolMatch } from "../src/plugins/ranking/domains/pool"
import { resolveDartsMatch } from "../src/plugins/ranking/domains/darts"
import { resolvePklBallMatch } from "../src/plugins/ranking/domains/pkl-ball"
import { resolveSquashMatch } from "../src/plugins/ranking/domains/squash"
import { resolveChessMatch } from "../src/plugins/ranking/domains/chess"
import {
  smartGroupConfig,
} from "../src/plugins/smart-groups/schema"
import {
  tournament,
  tournamentMatch,
  tournamentMatchEntry,
} from "../src/plugins/tournaments/schema"
import { createTournament } from "../src/plugins/tournaments/data-access/tournaments"
import { registerEntry, randomizeSeeds } from "../src/plugins/tournaments/data-access/entries"
import { startTournament, completeMatch } from "../src/plugins/tournaments/data-access/lifecycle"
import { advanceGroupStage } from "../src/plugins/tournaments/data-access/advancement"
import { createTeam, joinTeam, registerTeamEntry } from "../src/plugins/tournaments/data-access/teams"
import { getDomain, hasIndividualStats } from "../src/plugins/ranking/domains"
import { injectRankingAttributeFields } from "../src/plugins/ranking/utils/join-form-attributes"
import type { JoinFormSchema } from "../src/types/form"
import type { TournamentFormat, TournamentConfig } from "../src/plugins/tournaments/types"

// ─── Config ──────────────────────────────────────────────────────────────────

const SEED_PREFIX = "seed_"
const OWNER_EMAIL = "admin@example.com"
const OWNER_USERNAME = "seedadmin"
const ORG_SLUG = `${OWNER_USERNAME}-seed-community-test`
const PASSWORD = "password123"
const UPCOMING_SESSIONS_PER_ACTIVITY = 3

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedId(suffix: string) {
  return `${SEED_PREFIX}${suffix}`
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function weighted<T>(options: [T, number][]): T {
  const total = options.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [val, w] of options) {
    r -= w
    if (r <= 0) return val
  }
  return options[options.length - 1][0]
}

/** Distribute a total randomly among n buckets (e.g., 5 goals among 3 players → [2, 2, 1]) */
function distributeAmong(total: number, n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [total]
  const result = new Array(n).fill(0)
  for (let i = 0; i < total; i++) {
    result[Math.floor(Math.random() * n)]++
  }
  return result
}

// ─── Data definitions ────────────────────────────────────────────────────────

const MEMBER_DATA = [
  { name: "Lina Haddad", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Omar Khalil", city: "Dubai", gender: "Male", nationality: "Emirati" },
  { name: "Sara Nasser", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Youssef Farah", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Nadia Karam", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Tariq Bazzi", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Layla Mansour", city: "Istanbul", gender: "Female", nationality: "Turkish" },
  { name: "Karim Saleh", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Rania Attar", city: "Dubai", gender: "Female", nationality: "Emirati" },
  { name: "Hassan Jaber", city: "Amman", gender: "Male", nationality: "Palestinian" },
  { name: "Dina Awad", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Fadi Tawil", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Mira Sabbagh", city: "Cairo", gender: "Female", nationality: "Egyptian" },
  { name: "Sami Issa", city: "Amman", gender: "Male", nationality: "Palestinian" },
  { name: "Hana Rashed", city: "Dubai", gender: "Female", nationality: "Emirati" },
  { name: "Ziad Mourad", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Jana Khoury", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Bilal Saad", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Noor Hamdan", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Adam Darwish", city: "Istanbul", gender: "Male", nationality: "Turkish" },
  { name: "Lara Nassar", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Mahmoud Ali", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Aya Bishara", city: "Dubai", gender: "Female", nationality: "Emirati" },
  { name: "Khaled Zein", city: "Amman", gender: "Male", nationality: "Jordanian" },
]

// Additional members (100+ total for realistic tournament brackets and community size)
MEMBER_DATA.push(
  { name: "Nour Abed", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Rami Qasim", city: "Dubai", gender: "Male", nationality: "Palestinian" },
  { name: "Lama Turk", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Ahmad Shamsi", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Reem Khatib", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Hussein Barakat", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Ghada Halabi", city: "Istanbul", gender: "Female", nationality: "Syrian" },
  { name: "Ibrahim Nassar", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Sahar Obeid", city: "Amman", gender: "Female", nationality: "Palestinian" },
  { name: "Younis Suleiman", city: "Dubai", gender: "Male", nationality: "Emirati" },
  { name: "Dalal Ghazi", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Nasir Hamed", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Nisreen Joudeh", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Waleed Shabaan", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Abeer Zaghloul", city: "Cairo", gender: "Female", nationality: "Egyptian" },
  { name: "Ayman Qadri", city: "Dubai", gender: "Male", nationality: "Palestinian" },
  { name: "Manal Bani-Hani", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Samir Abdallah", city: "Istanbul", gender: "Male", nationality: "Turkish" },
  { name: "Suha Nabulsi", city: "Amman", gender: "Female", nationality: "Palestinian" },
  { name: "Adel Masri", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Wafa Rimawi", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Haitham Arafat", city: "Dubai", gender: "Male", nationality: "Palestinian" },
  { name: "Samira Hindi", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Nabil Najjar", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Huda Samhan", city: "Riyadh", gender: "Female", nationality: "Saudi" },
  { name: "Firas Badran", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Lubna Kaddoura", city: "Cairo", gender: "Female", nationality: "Egyptian" },
  { name: "Amer Aqel", city: "Dubai", gender: "Male", nationality: "Emirati" },
  { name: "Sawsan Ajlouni", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Majid Tamimi", city: "Istanbul", gender: "Male", nationality: "Turkish" },
  { name: "Nawal Jarrar", city: "Amman", gender: "Female", nationality: "Palestinian" },
  { name: "Rafiq Bataineh", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Amina Omari", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Jamal Dajani", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Leena Tarifi", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Bassam Zureikat", city: "Dubai", gender: "Male", nationality: "Palestinian" },
  { name: "Dalia Maaytah", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Munir Sweiss", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Ruba Hamdallah", city: "Amman", gender: "Female", nationality: "Palestinian" },
  { name: "Tamer Shaban", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Hala Tawalbeh", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Wael Rawashdeh", city: "Dubai", gender: "Male", nationality: "Emirati" },
  { name: "Shireen Momani", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Imad Haddadin", city: "Beirut", gender: "Male", nationality: "Lebanese" },
  { name: "Tamara Abadi", city: "Amman", gender: "Female", nationality: "Palestinian" },
  { name: "Hazem Obeidat", city: "Istanbul", gender: "Male", nationality: "Turkish" },
  { name: "Asma Faouri", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Raed Masarweh", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Bushra Toukan", city: "Dubai", gender: "Female", nationality: "Emirati" },
  { name: "Ashraf Dmour", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Khadija Qutob", city: "Riyadh", gender: "Female", nationality: "Saudi" },
  { name: "Nizar Zoubi", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "May Hijazi", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Mustafa Gharaibeh", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Arwa Smadi", city: "Cairo", gender: "Female", nationality: "Egyptian" },
  { name: "Shadi Batayneh", city: "Dubai", gender: "Male", nationality: "Palestinian" },
  { name: "Taghreed Tal", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Ramzi Freij", city: "Istanbul", gender: "Male", nationality: "Turkish" },
  { name: "Jumana Khaldi", city: "Amman", gender: "Female", nationality: "Palestinian" },
  { name: "Marwan Habashneh", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Haneen Nsour", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Samer Adwan", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Sana Kafri", city: "Beirut", gender: "Female", nationality: "Lebanese" },
  { name: "Talal Sukkar", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Majd Arandi", city: "Dubai", gender: "Female", nationality: "Emirati" },
  { name: "Osama Tal", city: "Amman", gender: "Male", nationality: "Palestinian" },
  { name: "Rasha Azzam", city: "Istanbul", gender: "Female", nationality: "Turkish" },
  { name: "Hamza Theeb", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Intisar Yaghi", city: "Cairo", gender: "Female", nationality: "Egyptian" },
  { name: "Mohannad Faqir", city: "Riyadh", gender: "Male", nationality: "Saudi" },
  { name: "Nermin Zubi", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Ismail Khasawneh", city: "Dubai", gender: "Male", nationality: "Palestinian" },
  { name: "Leen Sharif", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Jihad Radaideh", city: "Beirut", gender: "Male", nationality: "Lebanese" },
  { name: "Duaa Muflih", city: "Amman", gender: "Female", nationality: "Jordanian" },
  { name: "Anwar Qudah", city: "Cairo", gender: "Male", nationality: "Egyptian" },
  { name: "Iman Hijjawi", city: "Dubai", gender: "Female", nationality: "Palestinian" },
  { name: "Fouad Shakhshir", city: "Amman", gender: "Male", nationality: "Jordanian" },
  { name: "Rawan Sabbah", city: "Istanbul", gender: "Female", nationality: "Turkish" },
  { name: "Zaid Ababneh", city: "Amman", gender: "Male", nationality: "Jordanian" },
)

const AGE_RANGES = ["18-25", "26-35", "36-45", "46-55"]

// ─── Domain configs for seed ─────────────────────────────────────────────────

type DomainSeedConfig = {
  domainId: string
  activityName: string
  activitySlug: string
  memberPercent: number // what % of total members join this activity
  sessionsCount: number // each session = 1 match (driven by domain sessionConfig)
  generateScores: () => unknown
  resolveMatch: (scores: unknown) => {
    winner: "team1" | "team2" | "draw"
    team1Stats: Record<string, number>
    team2Stats: Record<string, number>
  }
  levels: { name: string; color: string; order: number }[]
  sessionTemplates: { title: string; location: string; price: string | null }[]
}

/**
 * Derive session capacity (maxCapacity) and playersPerTeam from the domain's
 * format rules. Session = 1 match, capacity = playersPerTeam * 2.
 */
function getDomainFormatInfo(domainId: string): {
  defaultFormat: string
  playersPerTeam: number
  maxCapacity: number
} {
  const domain = getDomain(domainId)
  if (!domain?.matchConfig) {
    throw new Error(`Domain ${domainId} has no matchConfig`)
  }

  const fmt = domain.matchConfig.defaultFormat
  const rule = domain.matchConfig.formatRules[fmt]
  if (!rule) {
    throw new Error(`Domain ${domainId} has no rule for format ${fmt}`)
  }

  // Use exact playersPerTeam, or midpoint of min/max for flexible formats
  const ppt = rule.playersPerTeam
    ?? Math.ceil(((rule.minPlayersPerTeam ?? 1) + (rule.maxPlayersPerTeam ?? 1)) / 2)

  return {
    defaultFormat: fmt,
    playersPerTeam: ppt,
    maxCapacity: ppt * 2,
  }
}

// sessionsCount = total number of sessions (each = 1 match, driven by domain sessionConfig)
const DOMAIN_CONFIGS: DomainSeedConfig[] = [
  {
    domainId: "padel",
    activityName: "Padel",
    activitySlug: "padel",
    memberPercent: 60,
    sessionsCount: 20, // was 5×4
    generateScores: generatePadelScores,
    resolveMatch: resolvePadelMatch,
    levels: [
      { name: "A", color: "#9CA3AF", order: 0 },
      { name: "A+", color: "#6B7280", order: 1 },
      { name: "D-", color: "#4B5563", order: 2 },
      { name: "D", color: "#60A5FA", order: 3 },
      { name: "D+", color: "#3B82F6", order: 4 },
      { name: "C-", color: "#2563EB", order: 5 },
      { name: "C", color: "#34D399", order: 6 },
      { name: "C+", color: "#10B981", order: 7 },
    ],
    sessionTemplates: [
      { title: "Padel Doubles Night", location: "Padel Club Amman", price: "10.00" },
      { title: "Weekend Padel Session", location: "Sports Arena JO", price: "8.00" },
      { title: "Padel Open Play", location: "Al-Hussein Sports City", price: null },
      { title: "Padel Tournament", location: "Padel Club Amman", price: "15.00" },
      { title: "Padel Training & Matches", location: "Pro Padel Courts", price: "12.00" },
    ],
  },
  {
    domainId: "football",
    activityName: "Football",
    activitySlug: "football",
    memberPercent: 80,
    sessionsCount: 15, // was 5×3
    generateScores: generateFootballScores,
    resolveMatch: resolveFootballMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Elite", color: "#F97316", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Friday Night Football", location: "Al-Hussein Sports City", price: "5.00" },
      { title: "5-a-Side Pickup", location: "Community Center Field", price: null },
      { title: "Weekend Football", location: "JU Stadium", price: "7.00" },
      { title: "Evening Kickabout", location: "Abdoun Park", price: null },
      { title: "Football League Night", location: "Sports Arena JO", price: "10.00" },
    ],
  },
  {
    domainId: "badminton",
    activityName: "Badminton",
    activitySlug: "badminton",
    memberPercent: 40,
    sessionsCount: 12, // was 3×4
    generateScores: generateBadmintonScores,
    resolveMatch: resolveBadmintonMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Lower Intermediate", color: "#60A5FA", order: 1 },
      { name: "Intermediate", color: "#3B82F6", order: 2 },
      { name: "Upper Intermediate", color: "#34D399", order: 3 },
      { name: "Advanced", color: "#F97316", order: 4 },
    ],
    sessionTemplates: [
      { title: "Badminton Singles Night", location: "Community Center Court", price: "3.00" },
      { title: "Open Badminton Session", location: "JU Gym", price: null },
      { title: "Badminton Round Robin", location: "Pro Training Facility", price: "5.00" },
    ],
  },
  {
    domainId: "volleyball",
    activityName: "Volleyball",
    activitySlug: "volleyball",
    memberPercent: 50,
    sessionsCount: 9, // was 3×3
    generateScores: generateVolleyballScores,
    resolveMatch: resolveVolleyballMatch,
    levels: [
      { name: "Recreational", color: "#9CA3AF", order: 0 },
      { name: "B", color: "#60A5FA", order: 1 },
      { name: "B+", color: "#3B82F6", order: 2 },
      { name: "BB", color: "#34D399", order: 3 },
      { name: "BB+", color: "#10B981", order: 4 },
      { name: "A", color: "#F97316", order: 5 },
    ],
    sessionTemplates: [
      { title: "Beach Volleyball", location: "Aqaba Beach Club", price: "8.00" },
      { title: "Indoor Volleyball", location: "JU Gym", price: "5.00" },
      { title: "Volleyball Tournament", location: "Sports Arena JO", price: "12.00" },
    ],
  },
  {
    domainId: "tennis",
    activityName: "Tennis",
    activitySlug: "tennis",
    memberPercent: 35,
    sessionsCount: 9, // was 3×3
    generateScores: generateTennisScores,
    resolveMatch: resolveTennisMatch,
    levels: [
      { name: "NTRP 2.0", color: "#9CA3AF", order: 0 },
      { name: "NTRP 2.5", color: "#6B7280", order: 1 },
      { name: "NTRP 3.0", color: "#60A5FA", order: 2 },
      { name: "NTRP 3.5", color: "#3B82F6", order: 3 },
      { name: "NTRP 4.0", color: "#34D399", order: 4 },
      { name: "NTRP 4.5", color: "#10B981", order: 5 },
      { name: "NTRP 5.0", color: "#F97316", order: 6 },
    ],
    sessionTemplates: [
      { title: "Tennis Singles Ladder", location: "Royal Tennis Club", price: "10.00" },
      { title: "Morning Tennis", location: "Abdoun Courts", price: "7.00" },
      { title: "Tennis Match Day", location: "Royal Tennis Club", price: "10.00" },
    ],
  },
  {
    domainId: "ping-pong",
    activityName: "Ping Pong",
    activitySlug: "ping-pong",
    memberPercent: 45,
    sessionsCount: 15, // was 3×5
    generateScores: generatePingPongScores,
    resolveMatch: resolvePingPongMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Expert", color: "#F97316", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Ping Pong Night", location: "Community Center", price: null },
      { title: "Table Tennis Tournament", location: "JU Rec Room", price: "3.00" },
      { title: "Lunchtime Ping Pong", location: "Office Lounge", price: null },
    ],
  },
  {
    domainId: "laser-tag",
    activityName: "Laser Tag",
    activitySlug: "laser-tag",
    memberPercent: 55,
    sessionsCount: 6, // was 2×3
    generateScores: generateLaserTagScores,
    resolveMatch: resolveLaserTagMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Elite", color: "#F97316", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Laser Tag Battle", location: "Fun Zone Amman", price: "15.00" },
      { title: "Team Laser Tag Night", location: "Action Park", price: "12.00" },
    ],
  },
  {
    domainId: "basketball",
    activityName: "Basketball",
    activitySlug: "basketball",
    memberPercent: 50,
    sessionsCount: 9, // was 3×3
    generateScores: generateBasketballScores,
    resolveMatch: resolveBasketballMatch,
    levels: [
      { name: "Beginner", color: "#6B7280", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Competitive", color: "#F59E0B", order: 3 },
    ],
    sessionTemplates: [
      { title: "Basketball Pickup", location: "Sports Arena JO", price: "5.00" },
      { title: "3v3 Basketball", location: "Community Center Court", price: null },
      { title: "Weekend Hoops", location: "JU Gym", price: "7.00" },
    ],
  },
  {
    domainId: "hockey",
    activityName: "Hockey",
    activitySlug: "hockey",
    memberPercent: 35,
    sessionsCount: 6, // was 2×3
    generateScores: generateHockeyScores,
    resolveMatch: resolveHockeyMatch,
    levels: [
      { name: "Beginner", color: "#6B7280", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Competitive", color: "#F59E0B", order: 3 },
    ],
    sessionTemplates: [
      { title: "Hockey Night", location: "Ice Rink Amman", price: "15.00" },
      { title: "Pickup Hockey", location: "Sports Complex", price: "10.00" },
    ],
  },
  {
    domainId: "flag-football",
    activityName: "Flag Football",
    activitySlug: "flag-football",
    memberPercent: 40,
    sessionsCount: 6, // was 2×3
    generateScores: generateFlagFootballScores,
    resolveMatch: resolveFlagFootballMatch,
    levels: [
      { name: "Recreational", color: "#6B7280", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Competitive", color: "#10B981", order: 2 },
    ],
    sessionTemplates: [
      { title: "Flag Football Sunday", location: "Abdoun Park", price: null },
      { title: "Flag Football League", location: "Sports Arena JO", price: "8.00" },
    ],
  },
  {
    domainId: "kickball",
    activityName: "Kickball",
    activitySlug: "kickball",
    memberPercent: 35,
    sessionsCount: 4, // was 2×2
    generateScores: generateKickballScores,
    resolveMatch: resolveKickballMatch,
    levels: [
      { name: "Recreational", color: "#6B7280", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Competitive", color: "#10B981", order: 2 },
    ],
    sessionTemplates: [
      { title: "Kickball Night", location: "Community Field", price: null },
      { title: "Kickball Tournament", location: "Sports Arena JO", price: "5.00" },
    ],
  },
  {
    domainId: "dodgeball",
    activityName: "Dodgeball",
    activitySlug: "dodgeball",
    memberPercent: 45,
    sessionsCount: 6, // was 2×3
    generateScores: generateDodgeballScores,
    resolveMatch: resolveDodgeballMatch,
    levels: [
      { name: "Recreational", color: "#6B7280", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Competitive", color: "#10B981", order: 2 },
    ],
    sessionTemplates: [
      { title: "Dodgeball Night", location: "JU Gym", price: "5.00" },
      { title: "Dodgeball Rumble", location: "Sports Arena JO", price: "7.00" },
    ],
  },
  {
    domainId: "foosball",
    activityName: "Foosball",
    activitySlug: "foosball",
    memberPercent: 40,
    sessionsCount: 15, // was 3×5
    generateScores: generateFoosballScores,
    resolveMatch: resolveFoosballMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "D", color: "#6B7280", order: 1 },
      { name: "C", color: "#3B82F6", order: 2 },
      { name: "B", color: "#10B981", order: 3 },
      { name: "A", color: "#F59E0B", order: 4 },
      { name: "AA", color: "#EF4444", order: 5 },
    ],
    sessionTemplates: [
      { title: "Foosball Night", location: "Community Center", price: null },
      { title: "Foosball Tournament", location: "Game Room", price: "3.00" },
      { title: "Lunchtime Foosball", location: "Office Lounge", price: null },
    ],
  },
  {
    domainId: "bowling",
    activityName: "Bowling",
    activitySlug: "bowling",
    memberPercent: 45,
    sessionsCount: 12, // was 3×4
    generateScores: generateBowlingScores,
    resolveMatch: resolveBowlingMatch,
    levels: [
      { name: "Beginner", color: "#6B7280", order: 0 },
      { name: "Recreational", color: "#3B82F6", order: 1 },
      { name: "League", color: "#10B981", order: 2 },
      { name: "Advanced", color: "#F59E0B", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Bowling Night", location: "Strike Lanes", price: "8.00" },
      { title: "League Bowling", location: "Strike Lanes", price: "10.00" },
      { title: "Weekend Bowl", location: "Fun Zone Amman", price: "7.00" },
    ],
  },
  {
    domainId: "pool",
    activityName: "Pool / Billiards",
    activitySlug: "pool",
    memberPercent: 40,
    sessionsCount: 12, // was 3×4
    generateScores: generatePoolScores,
    resolveMatch: resolvePoolMatch,
    levels: [
      { name: "D", color: "#9CA3AF", order: 0 },
      { name: "C", color: "#6B7280", order: 1 },
      { name: "B", color: "#3B82F6", order: 2 },
      { name: "A", color: "#10B981", order: 3 },
      { name: "AA", color: "#F59E0B", order: 4 },
      { name: "AAA", color: "#EF4444", order: 5 },
    ],
    sessionTemplates: [
      { title: "Pool Night", location: "Billiards Club Amman", price: "5.00" },
      { title: "8-Ball Tournament", location: "Billiards Club Amman", price: "10.00" },
      { title: "Casual Pool", location: "Community Center", price: null },
    ],
  },
  {
    domainId: "darts",
    activityName: "Darts",
    activitySlug: "darts",
    memberPercent: 35,
    sessionsCount: 10, // was 2×5
    generateScores: generateDartsScores,
    resolveMatch: resolveDartsMatch,
    levels: [
      { name: "D", color: "#6B7280", order: 0 },
      { name: "C", color: "#3B82F6", order: 1 },
      { name: "B", color: "#10B981", order: 2 },
      { name: "A", color: "#F59E0B", order: 3 },
    ],
    sessionTemplates: [
      { title: "Darts Night", location: "Pub & Games Amman", price: null },
      { title: "Darts League", location: "Pub & Games Amman", price: "5.00" },
    ],
  },
  {
    domainId: "pkl-ball",
    activityName: "Pkl-Ball",
    activitySlug: "pkl-ball",
    memberPercent: 35,
    sessionsCount: 12, // was 3×4
    generateScores: generatePklBallScores,
    resolveMatch: resolvePklBallMatch,
    levels: [
      { name: "2.0", color: "#9CA3AF", order: 0 },
      { name: "2.5", color: "#6B7280", order: 1 },
      { name: "3.0", color: "#60A5FA", order: 2 },
      { name: "3.5", color: "#3B82F6", order: 3 },
      { name: "4.0", color: "#10B981", order: 4 },
      { name: "4.5", color: "#F59E0B", order: 5 },
      { name: "5.0", color: "#EF4444", order: 6 },
    ],
    sessionTemplates: [
      { title: "Pkl-Ball Doubles", location: "Community Courts", price: "5.00" },
      { title: "Open Pkl-Ball", location: "Sports Arena JO", price: null },
      { title: "Pkl-Ball Tournament", location: "Community Courts", price: "10.00" },
    ],
  },
  {
    domainId: "squash",
    activityName: "Squash",
    activitySlug: "squash",
    memberPercent: 30,
    sessionsCount: 8, // was 2×4
    generateScores: generateSquashScores,
    resolveMatch: resolveSquashMatch,
    levels: [
      { name: "C", color: "#6B7280", order: 0 },
      { name: "B", color: "#3B82F6", order: 1 },
      { name: "BB", color: "#10B981", order: 2 },
      { name: "A", color: "#F59E0B", order: 3 },
      { name: "AA", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Squash Singles", location: "Royal Squash Club", price: "10.00" },
      { title: "Squash Match Day", location: "Royal Squash Club", price: "10.00" },
    ],
  },
  {
    domainId: "chess",
    activityName: "Chess",
    activitySlug: "chess",
    memberPercent: 30,
    sessionsCount: 18, // was 3×6
    generateScores: generateChessScores,
    resolveMatch: resolveChessMatch,
    levels: [
      { name: "Beginner", color: "#6B7280", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Expert", color: "#F59E0B", order: 3 },
      { name: "Master", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Chess Club Night", location: "Community Center", price: null },
      { title: "Chess Tournament", location: "Cultural Center", price: "5.00" },
      { title: "Blitz Chess Session", location: "Community Center", price: null },
    ],
  },
]

// ─── Score generators ────────────────────────────────────────────────────────

function generatePadelScores(): [number, number][] {
  const validScores: [number, number][] = [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
    [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 7], [6, 7],
  ]
  const numSets = randomInt(2, 3)
  const sets: [number, number][] = []
  for (let i = 0; i < numSets; i++) {
    sets.push(pick(validScores))
  }
  return sets
}

function generateFootballScores(): { team1: number; team2: number } {
  return { team1: randomInt(0, 6), team2: randomInt(0, 6) }
}

function generateBadmintonScores(): [number, number][] {
  const numGames = randomInt(2, 3)
  const games: [number, number][] = []
  for (let i = 0; i < numGames; i++) {
    // Valid BWF scores: first to 21, win by 2, max 30-29
    const r = Math.random()
    if (r < 0.6) {
      // Clear win: 21 vs 5-19
      const loserScore = randomInt(5, 19)
      if (Math.random() < 0.5) games.push([21, loserScore])
      else games.push([loserScore, 21])
    } else if (r < 0.85) {
      // Deuce: 22-20 through 28-26
      const extra = randomInt(0, 4)
      const winner = 22 + extra
      const loser = 20 + extra
      if (Math.random() < 0.5) games.push([winner, loser])
      else games.push([loser, winner])
    } else {
      // Max score: 30-29
      if (Math.random() < 0.5) games.push([30, 29])
      else games.push([29, 30])
    }
  }
  return games
}

function generateVolleyballScores(): [number, number][] {
  const numSets = randomInt(2, 3)
  const sets: [number, number][] = []
  for (let i = 0; i < numSets; i++) {
    const isDecidingSet = i === 2
    const targetScore = isDecidingSet ? 15 : 25
    const r = Math.random()
    if (r < 0.7) {
      // Clear win
      const loserScore = randomInt(
        isDecidingSet ? 5 : 15,
        targetScore - 2
      )
      if (Math.random() < 0.5) sets.push([targetScore, loserScore])
      else sets.push([loserScore, targetScore])
    } else {
      // Deuce: win by 2
      const extra = randomInt(0, 3)
      const winner = targetScore + extra
      const loser = targetScore - 2 + extra
      if (Math.random() < 0.5) sets.push([winner, loser])
      else sets.push([loser, winner])
    }
  }
  return sets
}

function generateTennisScores(): [number, number][] {
  const validScores: [number, number][] = [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
    [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 7], [6, 7],
  ]
  const numSets = randomInt(2, 3)
  const sets: [number, number][] = []
  for (let i = 0; i < numSets; i++) {
    sets.push(pick(validScores))
  }
  return sets
}

function generatePingPongScores(): [number, number][] {
  const numGames = randomInt(3, 5)
  const games: [number, number][] = []
  for (let i = 0; i < numGames; i++) {
    const r = Math.random()
    if (r < 0.65) {
      // Clear win: 11 vs 2-9
      const loserScore = randomInt(2, 9)
      if (Math.random() < 0.5) games.push([11, loserScore])
      else games.push([loserScore, 11])
    } else if (r < 0.9) {
      // Deuce: 12-10 through 16-14
      const extra = randomInt(0, 3)
      const winner = 12 + extra
      const loser = 10 + extra
      if (Math.random() < 0.5) games.push([winner, loser])
      else games.push([loser, winner])
    } else {
      // Close deuce: 11-9
      if (Math.random() < 0.5) games.push([11, 9])
      else games.push([9, 11])
    }
  }
  return games
}

function generateLaserTagScores(): { team1: number; team2: number } {
  return {
    team1: randomInt(200, 600),
    team2: randomInt(200, 600),
  }
}

function generateBasketballScores(): { team1: number; team2: number } {
  return { team1: randomInt(30, 80), team2: randomInt(30, 80) }
}

function generateHockeyScores(): { team1: number; team2: number } {
  return { team1: randomInt(0, 8), team2: randomInt(0, 8) }
}

function generateFlagFootballScores(): { team1: number; team2: number } {
  // Scores in multiples of 6 or 7 (touchdowns + conversions)
  return { team1: randomInt(0, 6) * 7, team2: randomInt(0, 6) * 7 }
}

function generateKickballScores(): { team1: number; team2: number } {
  return { team1: randomInt(0, 12), team2: randomInt(0, 12) }
}

function generateDodgeballScores(): { team1: number; team2: number } {
  return { team1: randomInt(0, 5), team2: randomInt(0, 5) }
}

function generateFoosballScores(): { team1: number; team2: number } {
  return { team1: randomInt(0, 10), team2: randomInt(0, 10) }
}

function generateBowlingScores(): { team1: number; team2: number } {
  return { team1: randomInt(80, 280), team2: randomInt(80, 280) }
}

function generatePoolScores(): { team1: number; team2: number } {
  // Race to 5 or 7 games
  const target = pick([5, 7])
  const winner = target
  const loser = randomInt(0, target - 1)
  return Math.random() < 0.5
    ? { team1: winner, team2: loser }
    : { team1: loser, team2: winner }
}

function generateDartsScores(): { team1: number; team2: number } {
  // Race to 3 or 5 legs
  const target = pick([3, 5])
  const winner = target
  const loser = randomInt(0, target - 1)
  return Math.random() < 0.5
    ? { team1: winner, team2: loser }
    : { team1: loser, team2: winner }
}

function generatePklBallScores(): [number, number][] {
  const numGames = randomInt(2, 3)
  const games: [number, number][] = []
  for (let i = 0; i < numGames; i++) {
    const r = Math.random()
    if (r < 0.65) {
      const loserScore = randomInt(2, 9)
      if (Math.random() < 0.5) games.push([11, loserScore])
      else games.push([loserScore, 11])
    } else if (r < 0.9) {
      const extra = randomInt(0, 3)
      const winner = 12 + extra
      const loser = 10 + extra
      if (Math.random() < 0.5) games.push([winner, loser])
      else games.push([loser, winner])
    } else {
      if (Math.random() < 0.5) games.push([15, randomInt(8, 13)])
      else games.push([randomInt(8, 13), 15])
    }
  }
  return games
}

function generateSquashScores(): [number, number][] {
  const numGames = randomInt(3, 5)
  const games: [number, number][] = []
  for (let i = 0; i < numGames; i++) {
    const r = Math.random()
    if (r < 0.65) {
      const loserScore = randomInt(3, 9)
      if (Math.random() < 0.5) games.push([11, loserScore])
      else games.push([loserScore, 11])
    } else {
      const extra = randomInt(0, 3)
      const winner = 12 + extra
      const loser = 10 + extra
      if (Math.random() < 0.5) games.push([winner, loser])
      else games.push([loser, winner])
    }
  }
  return games
}

function generateChessScores(): { team1: number; team2: number } {
  const [team1, team2] = weighted<[number, number]>([
    [[1, 0], 40],
    [[0, 1], 40],
    [[0.5, 0.5], 20],
  ])
  return { team1, team2 }
}

// ─── Activity join forms (sport-specific) ────────────────────────────────────

type ActivityFormDef = {
  fields: {
    id: string
    type: string
    label: string
    required: boolean
    options?: string[]
    placeholder?: string
  }[]
}

const ACTIVITY_JOIN_FORMS: Record<string, ActivityFormDef> = {
  padel: {
    fields: [
      { id: "field_preferred_side", type: "select", label: "Preferred Side", required: true, options: ["Left", "Right", "Both"] },
      { id: "field_dominant_hand", type: "select", label: "Dominant Hand", required: true, options: ["Right", "Left"] },
      { id: "field_padel_level", type: "select", label: "Playing Level", required: true, options: ["Beginner", "Intermediate", "Advanced", "Competitive"] },
      { id: "field_weight_range", type: "select", label: "Weight Range", required: false, options: ["Under 60kg", "60-70kg", "70-80kg", "80-90kg", "Over 90kg"] },
      { id: "field_height_range", type: "select", label: "Height Range", required: false, options: ["Under 165cm", "165-175cm", "175-185cm", "Over 185cm"] },
      { id: "field_own_racket", type: "select", label: "Own Racket?", required: false, options: ["Yes", "No"] },
    ],
  },
  football: {
    fields: [
      { id: "field_position", type: "select", label: "Preferred Position", required: true, options: ["Goalkeeper", "Defender", "Midfielder", "Forward"] },
      { id: "field_preferred_foot", type: "select", label: "Preferred Foot", required: true, options: ["Right", "Left", "Both"] },
      { id: "field_football_level", type: "select", label: "Playing Level", required: true, options: ["Casual", "Regular", "Competitive", "Semi-Pro"] },
    ],
  },
  badminton: {
    fields: [
      { id: "field_format_pref", type: "select", label: "Preferred Format", required: true, options: ["Singles", "Doubles", "Mixed Doubles"] },
      { id: "field_dominant_hand", type: "select", label: "Dominant Hand", required: true, options: ["Right", "Left"] },
      { id: "field_badminton_level", type: "select", label: "Playing Level", required: true, options: ["Beginner", "Intermediate", "Advanced"] },
    ],
  },
  volleyball: {
    fields: [
      { id: "field_vb_position", type: "select", label: "Preferred Position", required: true, options: ["Setter", "Libero", "Outside Hitter", "Middle Blocker", "Opposite", "Flexible"] },
      { id: "field_vb_level", type: "select", label: "Playing Level", required: true, options: ["Recreational", "Intermediate", "Competitive"] },
      { id: "field_vb_height", type: "select", label: "Height Range", required: false, options: ["Under 170cm", "170-180cm", "180-190cm", "Over 190cm"] },
    ],
  },
  tennis: {
    fields: [
      { id: "field_ntrp", type: "select", label: "Self-Rated NTRP Level", required: true, options: ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5"] },
      { id: "field_tennis_format", type: "select", label: "Preferred Format", required: true, options: ["Singles", "Doubles", "Both"] },
      { id: "field_tennis_hand", type: "select", label: "Dominant Hand", required: true, options: ["Right", "Left"] },
    ],
  },
  "ping-pong": {
    fields: [
      { id: "field_pp_style", type: "select", label: "Playing Style", required: true, options: ["Offensive", "Defensive", "All-Round"] },
      { id: "field_pp_grip", type: "select", label: "Grip Style", required: true, options: ["Shakehand", "Penhold"] },
      { id: "field_pp_level", type: "select", label: "Playing Level", required: true, options: ["Casual", "Intermediate", "Advanced", "Competitive"] },
    ],
  },
  basketball: {
    fields: [
      { id: "field_bball_pos", type: "select", label: "Position", required: true, options: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center", "Flexible"] },
      { id: "field_bball_level", type: "select", label: "Playing Level", required: true, options: ["Casual", "Regular", "Competitive"] },
      { id: "field_bball_height", type: "select", label: "Height Range", required: false, options: ["Under 170cm", "170-180cm", "180-190cm", "Over 190cm"] },
    ],
  },
  "laser-tag": {
    fields: [
      { id: "field_lt_role", type: "select", label: "Preferred Role", required: true, options: ["Attacker", "Defender", "Support", "Any"] },
      { id: "field_lt_experience", type: "select", label: "Experience", required: true, options: ["First Time", "Played Before", "Regular"] },
    ],
  },
}

// Simpler 2-field form for remaining sports
const SIMPLE_SPORT_FORM: ActivityFormDef = {
  fields: [
    { id: "field_sport_level", type: "select", label: "Experience Level", required: true, options: ["Beginner", "Intermediate", "Advanced"] },
    { id: "field_availability", type: "select", label: "Preferred Schedule", required: false, options: ["Weekday Evenings", "Weekends", "Both"] },
  ],
}

function getActivityJoinForm(domainId: string): ActivityFormDef {
  return ACTIVITY_JOIN_FORMS[domainId] ?? SIMPLE_SPORT_FORM
}

function generateActivityFormAnswers(domainId: string): Record<string, unknown> {
  const form = getActivityJoinForm(domainId)
  const answers: Record<string, unknown> = {}
  for (const field of form.fields) {
    if (field.options) {
      if (field.id === "field_dominant_hand" || field.id === "field_tennis_hand") {
        answers[field.id] = weighted([["Right", 85], ["Left", 15]])
      } else if (field.id === "field_preferred_foot") {
        answers[field.id] = weighted([["Right", 70], ["Left", 20], ["Both", 10]])
      } else if (field.id === "field_pp_grip") {
        answers[field.id] = weighted([["Shakehand", 80], ["Penhold", 20]])
      } else if (field.id === "field_own_racket") {
        answers[field.id] = weighted([["Yes", 65], ["No", 35]])
      } else {
        answers[field.id] = pick(field.options)
      }
    }
  }

  // Also generate answers for domain ranking attribute fields (ranking_attr_*)
  const domain = getDomain(domainId)
  if (domain?.attributeFields) {
    for (const attr of domain.attributeFields) {
      answers[`ranking_attr_${attr.id}`] = pick(attr.options)
    }
  }

  return answers
}

// Session join form (used on some sessions)
const SESSION_JOIN_FORM = {
  fields: [
    { id: "field_warmup", type: "select", label: "Warm-up Preference", required: false, options: ["Yes, join warm-up", "No, skip warm-up"] },
    { id: "field_session_note", type: "textarea", label: "Notes for this session", required: false, placeholder: "Injuries, late arrival, etc." },
  ],
}

// ─── Seed functions ──────────────────────────────────────────────────────────

async function createUsers(): Promise<string[]> {
  console.log("Creating users...")

  // Owner
  const ownerResult = await auth.api.signUpEmail({
    body: {
      username: OWNER_USERNAME,
      name: "Seed Admin",
      email: OWNER_EMAIL,
      password: PASSWORD,
      phoneNumber: "+10000000000",
      onboardingCompleted: true,
    },
  })
  if (!ownerResult?.user?.id) throw new Error("Failed to create owner user")
  const ownerId = ownerResult.user.id
  console.log(`  Owner: ${OWNER_EMAIL} (${ownerId})`)

  // Members
  const memberIds: string[] = []
  for (let i = 0; i < MEMBER_DATA.length; i++) {
    const m = MEMBER_DATA[i]
    const username = m.name.toLowerCase().replace(/\s+/g, "").slice(0, 12) + i
    const email = `seed-${username}@gatherly.test`
    const phone = `+1${String(1000000001 + i)}`

    const result = await auth.api.signUpEmail({
      body: {
        username,
        name: m.name,
        email,
        password: PASSWORD,
        phoneNumber: phone,
        city: m.city,
        onboardingCompleted: true,
      },
    })
    if (!result?.user?.id) throw new Error(`Failed to create user ${email}`)
    memberIds.push(result.user.id)
  }
  console.log(`  Created ${memberIds.length} member users`)

  return [ownerId, ...memberIds]
}

async function createOrganization(ownerId: string): Promise<string> {
  console.log("Creating organization...")

  const orgId = seedId("org_community")

  await db.insert(organization).values({
    id: orgId,
    name: "Seed Community TEST",
    slug: ORG_SLUG,
    createdAt: daysAgo(120),
    metadata: null,
    timezone: "Asia/Amman",
    defaultJoinMode: "open",
    userSlug: "seed-community-test",
    ownerUsername: OWNER_USERNAME,
  })

  // Owner member record
  await db.insert(member).values({
    id: seedId("member_owner"),
    organizationId: orgId,
    userId: ownerId,
    role: "owner",
    createdAt: daysAgo(120),
  })

  // Settings with plugins enabled
  await db.insert(organizationSettings).values({
    organizationId: orgId,
    currency: "JOD",
    enabledPlugins: { analytics: true, ai: true, ranking: true, "smart-groups": true, tournaments: true },
    joinFormSchema: {
      fields: [
        {
          id: "field_gender",
          type: "select",
          label: "Gender",
          required: true,
          options: ["Male", "Female"],
        },
        {
          id: "field_nationality",
          type: "select",
          label: "Nationality",
          required: true,
          options: ["Jordanian", "Egyptian", "Lebanese", "Palestinian", "Emirati", "Saudi", "Turkish", "Syrian", "Iraqi", "Other"],
        },
        {
          id: "field_age_range",
          type: "select",
          label: "Age Range",
          required: true,
          options: ["18-25", "26-35", "36-45", "46-55"],
        },
        {
          id: "field_note",
          type: "textarea",
          label: "Anything we should know?",
          required: false,
          placeholder: "Injuries, availability, dietary restrictions, etc.",
        },
      ],
    },
    joinFormVersion: 1,
  })

  console.log(`  Org: Seed Community TEST (${orgId})`)
  return orgId
}

async function addMembers(
  orgId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Adding members to org...")

  for (let i = 0; i < memberUserIds.length; i++) {
    const userId = memberUserIds[i]
    const memberInfo = MEMBER_DATA[i]
    const joinedDaysAgo = randomInt(5, 100)

    await db.insert(member).values({
      id: seedId(`member_${i}`),
      organizationId: orgId,
      userId,
      role: i < 2 ? "admin" : "member",
      createdAt: daysAgo(joinedDaysAgo),
    })

    await db.insert(groupMemberProfile).values({
      id: seedId(`profile_${i}`),
      organizationId: orgId,
      userId,
      answers: {
        field_gender: memberInfo.gender,
        field_nationality: memberInfo.nationality,
        field_age_range: AGE_RANGES[i % AGE_RANGES.length],
        field_note: i % 4 === 0 ? "Available weekends only" : "",
      },
    })
  }

  console.log(`  Added ${memberUserIds.length} members with profiles`)
}

async function createActivitiesAndRankings(
  orgId: string,
  ownerId: string,
  memberUserIds: string[]
): Promise<{ activityIds: string[]; sessionIds: string[]; upcomingSessionIds: string[] }> {
  console.log("Creating activities with rankings...")

  const allActivityIds: string[] = []
  const allSessionIds: string[] = []
  const allUpcomingSessionIds: string[] = []

  for (let d = 0; d < DOMAIN_CONFIGS.length; d++) {
    const cfg = DOMAIN_CONFIGS[d]
    const activityId = seedId(`activity_${cfg.domainId}`)
    allActivityIds.push(activityId)

    // 1. Create activity with sport-specific join form
    const actJoinForm = getActivityJoinForm(cfg.domainId)
    await db.insert(activity).values({
      id: activityId,
      organizationId: orgId,
      name: cfg.activityName,
      slug: cfg.activitySlug,
      joinMode: "require_approval",
      isActive: true,
      enabledPlugins: { ranking: true, "smart-groups": true, tournaments: true },
      joinFormSchema: actJoinForm,
      joinFormVersion: 1,
      createdBy: ownerId,
      createdAt: daysAgo(120 - d * 5),
    })

    // 2. Assign random subset of members to this activity
    const fmtInfoForMembers = getDomainFormatInfo(cfg.domainId)
    const memberCount = Math.max(
      fmtInfoForMembers.maxCapacity + 2, // minimum: enough for 1 match + spare
      Math.floor(memberUserIds.length * cfg.memberPercent / 100)
    )
    const activityMemberIds = [ownerId, ...pickN(memberUserIds, memberCount)]
    // Deduplicate (owner always included)
    const uniqueActivityMemberIds = [...new Set(activityMemberIds)]

    const actMembers = uniqueActivityMemberIds.map((userId, i) => ({
      id: seedId(`actmember_${cfg.domainId}_${i}`),
      activityId,
      userId,
      status: "active",
      role: i === 0 ? "owner" : "member",
    }))
    await db.insert(activityMember).values(actMembers)

    console.log(`  Activity: ${cfg.activityName} — ${uniqueActivityMemberIds.length} members`)

    // 3. Create ranking definition
    const defId = seedId(`ranking_${cfg.domainId}`)
    await db.insert(rankingDefinition).values({
      id: defId,
      organizationId: orgId,
      activityId,
      name: `${cfg.activityName} Rankings`,
      domainId: cfg.domainId,
      createdBy: ownerId,
      createdAt: daysAgo(110 - d * 5),
    })

    // 3b. Inject domain attribute fields into join form (e.g. position, dominant side)
    const domain = getDomain(cfg.domainId)
    if (domain?.attributeFields && domain.attributeFields.length > 0) {
      const updatedSchema = injectRankingAttributeFields(
        actJoinForm as JoinFormSchema,
        domain.attributeFields
      )
      await db
        .update(activity)
        .set({ joinFormSchema: updatedSchema })
        .where(eq(activity.id, activityId))
    }

    // 4. Create levels (if any)
    const levelIds: string[] = []
    for (const lvl of cfg.levels) {
      const id = seedId(`level_${cfg.domainId}_${lvl.order}`)
      levelIds.push(id)
      await db.insert(rankingLevel).values({
        id,
        organizationId: orgId,
        rankingDefinitionId: defId,
        name: lvl.name,
        color: lvl.color,
        order: lvl.order,
      })
    }
    if (cfg.levels.length > 0) {
      console.log(`    ${cfg.levels.length} levels`)
    }

    // 5. Create sessions and matches
    const activitySessionIds: string[] = []
    let totalMatches = 0
    // Track cumulative stats per user for this ranking
    const userStats: Record<string, Record<string, number>> = {}

    // Derive capacity and format from domain rules
    const fmtInfo = getDomainFormatInfo(cfg.domainId)

    for (let s = 0; s < cfg.sessionsCount; s++) {
      const template = cfg.sessionTemplates[s % cfg.sessionTemplates.length]
      const sessionDaysAgo = Math.max(1, 80 - s * 14 + randomInt(-3, 3))
      const sessionId = seedId(`session_${cfg.domainId}_${s}`)
      activitySessionIds.push(sessionId)
      allSessionIds.push(sessionId)

      // Add session join form to ~40% of sessions
      const hasSessionForm = s % 3 === 0

      await db.insert(eventSession).values({
        id: sessionId,
        organizationId: orgId,
        activityId,
        title: s < cfg.sessionTemplates.length
          ? template.title
          : `${template.title} #${Math.floor(s / cfg.sessionTemplates.length) + 1}`,
        description: `${cfg.activityName} session. All levels welcome.`,
        dateTime: daysAgo(sessionDaysAgo),
        location: template.location,
        maxCapacity: fmtInfo.maxCapacity,
        maxWaitlist: pick([0, 3, 5]),
        price: template.price,
        joinMode: "open",
        status: sessionDaysAgo > 3 ? "completed" : "published",
        ...(hasSessionForm ? { joinFormSchema: SESSION_JOIN_FORM, joinFormVersion: 1 } : {}),
        createdBy: ownerId,
      })

      // Each session = 1 match (driven by domain sessionConfig.mode = "match")
      const ppt = fmtInfo.playersPerTeam
      const neededPlayers = ppt * 2
      if (uniqueActivityMemberIds.length >= neededPlayers) {
        const players = pickN(uniqueActivityMemberIds, neededPlayers)
        const team1 = players.slice(0, ppt)
        const team2 = players.slice(ppt, neededPlayers)

        const scores = cfg.generateScores()
        const result = cfg.resolveMatch(scores)

        // Build derived stats per player (team stats only — individual stats are separate)
        const derivedStats: Record<string, Record<string, number>> = {}
        for (const userId of team1) {
          derivedStats[userId] = { ...result.team1Stats }
          if (!userStats[userId]) userStats[userId] = {}
          for (const [k, v] of Object.entries(result.team1Stats)) {
            userStats[userId][k] = (userStats[userId][k] ?? 0) + v
          }
        }
        for (const userId of team2) {
          derivedStats[userId] = { ...result.team2Stats }
          if (!userStats[userId]) userStats[userId] = {}
          for (const [k, v] of Object.entries(result.team2Stats)) {
            userStats[userId][k] = (userStats[userId][k] ?? 0) + v
          }
        }

        await db.insert(matchRecord).values({
          id: seedId(`match_${cfg.domainId}_s${s}`),
          organizationId: orgId,
          rankingDefinitionId: defId,
          sessionId,
          matchFormat: fmtInfo.defaultFormat,
          team1,
          team2,
          scores,
          winner: result.winner,
          derivedStats,
          recordedBy: ownerId,
          createdAt: daysAgo(sessionDaysAgo - randomInt(0, 1)),
        })
        totalMatches++

        // Generate individual stats per player (currently football only)
        if (hasIndividualStats(cfg.domainId)) {
          const teamScore = scores as { team1: number; team2: number }

          for (const [teamPlayers, teamTotal] of [
            [team1, teamScore.team1],
            [team2, teamScore.team2],
          ] as const) {
            // Distribute team goals among individual players
            const goalDistribution = distributeAmong(teamTotal, teamPlayers.length)

            for (let p = 0; p < teamPlayers.length; p++) {
              const playerId = teamPlayers[p]
              const playerGoals = goalDistribution[p]
              const playerStats: Record<string, number> = {
                goals: playerGoals,
                assists: randomInt(0, Math.max(0, teamTotal - playerGoals)),
                yellow_cards: randomInt(0, 1) > 0.8 ? 1 : 0,
                red_cards: randomInt(0, 20) === 0 ? 1 : 0,
              }

              // Insert stat entry
              await db.insert(rankStatEntry).values({
                id: seedId(`stat_${cfg.domainId}_s${s}_p${teamPlayers === team1 ? p : ppt + p}`),
                organizationId: orgId,
                rankingDefinitionId: defId,
                userId: playerId,
                sessionId,
                stats: playerStats,
                recordedBy: ownerId,
                createdAt: daysAgo(sessionDaysAgo - randomInt(0, 1)),
              })

              // Aggregate into cumulative stats
              if (!userStats[playerId]) userStats[playerId] = {}
              for (const [k, v] of Object.entries(playerStats)) {
                userStats[playerId][k] = (userStats[playerId][k] ?? 0) + v
              }
            }
          }

          // Assign MOTM to a random player from the winning team (or random if draw)
          const domain = getDomain(cfg.domainId)
          if (domain?.sessionAwards?.some((a) => a.id === "motm")) {
            const motmCandidates = result.winner === "team1" ? team1
              : result.winner === "team2" ? team2
              : [...team1, ...team2]
            const motmUserId = pick(motmCandidates)

            // Merge motm into existing stat entry for this player
            // The stat entry was already created above, so we need to update it
            const existingId = seedId(`stat_${cfg.domainId}_s${s}_p${
              team1.indexOf(motmUserId) >= 0
                ? team1.indexOf(motmUserId)
                : ppt + team2.indexOf(motmUserId)
            }`)
            const [existing] = await db
              .select({ stats: rankStatEntry.stats })
              .from(rankStatEntry)
              .where(eq(rankStatEntry.id, existingId))
              .limit(1)
            if (existing) {
              const updatedStats = { ...(existing.stats as Record<string, number>), motm: 1 }
              await db
                .update(rankStatEntry)
                .set({ stats: updatedStats })
                .where(eq(rankStatEntry.id, existingId))
            }

            if (!userStats[motmUserId]) userStats[motmUserId] = {}
            userStats[motmUserId].motm = (userStats[motmUserId].motm ?? 0) + 1
          }
        }
      }
    }

    // 5b. Add upcoming sessions for Smart Groups/session flow testing
    for (let u = 0; u < UPCOMING_SESSIONS_PER_ACTIVITY; u++) {
      const template = cfg.sessionTemplates[(cfg.sessionsCount + u) % cfg.sessionTemplates.length]
      const sessionId = seedId(`session_upcoming_${cfg.domainId}_${u}`)
      const daysAhead = 2 + u * 3 + randomInt(0, 2)
      const hasSessionForm = u % 2 === 0

      activitySessionIds.push(sessionId)
      allSessionIds.push(sessionId)
      allUpcomingSessionIds.push(sessionId)

      await db.insert(eventSession).values({
        id: sessionId,
        organizationId: orgId,
        activityId,
        title: `Upcoming: ${template.title}`,
        description: `${cfg.activityName} upcoming session for planning and group generation.`,
        dateTime: daysFromNow(daysAhead),
        location: template.location,
        maxCapacity: fmtInfo.maxCapacity,
        maxWaitlist: pick([3, 5, 8]),
        price: template.price,
        joinMode: "open",
        status: "published",
        ...(hasSessionForm ? { joinFormSchema: SESSION_JOIN_FORM, joinFormVersion: 1 } : {}),
        createdBy: ownerId,
      })
    }

    console.log(
      `    ${cfg.sessionsCount} historical sessions, ${UPCOMING_SESSIONS_PER_ACTIVITY} upcoming sessions, ${totalMatches} matches`
    )

    // 6. Create member ranks from accumulated stats
    const rankedUserIds = Object.keys(userStats)
    // Sort by wins descending for level assignment
    rankedUserIds.sort(
      (a, b) => (userStats[b].wins ?? 0) - (userStats[a].wins ?? 0)
    )

    for (let i = 0; i < rankedUserIds.length; i++) {
      const userId = rankedUserIds[i]

      // Assign level based on position in ranking (top players get highest levels)
      let currentLevelId: string | null = null
      if (levelIds.length > 0) {
        // i=0 is best player → highest level index, last player → lowest level index
        const levelIdx = Math.min(
          levelIds.length - 1,
          Math.floor((rankedUserIds.length - 1 - i) / rankedUserIds.length * levelIds.length)
        )
        currentLevelId = levelIds[levelIdx]
      }

      await db.insert(memberRank).values({
        id: seedId(`mrank_${cfg.domainId}_${i}`),
        organizationId: orgId,
        rankingDefinitionId: defId,
        userId,
        currentLevelId,
        stats: userStats[userId],
        lastActivityAt: daysAgo(randomInt(1, 30)),
      })
    }

    console.log(`    ${rankedUserIds.length} member ranks`)
  }

  return {
    activityIds: allActivityIds,
    sessionIds: allSessionIds,
    upcomingSessionIds: allUpcomingSessionIds,
  }
}

async function createParticipations(
  sessionIds: string[]
): Promise<void> {
  console.log("Creating participations...")

  let total = 0

  for (const sessionId of sessionIds) {
    // Fetch session to know capacity, price, and form
    const [sess] = await db
      .select({
        maxCapacity: eventSession.maxCapacity,
        price: eventSession.price,
        status: eventSession.status,
        dateTime: eventSession.dateTime,
        activityId: eventSession.activityId,
        joinFormSchema: eventSession.joinFormSchema,
      })
      .from(eventSession)
      .where(eq(eventSession.id, sessionId))

    if (!sess) continue
    const now = new Date()
    const isFutureSession = sess.dateTime.getTime() > now.getTime()

    // Get match players for this session (they MUST have participation records)
    const matchRows = await db
      .select({ team1: matchRecord.team1, team2: matchRecord.team2 })
      .from(matchRecord)
      .where(eq(matchRecord.sessionId, sessionId))
    const matchPlayerIds = new Set<string>()
    for (const row of matchRows) {
      for (const id of (row.team1 as string[])) matchPlayerIds.add(id)
      for (const id of (row.team2 as string[])) matchPlayerIds.add(id)
    }

    // Get activity members for this session's activity
    const actMembers = await db
      .select({ userId: activityMember.userId })
      .from(activityMember)
      .where(eq(activityMember.activityId, sess.activityId))
    const actMemberIds = actMembers.map((r) => r.userId)

    // Ensure match players are always first in the joiners list
    const nonMatchMembers = actMemberIds.filter((id) => !matchPlayerIds.has(id))
    const shuffledNonMatch = [...nonMatchMembers].sort(() => Math.random() - 0.5)

    // Join count: at least match players + some extras (up to capacity + a few waitlist)
    const maxExtraCount = Math.min(
      shuffledNonMatch.length,
      Math.max(0, sess.maxCapacity + 3 - matchPlayerIds.size)
    )
    const minExtraCount = isFutureSession && matchPlayerIds.size === 0
      ? Math.min(maxExtraCount, Math.max(2, Math.min(sess.maxCapacity, 12)))
      : 0
    const extraCount = randomInt(minExtraCount, maxExtraCount)
    const joiners = [...Array.from(matchPlayerIds), ...shuffledNonMatch.slice(0, extraCount)]

    for (let j = 0; j < joiners.length; j++) {
      const userId = joiners[j]
      const isOverCapacity = j >= sess.maxCapacity
      const isCompleted = sess.status === "completed"

      const isMatchPlayer = matchPlayerIds.has(userId)
      const status: "joined" | "waitlisted" | "cancelled" = isMatchPlayer
        ? "joined" // match players are always joined
        : isOverCapacity
          ? "waitlisted"
          : isFutureSession
            ? weighted([
                ["joined", 95],
                ["cancelled", 5],
              ])
            : weighted([
                ["joined", 85],
                ["cancelled", 15],
              ])

      let attendance: "pending" | "show" | "no_show" = "pending"
      if (isCompleted && status === "joined") {
        attendance = isMatchPlayer
          ? "show" // match players always showed up
          : weighted([
              ["show", 75],
              ["no_show", 18],
              ["pending", 7],
            ])
      }

      let payment: "paid" | "unpaid" = "unpaid"
      if (sess.price && status === "joined") {
        payment = weighted([
          ["paid", 80],
          ["unpaid", 20],
        ])
      }

      // Generate session form answers if the session has a join form
      const sessionFormAnswers = sess.joinFormSchema ? {
        field_warmup: pick(["Yes, join warm-up", "No, skip warm-up"]),
        field_session_note: j % 5 === 0 ? "Might arrive 10 min late" : "",
      } : undefined

      const joinedAtCandidate = new Date(
        sess.dateTime.getTime() - randomInt(1, 72) * 60 * 60 * 1000
      )
      const joinedAt = joinedAtCandidate.getTime() > now.getTime()
        ? new Date(now.getTime() - randomInt(5, 120) * 60 * 1000)
        : joinedAtCandidate

      await db.insert(participation).values({
        id: seedId(`part_${sessionId.replace(SEED_PREFIX, "")}_${j}`),
        sessionId,
        userId,
        status,
        attendance,
        payment,
        formAnswers: sessionFormAnswers ?? null,
        joinedAt,
        cancelledAt: status === "cancelled" ? daysAgo(randomInt(1, 5)) : null,
      })
      total++
    }
  }

  console.log(`  Created ${total} participations`)
}

async function createActivityJoinRequests(
  orgId: string,
  ownerId: string
): Promise<void> {
  console.log("Creating activity join requests with form answers...")

  // Get all activities for this org
  const activities = await db
    .select({ id: activity.id, slug: activity.slug })
    .from(activity)
    .where(eq(activity.organizationId, orgId))

  let total = 0

  for (const act of activities) {
    // Get all members of this activity (except owner)
    const members = await db
      .select({ userId: activityMember.userId })
      .from(activityMember)
      .where(eq(activityMember.activityId, act.id))

    // Derive domainId from slug
    const domainId = act.slug

    for (let i = 0; i < members.length; i++) {
      const userId = members[i].userId
      if (userId === ownerId) continue // owner doesn't need a join request

      const answers = generateActivityFormAnswers(domainId)

      await db.insert(activityJoinRequest).values({
        id: seedId(`actjoinreq_${domainId}_${i}`),
        activityId: act.id,
        userId,
        status: "approved",
        formAnswers: answers,
        reviewedBy: ownerId,
        reviewedAt: daysAgo(randomInt(5, 90)),
        createdAt: daysAgo(randomInt(10, 100)),
      })
      total++
    }
  }

  console.log(`  Created ${total} activity join requests`)
}

async function createSmartGroupConfigs(
  orgId: string,
  ownerId: string
): Promise<void> {
  console.log("Creating smart group configs...")

  // Get all activities with smart-groups enabled
  const activities = await db
    .select({
      id: activity.id,
      name: activity.name,
      slug: activity.slug,
      enabledPlugins: activity.enabledPlugins,
    })
    .from(activity)
    .where(eq(activity.organizationId, orgId))

  let count = 0

  for (const act of activities) {
    const plugins = act.enabledPlugins as Record<string, boolean> | null
    if (!plugins?.["smart-groups"]) continue

    await db.insert(smartGroupConfig).values({
      id: seedId(`sgconfig_${act.slug}`),
      organizationId: orgId,
      activityId: act.id,
      name: `${act.name} Groups`,
      defaultCriteria: null,
      createdBy: ownerId,
    })
    count++
  }

  console.log(`  Created ${count} smart group configs`)
}

async function createMemberNotes(
  orgId: string,
  ownerId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Creating member notes...")

  const noteTexts = [
    "Great team player, very consistent attendance.",
    "New member — seems enthusiastic, keep an eye on progress.",
    "Tends to arrive late, mentioned traffic issues.",
    "Strong player. Consider for competitive matches.",
    "Missed last 3 sessions without notice.",
    "Brought 2 new members to the group last month.",
    "Requested to help organize weekend tournaments.",
    "Recovering from injury, taking it easy.",
  ]

  let count = 0
  for (let i = 0; i < Math.min(8, memberUserIds.length); i++) {
    await db.insert(memberNote).values({
      id: seedId(`note_${i}`),
      organizationId: orgId,
      targetUserId: memberUserIds[i],
      authorUserId: ownerId,
      content: noteTexts[i],
      createdAt: daysAgo(randomInt(1, 30)),
    })
    count++
  }

  console.log(`  Created ${count} member notes`)
}

async function createJoinRequests(
  orgId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Creating join requests...")

  const statuses: ("pending" | "approved" | "rejected")[] = [
    "pending",
    "pending",
    "rejected",
    "approved",
    "approved",
  ]

  let count = 0
  for (let i = 0; i < statuses.length && i < memberUserIds.length; i++) {
    const targetIdx = memberUserIds.length - 1 - i
    await db.insert(joinRequest).values({
      id: seedId(`joinreq_${i}`),
      organizationId: orgId,
      userId: memberUserIds[targetIdx],
      status: statuses[i],
      message: pick([
        "Hey! I'd love to join your community.",
        "Friend recommended this group. Can I join?",
        "Looking for a sports community in Amman.",
        null,
      ]),
      formAnswers: {
        field_gender: pick(["Male", "Female"]),
        field_nationality: pick(["Jordanian", "Egyptian", "Lebanese"]),
        field_age_range: pick(AGE_RANGES),
      },
      reviewedAt: statuses[i] !== "pending" ? daysAgo(randomInt(1, 10)) : null,
      createdAt: daysAgo(randomInt(5, 30)),
    })
    count++
  }

  console.log(`  Created ${count} join requests`)
}

async function createInviteLinks(
  orgId: string,
  ownerId: string
): Promise<void> {
  console.log("Creating invite links...")

  await db.insert(inviteLink).values([
    {
      id: seedId("invite_active"),
      token: createId(),
      organizationId: orgId,
      createdBy: ownerId,
      role: "member",
      maxUses: 50,
      usedCount: 12,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: seedId("invite_expired"),
      token: createId(),
      organizationId: orgId,
      createdBy: ownerId,
      role: "member",
      maxUses: 10,
      usedCount: 10,
      isActive: false,
      expiresAt: daysAgo(5),
    },
  ])

  console.log(`  Created 2 invite links`)
}

// ─── Tournament seed ────────────────────────────────────────────────────────

type TournamentSeedConfig = {
  activitySlug: string
  name: string
  slug: string
  format: TournamentFormat
  targetStatus: "draft" | "registration" | "in_progress" | "completed"
  visibility: "public" | "activity_members"
  participantCount: number
  participantType?: "individual" | "team"
  teamSize?: number // players per team (for team tournaments)
  teamNames?: string[] // team names (for team tournaments)
  config?: TournamentConfig
  matchesToComplete?: number | "all"
}

const TOURNAMENT_CONFIGS: TournamentSeedConfig[] = [
  {
    activitySlug: "padel",
    name: "Padel Spring Cup",
    slug: "padel-spring-cup",
    format: "single_elimination",
    targetStatus: "in_progress",
    visibility: "public",
    participantCount: 8,
    config: { thirdPlaceMatch: true },
    matchesToComplete: 4,
  },
  {
    activitySlug: "football",
    name: "Football Group Knockout",
    slug: "football-group-knockout",
    format: "group_knockout",
    targetStatus: "completed",
    visibility: "public",
    participantType: "team",
    participantCount: 8,
    teamSize: 5,
    teamNames: [
      "Lions", "Eagles", "Falcons", "Panthers",
      "Wolves", "Titans", "Vipers", "Thunder",
    ],
    config: {
      groupCount: 2,
      minTeamSize: 5,
      maxTeamSize: 5,
      points: { win: 3, draw: 1, loss: 0, bye: 3 },
    },
    matchesToComplete: "all",
  },
  {
    activitySlug: "chess",
    name: "Chess Swiss Open",
    slug: "chess-swiss-open",
    format: "swiss",
    targetStatus: "in_progress",
    visibility: "public",
    participantCount: 8,
    config: { swissRounds: 4, points: { win: 3, draw: 1, loss: 0, bye: 3 } },
    matchesToComplete: 4,
  },
  {
    activitySlug: "ping-pong",
    name: "Ping Pong Championship",
    slug: "ping-pong-championship",
    format: "single_elimination",
    targetStatus: "completed",
    visibility: "public",
    participantCount: 8,
    matchesToComplete: "all",
  },
  {
    activitySlug: "tennis",
    name: "Tennis Open",
    slug: "tennis-open",
    format: "single_elimination",
    targetStatus: "registration",
    visibility: "public",
    participantCount: 6,
    config: { maxCapacity: 16 },
  },
  {
    activitySlug: "badminton",
    name: "Badminton Summer Challenge",
    slug: "badminton-summer-challenge",
    format: "single_elimination",
    targetStatus: "draft",
    visibility: "activity_members",
    participantCount: 0,
  },
  {
    activitySlug: "pool",
    name: "Pool 8-Ball Cup",
    slug: "pool-8ball-cup",
    format: "single_elimination",
    targetStatus: "in_progress",
    visibility: "activity_members",
    participantCount: 4,
    matchesToComplete: 2,
  },
]

async function completeTournamentMatches(
  tournamentId: string,
  orgId: string,
  count: number | "all"
): Promise<number> {
  let completed = 0
  const maxIterations = 20

  for (let iter = 0; iter < maxIterations; iter++) {
    if (count !== "all" && completed >= count) break

    const matches = await db
      .select({
        id: tournamentMatch.id,
        status: tournamentMatch.status,
        matchNumber: tournamentMatch.matchNumber,
        version: tournamentMatch.version,
      })
      .from(tournamentMatch)
      .where(
        and(
          eq(tournamentMatch.tournamentId, tournamentId),
          eq(tournamentMatch.status, "pending")
        )
      )
      .orderBy(tournamentMatch.matchNumber)

    if (matches.length === 0) break

    let completedThisRound = 0

    for (const match of matches) {
      if (count !== "all" && completed >= count) break

      const entries = await db
        .select({ entryId: tournamentMatchEntry.entryId })
        .from(tournamentMatchEntry)
        .where(eq(tournamentMatchEntry.matchId, match.id))

      if (entries.length < 2) continue

      const winnerEntry = pick(entries)

      // Re-read version in case it changed
      const [freshMatch] = await db
        .select({ version: tournamentMatch.version })
        .from(tournamentMatch)
        .where(eq(tournamentMatch.id, match.id))

      await completeMatch(tournamentId, orgId, match.id, freshMatch?.version ?? 1, {
        scores: { team1: randomInt(1, 5), team2: randomInt(0, 4) },
        winnerEntryId: winnerEntry.entryId,
      })

      completed++
      completedThisRound++
    }

    if (completedThisRound === 0) break
  }

  return completed
}

async function createTournaments(
  orgId: string,
  ownerId: string
): Promise<void> {
  console.log("Creating tournaments...")

  let totalTournaments = 0

  for (const cfg of TOURNAMENT_CONFIGS) {
    const activityId = seedId(`activity_${cfg.activitySlug}`)

    // 1. Create tournament
    const t = await createTournament(orgId, ownerId, {
      activityId,
      name: cfg.name,
      slug: cfg.slug,
      format: cfg.format,
      visibility: cfg.visibility,
      participantType: cfg.participantType ?? "individual",
      config: cfg.config ?? {},
      startsAt:
        cfg.targetStatus === "in_progress" || cfg.targetStatus === "completed"
          ? daysAgo(7)
          : daysFromNow(14),
    })

    // 2. Register entries
    if (cfg.participantCount > 0) {
      const actMembers = await db
        .select({ userId: activityMember.userId })
        .from(activityMember)
        .where(eq(activityMember.activityId, activityId))

      const allUserIds = actMembers.map((m) => m.userId)

      if (cfg.participantType === "team" && cfg.teamNames && cfg.teamSize) {
        // Team tournament: create teams, add members, register
        const totalPlayers = cfg.participantCount * cfg.teamSize
        const selectedUsers = pickN(allUserIds, totalPlayers)
        let userIdx = 0

        for (let i = 0; i < cfg.participantCount; i++) {
          const captainId = selectedUsers[userIdx++]
          const team = await createTeam(orgId, t.id, cfg.teamNames[i], captainId)

          for (let j = 1; j < cfg.teamSize; j++) {
            await joinTeam(t.id, orgId, team.id, selectedUsers[userIdx++])
          }

          await registerTeamEntry(t.id, orgId, team.id, { allowDraft: true })
        }
      } else {
        // Individual tournament
        const participantUserIds = pickN(allUserIds, cfg.participantCount)
        for (const userId of participantUserIds) {
          await registerEntry(t.id, orgId, userId, { allowDraft: true })
        }
      }
    }

    // 3. Handle target status
    if (cfg.targetStatus === "draft") {
      console.log(`  Tournament: ${cfg.name} (draft${cfg.participantCount > 0 ? `, ${cfg.participantCount} entries` : ""})`)
      totalTournaments++
      continue
    }

    if (cfg.targetStatus === "registration") {
      await db
        .update(tournament)
        .set({ status: "registration" })
        .where(eq(tournament.id, t.id))
      console.log(`  Tournament: ${cfg.name} (registration, ${cfg.participantCount} entries)`)
      totalTournaments++
      continue
    }

    // in_progress or completed: seed → start → complete matches
    await randomizeSeeds(t.id, orgId)
    await startTournament(t.id, orgId)

    let matchesCompleted = 0
    if (cfg.matchesToComplete) {
      // For group_knockout: complete group stage, advance, then complete knockout
      if (cfg.format === "group_knockout") {
        // Complete all group stage matches first
        matchesCompleted = await completeTournamentMatches(t.id, orgId, "all")

        // Advance group stage → generate knockout bracket
        await advanceGroupStage(t.id, orgId)

        // Complete knockout matches
        if (cfg.matchesToComplete === "all") {
          matchesCompleted += await completeTournamentMatches(t.id, orgId, "all")
        } else {
          const knockoutCount = Math.max(0, cfg.matchesToComplete - matchesCompleted)
          matchesCompleted += await completeTournamentMatches(t.id, orgId, knockoutCount)
        }
      } else {
        matchesCompleted = await completeTournamentMatches(
          t.id,
          orgId,
          cfg.matchesToComplete
        )
      }
    }

    console.log(
      `  Tournament: ${cfg.name} (${cfg.targetStatus}, ${cfg.participantCount} entries, ${matchesCompleted} matches completed)`
    )
    totalTournaments++
  }

  console.log(`  Created ${totalTournaments} tournaments`)
}

// ─── Main seed ───────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n=== Gatherly Test Data Seed ===\n")

  // Check if already seeded
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))
    .limit(1)

  if (existing.length > 0) {
    console.log("Test data already exists. Run with --clean to remove it first.\n")
    return
  }

  const [ownerId, ...memberUserIds] = await createUsers()
  const orgId = await createOrganization(ownerId)
  await addMembers(orgId, memberUserIds)
  const { sessionIds, upcomingSessionIds } = await createActivitiesAndRankings(
    orgId,
    ownerId,
    memberUserIds
  )
  await createParticipations(sessionIds)
  await createActivityJoinRequests(orgId, ownerId)
  await createSmartGroupConfigs(orgId, ownerId)
  await createMemberNotes(orgId, ownerId, memberUserIds)
  await createJoinRequests(orgId, memberUserIds)
  await createInviteLinks(orgId, ownerId)
  await createTournaments(orgId, ownerId)

  console.log("\n=== Seed complete! ===")
  console.log(`\n  Login:    ${OWNER_EMAIL} / ${PASSWORD}`)
  console.log(`  Org:      Seed Community TEST`)
  console.log(`  Members:  ${memberUserIds.length + 1}`)
  console.log(`  Sessions: ${sessionIds.length} (${upcomingSessionIds.length} upcoming)`)
  console.log(`  Activities: ${DOMAIN_CONFIGS.length} (${DOMAIN_CONFIGS.map((c) => c.activityName).join(", ")})`)
  console.log(`  Tournaments: ${TOURNAMENT_CONFIGS.length}`)
  console.log(`  URL:      /${OWNER_USERNAME}/seed-community-test\n`)
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function clean() {
  console.log("\n=== Cleaning Gatherly Test Data ===\n")

  // Find org
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))

  if (!org) {
    console.log("No test data found (org does not exist).\n")
    return
  }

  const orgId = org.id

  // Find all seed user IDs (by email pattern)
  const seedUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, "%@gatherly.test"))

  const seedUserIds = seedUsers.map((u) => u.id)

  // Delete in reverse dependency order
  console.log("Deleting participations...")
  const orgSessions = await db
    .select({ id: eventSession.id })
    .from(eventSession)
    .where(eq(eventSession.organizationId, orgId))
  const orgSessionIds = orgSessions.map((s) => s.id)

  if (orgSessionIds.length > 0) {
    await db
      .delete(participation)
      .where(inArray(participation.sessionId, orgSessionIds))
  }

  console.log("Deleting sessions...")
  await db
    .delete(eventSession)
    .where(eq(eventSession.organizationId, orgId))

  console.log("Deleting ranking data...")
  await db
    .delete(matchRecord)
    .where(eq(matchRecord.organizationId, orgId))
  await db
    .delete(rankStatEntry)
    .where(eq(rankStatEntry.organizationId, orgId))
  await db
    .delete(memberRank)
    .where(eq(memberRank.organizationId, orgId))
  await db
    .delete(rankingLevel)
    .where(eq(rankingLevel.organizationId, orgId))
  await db
    .delete(rankingDefinition)
    .where(eq(rankingDefinition.organizationId, orgId))

  console.log("Deleting smart group data...")
  await db
    .delete(smartGroupConfig)
    .where(eq(smartGroupConfig.organizationId, orgId))

  console.log("Deleting tournament data...")
  await db
    .delete(tournament)
    .where(eq(tournament.organizationId, orgId))

  console.log("Deleting activity members & join requests...")
  const orgActivities = await db
    .select({ id: activity.id })
    .from(activity)
    .where(eq(activity.organizationId, orgId))
  const orgActivityIds = orgActivities.map((a) => a.id)

  if (orgActivityIds.length > 0) {
    await db
      .delete(activityJoinRequest)
      .where(inArray(activityJoinRequest.activityId, orgActivityIds))
    await db
      .delete(activityMember)
      .where(inArray(activityMember.activityId, orgActivityIds))
  }

  console.log("Deleting activities...")
  await db
    .delete(activity)
    .where(eq(activity.organizationId, orgId))

  console.log("Deleting member notes...")
  await db
    .delete(memberNote)
    .where(eq(memberNote.organizationId, orgId))

  console.log("Deleting join requests...")
  await db
    .delete(joinRequest)
    .where(eq(joinRequest.organizationId, orgId))

  console.log("Deleting profiles...")
  await db
    .delete(groupMemberProfile)
    .where(eq(groupMemberProfile.organizationId, orgId))

  console.log("Deleting invite links...")
  await db
    .delete(inviteLink)
    .where(eq(inviteLink.organizationId, orgId))

  console.log("Deleting members...")
  await db
    .delete(member)
    .where(eq(member.organizationId, orgId))

  console.log("Deleting org settings...")
  await db
    .delete(organizationSettings)
    .where(eq(organizationSettings.organizationId, orgId))

  console.log("Deleting organization...")
  await db
    .delete(organization)
    .where(eq(organization.id, orgId))

  // Delete seed users and their auth records
  if (seedUserIds.length > 0) {
    console.log(`Deleting ${seedUserIds.length} seed users...`)

    // Auth sessions
    const { session: authSession } = await import("../src/db/auth-schema")
    await db
      .delete(authSession)
      .where(inArray(authSession.userId, seedUserIds))

    // Auth accounts
    const { account } = await import("../src/db/auth-schema")
    await db
      .delete(account)
      .where(inArray(account.userId, seedUserIds))

    // Users
    await db
      .delete(user)
      .where(inArray(user.id, seedUserIds))
  }

  console.log("\n=== Cleanup complete! All test data removed. ===\n")
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const isClean = process.argv.includes("--clean")

const run = isClean ? clean : seed

run()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n${isClean ? "Cleanup" : "Seed"} failed: ${msg}\n`)
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  })
