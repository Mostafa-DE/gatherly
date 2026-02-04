import { describe, expect, it, vi } from "vitest"
import {
  cancelOrganizationInvitation,
  inviteMemberToOrganization,
} from "@/use-cases/organization-invitations"

describe("organization-invitations use-case", () => {
  it("rejects invite when user is already a member", async () => {
    await expect(
      inviteMemberToOrganization(
        {
          getUserByEmail: async () => ({ id: "usr_1" }),
          getOrganizationMemberByUserId: async () => ({ id: "mem_1" }),
          getPendingInvitationByEmail: async () => null,
          createInvitation: async () => undefined,
        },
        {
          organizationId: "org_1",
          email: "test@example.com",
          role: "member",
        }
      )
    ).rejects.toMatchObject({ message: "This user is already a member of the organization" })
  })

  it("rejects invite when there is already a pending invitation", async () => {
    await expect(
      inviteMemberToOrganization(
        {
          getUserByEmail: async () => null,
          getOrganizationMemberByUserId: async () => null,
          getPendingInvitationByEmail: async () => ({ id: "inv_1" }),
          createInvitation: async () => undefined,
        },
        {
          organizationId: "org_1",
          email: "test@example.com",
          role: "admin",
        }
      )
    ).rejects.toMatchObject({ message: "An invitation has already been sent to this email" })
  })

  it("creates invitation when no conflicts exist", async () => {
    const createInvitation = vi.fn(async () => undefined)

    const result = await inviteMemberToOrganization(
      {
        getUserByEmail: async () => null,
        getOrganizationMemberByUserId: async () => null,
        getPendingInvitationByEmail: async () => null,
        createInvitation,
      },
      {
        organizationId: "org_1",
        email: "test@example.com",
        role: "member",
      }
    )

    expect(createInvitation).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ success: true })
  })

  it("rejects cancel when invitation does not exist", async () => {
    await expect(
      cancelOrganizationInvitation(
        {
          getInvitationById: async () => null,
          cancelInvitation: async () => undefined,
        },
        {
          organizationId: "org_1",
          invitationId: "inv_1",
        }
      )
    ).rejects.toMatchObject({ message: "Invitation not found" })
  })

  it("rejects cancel when invitation belongs to another organization", async () => {
    await expect(
      cancelOrganizationInvitation(
        {
          getInvitationById: async () => ({
            organizationId: "org_2",
            status: "pending",
          }),
          cancelInvitation: async () => undefined,
        },
        {
          organizationId: "org_1",
          invitationId: "inv_1",
        }
      )
    ).rejects.toMatchObject({ message: "Invitation does not belong to this organization" })
  })

  it("cancels invitation when checks pass", async () => {
    const cancelInvitation = vi.fn(async () => undefined)

    const result = await cancelOrganizationInvitation(
      {
        getInvitationById: async () => ({
          organizationId: "org_1",
          status: "pending",
        }),
        cancelInvitation,
      },
      {
        organizationId: "org_1",
        invitationId: "inv_1",
      }
    )

    expect(cancelInvitation).toHaveBeenCalledWith("inv_1")
    expect(result).toEqual({ success: true })
  })
})
