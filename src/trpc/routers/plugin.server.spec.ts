import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"
import * as aiClient from "@/plugins/ai/client"

vi.mock("@/plugins/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/plugins/ai/client")>(
    "@/plugins/ai/client"
  )

  return {
    ...actual,
    checkOllamaHealth: vi.fn(),
    generateText: vi.fn(),
    generateTextStream: vi.fn(),
  }
})

function buildCaller(user: User, activeOrganizationId: string) {
  const authSession: Session = {
    id: `sess_${randomUUID().replaceAll("-", "")}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    token: `token_${randomUUID().replaceAll("-", "")}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    userId: user.id,
    activeOrganizationId,
  }

  return appRouter.createCaller(createTRPCContext({ user, session: authSession }))
}

async function collectStream(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return chunks
}

async function collectStreamFromPromise(
  streamPromise: Promise<AsyncIterable<string>>
): Promise<string[]> {
  const stream = await streamPromise
  return collectStream(stream)
}

async function* createChunkStream(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk
  }
}

describe("plugin router", () => {
  let organizationId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("plugins-owner")
    const ownerUser = await createTestUser("Plugin Owner")
    const adminUser = await createTestUser("Plugin Admin")
    const member = await createTestUser("Plugin Member")

    organizationId = organization.id
    owner = ownerUser
    admin = adminUser
    memberUser = member

    organizationIds.push(organizationId)
    userIds.push(owner.id, admin.id, memberUser.id)

    await createTestMembership({
      organizationId,
      userId: owner.id,
      role: "owner",
    })
    await createTestMembership({
      organizationId,
      userId: admin.id,
      role: "admin",
    })
    await createTestMembership({
      organizationId,
      userId: memberUser.id,
      role: "member",
    })

    vi.mocked(aiClient.checkOllamaHealth).mockResolvedValue(true)
    vi.mocked(aiClient.generateText).mockResolvedValue("unused")
    vi.mocked(aiClient.generateTextStream).mockImplementation(() =>
      createChunkStream(["Generated", " description"])
    )
  })

  afterEach(async () => {
    vi.restoreAllMocks()

    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    organizationId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("allows owner/admin to toggle plugin and blocks members", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.organizationSettings.togglePlugin({
        pluginId: "ai",
        enabled: true,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const enabledResult = await ownerCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: true,
    })
    expect((enabledResult.enabledPlugins as Record<string, boolean>).ai).toBe(true)

    const disabledResult = await ownerCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: false,
    })
    expect((disabledResult.enabledPlugins as Record<string, boolean>).ai).toBe(false)
  })

  it("rejects toggling unknown plugins", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.organizationSettings.togglePlugin({
        pluginId: "does-not-exist",
        enabled: true,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("returns unavailable and skips health check when AI plugin is disabled", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    const result = await memberCaller.plugin.ai.checkAvailability()
    expect(result).toEqual({ available: false })
    expect(aiClient.checkOllamaHealth).not.toHaveBeenCalled()
  })

  it("returns health status when AI plugin is enabled", async () => {
    const ownerCaller = buildCaller(owner, organizationId)

    await ownerCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: true,
    })

    vi.mocked(aiClient.checkOllamaHealth).mockResolvedValueOnce(true)
    await expect(ownerCaller.plugin.ai.checkAvailability()).resolves.toEqual({
      available: true,
    })

    vi.mocked(aiClient.checkOllamaHealth).mockResolvedValueOnce(false)
    await expect(ownerCaller.plugin.ai.checkAvailability()).resolves.toEqual({
      available: false,
    })
  })

  it("streams description chunks for admins when plugin is enabled", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const ownerCaller = buildCaller(owner, organizationId)

    await ownerCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: true,
    })

    vi.mocked(aiClient.generateTextStream).mockImplementationOnce(() =>
      createChunkStream(["Warm ", "welcome ", "message"])
    )

    const streamPromise = adminCaller.plugin.ai.suggestSessionDescription({
      sessionTitle: "Tuesday Social Match",
      location: "Court 2",
    })

    const chunks = await collectStreamFromPromise(streamPromise)
    expect(chunks).toEqual(["Warm ", "welcome ", "message"])

    expect(aiClient.generateTextStream).toHaveBeenCalledTimes(1)
    const [request] = vi.mocked(aiClient.generateTextStream).mock.calls[0]
    expect(request.model).toBe("mistral:7b")
    expect(request.prompt).toContain('Session title: "Tuesday Social Match"')
    expect(request.prompt).toContain("Instructions:")
  })

  it("rejects streaming when plugin is disabled", async () => {
    const ownerCaller = buildCaller(owner, organizationId)

    const streamPromise = ownerCaller.plugin.ai.suggestSessionDescription({
      sessionTitle: "No Plugin Session",
    })

    await expect(collectStreamFromPromise(streamPromise)).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
    expect(aiClient.generateTextStream).not.toHaveBeenCalled()
  })

  it("rejects member attempts to stream AI suggestions", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const memberCaller = buildCaller(memberUser, organizationId)

    await ownerCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: true,
    })

    const streamPromise = memberCaller.plugin.ai.suggestSessionDescription({
      sessionTitle: "Member Attempt",
    })

    await expect(collectStreamFromPromise(streamPromise)).rejects.toMatchObject({
      code: "FORBIDDEN",
    })
  })

  it("rejects streaming when AI service is unhealthy", async () => {
    const ownerCaller = buildCaller(owner, organizationId)

    await ownerCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: true,
    })

    vi.mocked(aiClient.checkOllamaHealth).mockResolvedValueOnce(false)

    const streamPromise = ownerCaller.plugin.ai.suggestSessionDescription({
      sessionTitle: "Health Check Session",
    })

    await expect(collectStreamFromPromise(streamPromise)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
    expect(aiClient.generateTextStream).not.toHaveBeenCalled()
  })
})
