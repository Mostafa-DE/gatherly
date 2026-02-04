import { BadRequestError, ForbiddenError, NotFoundError } from "@/exceptions"

type JoinOrganizationInput = {
  organizationId: string
  userId: string
}

type JoinOrganizationDependencies = {
  getOrganizationById: (organizationId: string) => Promise<{
    id: string
    defaultJoinMode: string | null
  } | null>
  getOrganizationMemberByUserId: (
    organizationId: string,
    userId: string
  ) => Promise<{ id: string } | null>
  addMember: (input: {
    organizationId: string
    userId: string
    role: "member"
  }) => Promise<void>
}

type RemoveMemberInput = {
  organizationId: string
  memberId: string
  actorUserId: string
}

type RemoveMemberDependencies = {
  getMemberById: (memberId: string) => Promise<{
    id: string
    organizationId: string
    userId: string
    role: string
  } | null>
  removeMember: (input: {
    memberIdOrEmail: string
    organizationId: string
  }) => Promise<void>
}

type UpdateMemberRoleInput = {
  organizationId: string
  memberId: string
  role: "member" | "admin"
}

type UpdateMemberRoleDependencies = {
  getMemberById: (memberId: string) => Promise<{
    id: string
    organizationId: string
    role: string
  } | null>
  updateMemberRole: (input: {
    memberId: string
    role: "member" | "admin"
    organizationId: string
  }) => Promise<void>
}

type UpdateOrganizationSettingsInput = {
  organizationId: string
  timezone?: string
  defaultJoinMode?: "open" | "invite" | "approval"
}

type UpdateOrganizationSettingsDependencies = {
  updateOrganizationById: (
    organizationId: string,
    updates: Partial<{
      timezone: string | null
      defaultJoinMode: "open" | "invite" | "approval"
    }>
  ) => Promise<void>
}

export async function joinOrganization(
  deps: JoinOrganizationDependencies,
  input: JoinOrganizationInput
): Promise<{ success: true }> {
  const organization = await deps.getOrganizationById(input.organizationId)
  if (!organization) {
    throw new NotFoundError("Organization not found")
  }

  if (organization.defaultJoinMode !== "open") {
    if (organization.defaultJoinMode === "approval") {
      throw new BadRequestError(
        "This organization requires approval to join. Please submit a join request."
      )
    }
    if (organization.defaultJoinMode === "invite") {
      throw new BadRequestError(
        "This organization is invite-only. You need an invitation to join."
      )
    }
  }

  const existingMember = await deps.getOrganizationMemberByUserId(
    input.organizationId,
    input.userId
  )
  if (existingMember) {
    throw new BadRequestError("You are already a member of this organization")
  }

  await deps.addMember({
    organizationId: input.organizationId,
    userId: input.userId,
    role: "member",
  })

  return { success: true }
}

export async function removeOrganizationMember(
  deps: RemoveMemberDependencies,
  input: RemoveMemberInput
): Promise<{ success: true }> {
  const targetMember = await deps.getMemberById(input.memberId)
  if (!targetMember) {
    throw new NotFoundError("Member not found")
  }

  if (targetMember.organizationId !== input.organizationId) {
    throw new ForbiddenError("Member does not belong to this organization")
  }

  if (targetMember.role === "owner") {
    throw new ForbiddenError("Cannot remove the organization owner")
  }

  if (targetMember.userId === input.actorUserId) {
    throw new BadRequestError("Cannot remove yourself. Leave the organization instead.")
  }

  await deps.removeMember({
    memberIdOrEmail: targetMember.id,
    organizationId: input.organizationId,
  })

  return { success: true }
}

export async function updateOrganizationMemberRole(
  deps: UpdateMemberRoleDependencies,
  input: UpdateMemberRoleInput
): Promise<{ success: true }> {
  const targetMember = await deps.getMemberById(input.memberId)
  if (!targetMember) {
    throw new NotFoundError("Member not found")
  }

  if (targetMember.organizationId !== input.organizationId) {
    throw new ForbiddenError("Member does not belong to this organization")
  }

  if (targetMember.role === "owner") {
    throw new ForbiddenError("Cannot change the role of the organization owner")
  }

  await deps.updateMemberRole({
    memberId: input.memberId,
    role: input.role,
    organizationId: input.organizationId,
  })

  return { success: true }
}

export async function updateOrganizationSettings(
  deps: UpdateOrganizationSettingsDependencies,
  input: UpdateOrganizationSettingsInput
): Promise<{ success: true }> {
  const updates: Partial<{
    timezone: string | null
    defaultJoinMode: "open" | "invite" | "approval"
  }> = {}

  if (input.timezone !== undefined) {
    updates.timezone = input.timezone || null
  }

  if (input.defaultJoinMode !== undefined) {
    updates.defaultJoinMode = input.defaultJoinMode
  }

  if (Object.keys(updates).length === 0) {
    return { success: true }
  }

  await deps.updateOrganizationById(input.organizationId, updates)

  return { success: true }
}
