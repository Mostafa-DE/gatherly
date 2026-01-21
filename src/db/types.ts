import type { user, session, organization, member, invitation } from "./auth-schema"

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
