// ─────────────────────────────────────────────────────────────────────────────
// Analytics Plugin — Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type TimeRange = "7" | "30" | "90"

// ── Group Health ─────────────────────────────────────────────────────────────

export type MemberGrowthPoint = {
  date: string // ISO date string (YYYY-MM-DD)
  count: number
}

export type GroupHealthStats = {
  totalMembers: number
  newMembers: number
  activeMembers: number
  inactiveMembers: number
  retentionRate: number // 0–100
  memberGrowth: MemberGrowthPoint[]
}

// ── Session Performance ──────────────────────────────────────────────────────

export type CapacityTrendPoint = {
  date: string
  title: string
  utilization: number // 0–100
}

export type TopSession = {
  id: string
  title: string
  date: string
  fillRate: number // 0–100
  joinedCount: number
  maxCapacity: number
}

export type SessionPerformanceStats = {
  totalSessions: number
  avgCapacityUtilization: number // 0–100
  avgNoShowRate: number // 0–100
  capacityTrend: CapacityTrendPoint[]
  topSessions: TopSession[]
}

// ── Attendance Patterns ──────────────────────────────────────────────────────

export type ShowRateTrendPoint = {
  date: string // ISO date for week start
  rate: number // 0–100
}

export type PeakDay = {
  day: string // "Monday", "Tuesday", etc.
  dayIndex: number // 0=Sunday, 6=Saturday
  count: number
}

export type TopAttendee = {
  userId: string
  name: string
  image: string | null
  count: number
}

export type AttendancePatternStats = {
  overallShowRate: number // 0–100
  showRateTrend: ShowRateTrendPoint[]
  peakDays: PeakDay[]
  topAttendees: TopAttendee[]
  repeatRate: number // 0–100
}

// ── Revenue ──────────────────────────────────────────────────────────────────

export type RevenueTrendPoint = {
  date: string // ISO date for week start
  amount: number
}

export type RevenueStats = {
  totalRevenue: number
  avgRevenuePerSession: number
  collectionRate: number // 0–100
  outstandingCount: number
  outstandingAmount: number
  revenueTrend: RevenueTrendPoint[]
  currency: string | null
}

// ── Summary (overview widget) ────────────────────────────────────────────────

export type AnalyticsSummary = {
  totalMembers: number
  avgCapacityUtilization: number // 0–100
  overallShowRate: number // 0–100
  totalRevenue: number
  currency: string | null
}
