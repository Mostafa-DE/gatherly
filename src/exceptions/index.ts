import { TRPCError } from "@trpc/server"

export class NotFoundError extends TRPCError {
  constructor(message = "Resource not found") {
    super({ code: "NOT_FOUND", message })
  }
}

export class UnauthorizedError extends TRPCError {
  constructor(message = "Unauthorized") {
    super({ code: "UNAUTHORIZED", message })
  }
}

export class ForbiddenError extends TRPCError {
  constructor(message = "Forbidden") {
    super({ code: "FORBIDDEN", message })
  }
}

export class BadRequestError extends TRPCError {
  constructor(message = "Bad request") {
    super({ code: "BAD_REQUEST", message })
  }
}

export class ConflictError extends TRPCError {
  constructor(message = "Conflict") {
    super({ code: "CONFLICT", message })
  }
}

export class ValidationError extends TRPCError {
  constructor(message = "Validation failed") {
    super({ code: "BAD_REQUEST", message })
  }
}
