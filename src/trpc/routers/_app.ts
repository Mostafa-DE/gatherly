import { router } from "@/trpc"
import { userRouter } from "@/trpc/routers/user"
import { sessionRouter } from "@/trpc/routers/session"
import { participationRouter } from "@/trpc/routers/participation"
import { groupMemberProfileRouter } from "@/trpc/routers/group-member-profile"
import { organizationSettingsRouter } from "@/trpc/routers/organization-settings"
import { joinRequestRouter } from "@/trpc/routers/join-request"
import { organizationRouter } from "@/trpc/routers/organization"
import { inviteLinkRouter } from "@/trpc/routers/invite-link"
import { memberNoteRouter } from "@/trpc/routers/member-note"

export const appRouter = router({
  user: userRouter,
  session: sessionRouter,
  participation: participationRouter,
  groupMemberProfile: groupMemberProfileRouter,
  organizationSettings: organizationSettingsRouter,
  joinRequest: joinRequestRouter,
  organization: organizationRouter,
  inviteLink: inviteLinkRouter,
  memberNote: memberNoteRouter,
})

export type AppRouter = typeof appRouter
