import { ForbiddenError } from "@/exceptions"

const ORGANIZATION_MEMBERSHIP_LIMIT_REACHED =
  "Organization membership limit reached"

export function rethrowBetterAuthOrganizationError(error: unknown): never {
  if (
    error instanceof Error &&
    error.message === ORGANIZATION_MEMBERSHIP_LIMIT_REACHED
  ) {
    throw new ForbiddenError(ORGANIZATION_MEMBERSHIP_LIMIT_REACHED)
  }

  throw error
}
