/**
 * Database Schema
 * - Auth tables are auto-generated in auth-schema.ts
 * - Add your app-specific tables below
 */

// Re-export auto-generated auth schema
export * from "./auth-schema"

// Export types for use in the application
export type {
  User,
  NewUser,
  Session,
  NewSession,
  Organization,
  NewOrganization,
  Member,
  NewMember,
  Invitation,
  NewInvitation,
} from "./types"

