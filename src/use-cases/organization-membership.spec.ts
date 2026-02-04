import { describe, expect, it, vi } from "vitest"
import {
  joinOrganization,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  updateOrganizationSettings,
} from "@/use-cases/organization-membership"

describe("organization-membership use-case", () => {
  describe("joinOrganization", () => {
    it("rejects when organization is not found", async () => {
      await expect(
        joinOrganization(
          {
            getOrganizationById: async () => null,
            getOrganizationMemberByUserId: async () => null,
            addMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            userId: "usr_1",
          }
        )
      ).rejects.toMatchObject({ message: "Organization not found" })
    })

    it("rejects when organization requires approval", async () => {
      await expect(
        joinOrganization(
          {
            getOrganizationById: async () => ({
              id: "org_1",
              defaultJoinMode: "approval",
            }),
            getOrganizationMemberByUserId: async () => null,
            addMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            userId: "usr_1",
          }
        )
      ).rejects.toMatchObject({
        message: "This organization requires approval to join. Please submit a join request.",
      })
    })

    it("rejects when organization is invite-only", async () => {
      await expect(
        joinOrganization(
          {
            getOrganizationById: async () => ({
              id: "org_1",
              defaultJoinMode: "invite",
            }),
            getOrganizationMemberByUserId: async () => null,
            addMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            userId: "usr_1",
          }
        )
      ).rejects.toMatchObject({
        message: "This organization is invite-only. You need an invitation to join.",
      })
    })

    it("rejects when user is already a member", async () => {
      await expect(
        joinOrganization(
          {
            getOrganizationById: async () => ({
              id: "org_1",
              defaultJoinMode: "open",
            }),
            getOrganizationMemberByUserId: async () => ({ id: "mem_1" }),
            addMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            userId: "usr_1",
          }
        )
      ).rejects.toMatchObject({ message: "You are already a member of this organization" })
    })

    it("adds member when checks pass", async () => {
      const addMember = vi.fn(async () => undefined)

      const result = await joinOrganization(
        {
          getOrganizationById: async () => ({
            id: "org_1",
            defaultJoinMode: "open",
          }),
          getOrganizationMemberByUserId: async () => null,
          addMember,
        },
        {
          organizationId: "org_1",
          userId: "usr_1",
        }
      )

      expect(addMember).toHaveBeenCalledWith({
        organizationId: "org_1",
        userId: "usr_1",
        role: "member",
      })
      expect(result).toEqual({ success: true })
    })
  })

  describe("removeOrganizationMember", () => {
    it("rejects when member is not found", async () => {
      await expect(
        removeOrganizationMember(
          {
            getMemberById: async () => null,
            removeMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            actorUserId: "usr_actor",
          }
        )
      ).rejects.toMatchObject({ message: "Member not found" })
    })

    it("rejects when member belongs to another org", async () => {
      await expect(
        removeOrganizationMember(
          {
            getMemberById: async () => ({
              id: "mem_1",
              organizationId: "org_2",
              userId: "usr_target",
              role: "member",
            }),
            removeMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            actorUserId: "usr_actor",
          }
        )
      ).rejects.toMatchObject({ message: "Member does not belong to this organization" })
    })

    it("rejects removing owner", async () => {
      await expect(
        removeOrganizationMember(
          {
            getMemberById: async () => ({
              id: "mem_1",
              organizationId: "org_1",
              userId: "usr_owner",
              role: "owner",
            }),
            removeMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            actorUserId: "usr_actor",
          }
        )
      ).rejects.toMatchObject({ message: "Cannot remove the organization owner" })
    })

    it("rejects removing yourself", async () => {
      await expect(
        removeOrganizationMember(
          {
            getMemberById: async () => ({
              id: "mem_1",
              organizationId: "org_1",
              userId: "usr_actor",
              role: "member",
            }),
            removeMember: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            actorUserId: "usr_actor",
          }
        )
      ).rejects.toMatchObject({
        message: "Cannot remove yourself. Leave the organization instead.",
      })
    })

    it("removes member when checks pass", async () => {
      const removeMember = vi.fn(async () => undefined)

      const result = await removeOrganizationMember(
        {
          getMemberById: async () => ({
            id: "mem_1",
            organizationId: "org_1",
            userId: "usr_target",
            role: "member",
          }),
          removeMember,
        },
        {
          organizationId: "org_1",
          memberId: "mem_1",
          actorUserId: "usr_actor",
        }
      )

      expect(removeMember).toHaveBeenCalledWith({
        memberIdOrEmail: "mem_1",
        organizationId: "org_1",
      })
      expect(result).toEqual({ success: true })
    })
  })

  describe("updateOrganizationMemberRole", () => {
    it("rejects when member is not found", async () => {
      await expect(
        updateOrganizationMemberRole(
          {
            getMemberById: async () => null,
            updateMemberRole: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            role: "admin",
          }
        )
      ).rejects.toMatchObject({ message: "Member not found" })
    })

    it("rejects when member belongs to another org", async () => {
      await expect(
        updateOrganizationMemberRole(
          {
            getMemberById: async () => ({
              id: "mem_1",
              organizationId: "org_2",
              role: "member",
            }),
            updateMemberRole: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            role: "admin",
          }
        )
      ).rejects.toMatchObject({ message: "Member does not belong to this organization" })
    })

    it("rejects changing owner role", async () => {
      await expect(
        updateOrganizationMemberRole(
          {
            getMemberById: async () => ({
              id: "mem_1",
              organizationId: "org_1",
              role: "owner",
            }),
            updateMemberRole: async () => undefined,
          },
          {
            organizationId: "org_1",
            memberId: "mem_1",
            role: "admin",
          }
        )
      ).rejects.toMatchObject({ message: "Cannot change the role of the organization owner" })
    })

    it("updates role when checks pass", async () => {
      const updateMemberRole = vi.fn(async () => undefined)

      const result = await updateOrganizationMemberRole(
        {
          getMemberById: async () => ({
            id: "mem_1",
            organizationId: "org_1",
            role: "member",
          }),
          updateMemberRole,
        },
        {
          organizationId: "org_1",
          memberId: "mem_1",
          role: "admin",
        }
      )

      expect(updateMemberRole).toHaveBeenCalledWith({
        memberId: "mem_1",
        role: "admin",
        organizationId: "org_1",
      })
      expect(result).toEqual({ success: true })
    })
  })

  describe("updateOrganizationSettings", () => {
    it("returns success with no-op when input has no updates", async () => {
      const updateOrganizationById = vi.fn(async () => undefined)

      const result = await updateOrganizationSettings(
        {
          updateOrganizationById,
        },
        {
          organizationId: "org_1",
        }
      )

      expect(updateOrganizationById).not.toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it("maps empty timezone to null", async () => {
      const updateOrganizationById = vi.fn(async () => undefined)

      await updateOrganizationSettings(
        {
          updateOrganizationById,
        },
        {
          organizationId: "org_1",
          timezone: "",
        }
      )

      expect(updateOrganizationById).toHaveBeenCalledWith("org_1", {
        timezone: null,
      })
    })

    it("updates timezone and join mode", async () => {
      const updateOrganizationById = vi.fn(async () => undefined)

      const result = await updateOrganizationSettings(
        {
          updateOrganizationById,
        },
        {
          organizationId: "org_1",
          timezone: "America/New_York",
          defaultJoinMode: "approval",
        }
      )

      expect(updateOrganizationById).toHaveBeenCalledWith("org_1", {
        timezone: "America/New_York",
        defaultJoinMode: "approval",
      })
      expect(result).toEqual({ success: true })
    })
  })
})
