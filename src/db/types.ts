import type { user, session, organization, member, invitation } from "@/db/auth-schema";
import type {
  organizationSettings,
  eventSession,
  participation,
  groupMemberProfile,
  joinRequest,
} from "@/db/schema";

// Auth types (from Better Auth)
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Organization = typeof organization.$inferSelect;
export type NewOrganization = typeof organization.$inferInsert;
export type Member = typeof member.$inferSelect;
export type NewMember = typeof member.$inferInsert;
export type Invitation = typeof invitation.$inferSelect;
export type NewInvitation = typeof invitation.$inferInsert;

// App types
export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert;
export type EventSession = typeof eventSession.$inferSelect;
export type NewEventSession = typeof eventSession.$inferInsert;
export type Participation = typeof participation.$inferSelect;
export type NewParticipation = typeof participation.$inferInsert;
export type GroupMemberProfile = typeof groupMemberProfile.$inferSelect;
export type NewGroupMemberProfile = typeof groupMemberProfile.$inferInsert;
export type JoinRequest = typeof joinRequest.$inferSelect;
export type NewJoinRequest = typeof joinRequest.$inferInsert;
