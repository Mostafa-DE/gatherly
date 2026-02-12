import type { GroupMemberProfile } from "@/db/types"
import {
  parseJoinFormSchema,
  validateJoinFormAnswers,
} from "@/use-cases/form-validation"

type GroupMemberProfileDependencies = {
  getOrgSettings: (
    organizationId: string
  ) => Promise<{ joinFormSchema: unknown } | null>
  upsertProfile: (
    organizationId: string,
    userId: string,
    answers: Record<string, unknown>,
    nickname?: string | null
  ) => Promise<GroupMemberProfile>
}

type UpdateGroupMemberProfileInput = {
  organizationId: string
  userId: string
  answers: Record<string, unknown>
  nickname?: string | null
}

export async function validateAndUpsertGroupMemberProfile(
  deps: GroupMemberProfileDependencies,
  input: UpdateGroupMemberProfileInput
): Promise<GroupMemberProfile> {
  const orgSettings = await deps.getOrgSettings(input.organizationId)
  const joinFormSchema = parseJoinFormSchema(orgSettings?.joinFormSchema)

  if (joinFormSchema) {
    validateJoinFormAnswers(joinFormSchema, input.answers)
  }

  return deps.upsertProfile(input.organizationId, input.userId, input.answers, input.nickname)
}
