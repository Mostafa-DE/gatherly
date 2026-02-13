import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, orgProcedure } from "@/trpc"
import {
  getGroupHealthStats,
  getSessionPerformanceStats,
  getAttendancePatternStats,
  getRevenueStats,
  getAnalyticsSummary,
} from "./queries"

const timeRangeInput = z.object({
  days: z.enum(["7", "30", "90"]).default("30"),
  activityId: z.string().optional(),
})

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Analytics is available to admins only",
    })
  }
}

export const analyticsRouter = router({
  summary: orgProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getAnalyticsSummary(ctx.activeOrganization.id, Number(input.days), input.activityId)
    }),

  groupHealth: orgProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getGroupHealthStats(ctx.activeOrganization.id, Number(input.days), input.activityId)
    }),

  sessionPerformance: orgProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getSessionPerformanceStats(ctx.activeOrganization.id, Number(input.days), input.activityId)
    }),

  attendancePatterns: orgProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getAttendancePatternStats(ctx.activeOrganization.id, Number(input.days), input.activityId)
    }),

  revenue: orgProcedure
    .input(timeRangeInput)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getRevenueStats(ctx.activeOrganization.id, Number(input.days), input.activityId)
    }),
})
