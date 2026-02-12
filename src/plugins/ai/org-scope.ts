import { withOrgScope } from "@/data-access/org-scope"
import { getJoinRequestById } from "@/data-access/join-requests"
import { getOrganizationMemberByUserId } from "@/data-access/organizations"
import { NotFoundError } from "@/exceptions"
import type { EventSession, JoinRequest, Member, Participation } from "@/db/types"

export type AIFeatureScope = {
  organizationId: string
  requireSession: (sessionId: string) => Promise<EventSession>
  requireParticipation: (participationId: string) => Promise<Participation>
  requireParticipationForSession: (
    participationId: string,
    sessionId: string
  ) => Promise<Participation>
  requireMember: (userId: string) => Promise<Member>
  requireJoinRequest: (requestId: string) => Promise<JoinRequest>
}

export async function withAIFeatureScope<T>(
  organizationId: string,
  fn: (scope: AIFeatureScope) => Promise<T>
): Promise<T> {
  return withOrgScope(organizationId, async (scope) => {
    const requireMember = async (userId: string): Promise<Member> => {
      const membership = await getOrganizationMemberByUserId(organizationId, userId)
      if (!membership) {
        throw new NotFoundError("Member not found")
      }
      return membership
    }

    const requireJoinRequest = async (requestId: string): Promise<JoinRequest> => {
      const request = await getJoinRequestById(requestId)
      if (!request || request.organizationId !== organizationId) {
        throw new NotFoundError("Join request not found")
      }
      return request
    }

    const requireParticipationForSession = async (
      participationId: string,
      sessionId: string
    ): Promise<Participation> => {
      const participation = await scope.requireParticipation(participationId)
      if (participation.sessionId !== sessionId) {
        throw new NotFoundError("Participation not found")
      }
      return participation
    }

    return fn({
      organizationId,
      requireSession: scope.requireSession,
      requireParticipation: scope.requireParticipation,
      requireParticipationForSession,
      requireMember,
      requireJoinRequest,
    })
  })
}
