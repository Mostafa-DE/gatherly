import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { groupMemberProfile } from "@/db/schema";

// =============================================================================
// Schema generated from Drizzle table
// =============================================================================

export const groupMemberProfileSelectSchema = createSelectSchema(groupMemberProfile);
export const groupMemberProfileInsertSchema = createInsertSchema(groupMemberProfile);

// =============================================================================
// Input Schemas
// =============================================================================

/** Get own profile for an org */
export const getMyProfileSchema = z.object({
  // organizationId comes from context (activeOrganization)
});

/** Update own profile */
export const updateMyProfileSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

/** Submit join form for an org */
export const submitJoinFormSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

/** Get user's profile (admin) */
export const getUserProfileSchema = z.object({
  userId: z.string(),
});

// =============================================================================
// Types
// =============================================================================

export type GroupMemberProfileSelect = z.infer<typeof groupMemberProfileSelectSchema>;
export type GroupMemberProfileInsert = z.infer<typeof groupMemberProfileInsertSchema>;
export type GetMyProfileInput = z.infer<typeof getMyProfileSchema>;
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
export type SubmitJoinFormInput = z.infer<typeof submitJoinFormSchema>;
export type GetUserProfileInput = z.infer<typeof getUserProfileSchema>;
