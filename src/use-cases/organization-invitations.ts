import { BadRequestError, ForbiddenError, NotFoundError } from "@/exceptions"

type InviteMemberInput = {
  organizationId: string
  email: string
  role: "member" | "admin"
}

type InviteMemberDependencies = {
  getUserByEmail: (email: string) => Promise<{ id: string } | null>
  getOrganizationMemberByUserId: (
    organizationId: string,
    userId: string
  ) => Promise<{ id: string } | null>
  getPendingInvitationByEmail: (
    organizationId: string,
    email: string
  ) => Promise<{ id: string } | null>
  createInvitation: (input: InviteMemberInput) => Promise<void>
}

type CancelInvitationInput = {
  organizationId: string
  invitationId: string
}

type CancelInvitationDependencies = {
  getInvitationById: (invitationId: string) => Promise<{
    organizationId: string
    status: string
  } | null>
  cancelInvitation: (invitationId: string) => Promise<void>
}

export async function inviteMemberToOrganization(
  deps: InviteMemberDependencies,
  input: InviteMemberInput
): Promise<{ success: true }> {
  const existingUser = await deps.getUserByEmail(input.email)
  if (existingUser) {
    const existingMember = await deps.getOrganizationMemberByUserId(
      input.organizationId,
      existingUser.id
    )
    if (existingMember) {
      throw new BadRequestError("This user is already a member of the organization")
    }
  }

  const existingInvitation = await deps.getPendingInvitationByEmail(
    input.organizationId,
    input.email
  )
  if (existingInvitation) {
    throw new BadRequestError("An invitation has already been sent to this email")
  }

  await deps.createInvitation(input)

  return { success: true }
}

export async function cancelOrganizationInvitation(
  deps: CancelInvitationDependencies,
  input: CancelInvitationInput
): Promise<{ success: true }> {
  const invitation = await deps.getInvitationById(input.invitationId)
  if (!invitation) {
    throw new NotFoundError("Invitation not found")
  }

  if (invitation.organizationId !== input.organizationId) {
    throw new ForbiddenError("Invitation does not belong to this organization")
  }

  if (invitation.status !== "pending") {
    throw new BadRequestError("Only pending invitations can be cancelled")
  }

  await deps.cancelInvitation(input.invitationId)

  return { success: true }
}
