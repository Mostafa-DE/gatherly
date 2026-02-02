import { router } from "@/trpc";
import { userRouter } from "./user";
import { sessionRouter } from "./session";
import { participationRouter } from "./participation";
import { groupMemberProfileRouter } from "./group-member-profile";
import { organizationSettingsRouter } from "./organization-settings";
import { joinRequestRouter } from "./join-request";
import { organizationRouter } from "./organization";

export const appRouter = router({
  user: userRouter,
  session: sessionRouter,
  participation: participationRouter,
  groupMemberProfile: groupMemberProfileRouter,
  organizationSettings: organizationSettingsRouter,
  joinRequest: joinRequestRouter,
  organization: organizationRouter,
});

export type AppRouter = typeof appRouter;
