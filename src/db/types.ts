import type { user, session, organization, member, invitation } from "@/db/auth-schema"
import type {
  organizationSettings,
  eventSession,
  participation,
  groupMemberProfile,
  joinRequest,
  inviteLink,
  memberNote,
  activity,
  activityMember,
  activityJoinRequest,
  interestCategory,
  interest,
  userInterest,
  organizationInterest,
} from "@/db/schema"

// Auth types (from Better Auth)
export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert
export type Session = typeof session.$inferSelect
export type NewSession = typeof session.$inferInsert
export type Organization = typeof organization.$inferSelect
export type NewOrganization = typeof organization.$inferInsert
export type Member = typeof member.$inferSelect
export type NewMember = typeof member.$inferInsert
export type Invitation = typeof invitation.$inferSelect
export type NewInvitation = typeof invitation.$inferInsert

// App types
export type OrganizationSettings = typeof organizationSettings.$inferSelect
export type NewOrganizationSettings = typeof organizationSettings.$inferInsert
export type EventSession = typeof eventSession.$inferSelect
export type NewEventSession = typeof eventSession.$inferInsert
export type Participation = typeof participation.$inferSelect
export type NewParticipation = typeof participation.$inferInsert
export type GroupMemberProfile = typeof groupMemberProfile.$inferSelect
export type NewGroupMemberProfile = typeof groupMemberProfile.$inferInsert
export type JoinRequest = typeof joinRequest.$inferSelect
export type NewJoinRequest = typeof joinRequest.$inferInsert
export type InviteLink = typeof inviteLink.$inferSelect
export type NewInviteLink = typeof inviteLink.$inferInsert
export type MemberNote = typeof memberNote.$inferSelect
export type NewMemberNote = typeof memberNote.$inferInsert
export type Activity = typeof activity.$inferSelect
export type NewActivity = typeof activity.$inferInsert
export type ActivityMember = typeof activityMember.$inferSelect
export type NewActivityMember = typeof activityMember.$inferInsert
export type ActivityJoinRequest = typeof activityJoinRequest.$inferSelect
export type NewActivityJoinRequest = typeof activityJoinRequest.$inferInsert
export type InterestCategory = typeof interestCategory.$inferSelect
export type NewInterestCategory = typeof interestCategory.$inferInsert
export type Interest = typeof interest.$inferSelect
export type NewInterest = typeof interest.$inferInsert
export type UserInterest = typeof userInterest.$inferSelect
export type NewUserInterest = typeof userInterest.$inferInsert
export type OrganizationInterest = typeof organizationInterest.$inferSelect
export type NewOrganizationInterest = typeof organizationInterest.$inferInsert
