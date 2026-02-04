import { z } from "zod"
import type { GroupMemberProfile } from "@/db/types"
import { ValidationError } from "@/exceptions"
import { joinFormSchemaSchema } from "@/schemas/organization-settings"
import type { FormField, JoinFormSchema } from "@/types/form"

type GroupMemberProfileDependencies = {
  getOrgSettings: (
    organizationId: string
  ) => Promise<{ joinFormSchema: unknown } | null>
  upsertProfile: (
    organizationId: string,
    userId: string,
    answers: Record<string, unknown>
  ) => Promise<GroupMemberProfile>
}

type UpdateGroupMemberProfileInput = {
  organizationId: string
  userId: string
  answers: Record<string, unknown>
}

function isEmptyAnswer(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === "string") {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  return false
}

function assertStringValue(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be a string`)
  }
  return value
}

function assertNumberValue(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${label} must be a valid number`)
  }
  return value
}

function validateFieldAnswer(field: FormField, answer: unknown): void {
  if (answer === undefined || answer === null) {
    return
  }

  switch (field.type) {
    case "text":
    case "textarea":
    case "phone": {
      const value = assertStringValue(answer, field.label)
      if (field.validation?.min !== undefined && value.length < field.validation.min) {
        throw new ValidationError(`${field.label} must be at least ${field.validation.min} characters`)
      }
      if (field.validation?.max !== undefined && value.length > field.validation.max) {
        throw new ValidationError(`${field.label} must be at most ${field.validation.max} characters`)
      }
      if (field.validation?.pattern) {
        const regex = new RegExp(field.validation.pattern)
        if (!regex.test(value)) {
          throw new ValidationError(`${field.label} has an invalid format`)
        }
      }
      return
    }
    case "email": {
      const value = assertStringValue(answer, field.label)
      const emailCheck = z.string().email().safeParse(value)
      if (!emailCheck.success) {
        throw new ValidationError(`${field.label} must be a valid email`)
      }
      return
    }
    case "number": {
      const value = assertNumberValue(answer, field.label)
      if (field.validation?.min !== undefined && value < field.validation.min) {
        throw new ValidationError(`${field.label} must be at least ${field.validation.min}`)
      }
      if (field.validation?.max !== undefined && value > field.validation.max) {
        throw new ValidationError(`${field.label} must be at most ${field.validation.max}`)
      }
      return
    }
    case "checkbox": {
      if (typeof answer !== "boolean") {
        throw new ValidationError(`${field.label} must be true or false`)
      }
      return
    }
    case "date": {
      if (answer instanceof Date) {
        if (Number.isNaN(answer.getTime())) {
          throw new ValidationError(`${field.label} must be a valid date`)
        }
        return
      }

      const value = assertStringValue(answer, field.label)
      const timestamp = Date.parse(value)
      if (Number.isNaN(timestamp)) {
        throw new ValidationError(`${field.label} must be a valid date`)
      }
      return
    }
    case "select": {
      const value = assertStringValue(answer, field.label)
      if (field.options && field.options.length > 0 && !field.options.includes(value)) {
        throw new ValidationError(`${field.label} has an invalid option`)
      }
      return
    }
    case "multiselect": {
      if (!Array.isArray(answer)) {
        throw new ValidationError(`${field.label} must be a list of values`)
      }

      if (!answer.every((item) => typeof item === "string")) {
        throw new ValidationError(`${field.label} must contain only string values`)
      }

      if (field.options && field.options.length > 0) {
        const invalidOption = answer.find((item) => !field.options?.includes(item))
        if (invalidOption) {
          throw new ValidationError(`${field.label} has an invalid option`)
        }
      }
      return
    }
  }
}

function validateJoinFormAnswers(
  joinFormSchema: JoinFormSchema,
  answers: Record<string, unknown>
): void {
  const knownFields = new Set(joinFormSchema.fields.map((field) => field.id))

  for (const [answerKey] of Object.entries(answers)) {
    if (!knownFields.has(answerKey)) {
      throw new ValidationError(`Unexpected form field: ${answerKey}`)
    }
  }

  for (const field of joinFormSchema.fields) {
    const answer = answers[field.id]

    if (field.required && isEmptyAnswer(answer)) {
      throw new ValidationError(`Missing required field: ${field.label}`)
    }

    validateFieldAnswer(field, answer)
  }
}

function parseJoinFormSchema(rawSchema: unknown): JoinFormSchema | null {
  if (!rawSchema) {
    return null
  }

  const parsed = joinFormSchemaSchema.safeParse(rawSchema)
  if (!parsed.success) {
    throw new ValidationError("Organization join form schema is invalid")
  }

  return parsed.data
}

export async function validateAndUpsertGroupMemberProfile(
  deps: GroupMemberProfileDependencies,
  input: UpdateGroupMemberProfileInput
): Promise<GroupMemberProfile> {
  const orgSettings = await deps.getOrgSettings(input.organizationId)
  const joinFormSchema = parseJoinFormSchema(orgSettings?.joinFormSchema)

  if (joinFormSchema) {
    validateJoinFormAnswers(joinFormSchema, input.answers)
  }

  return deps.upsertProfile(input.organizationId, input.userId, input.answers)
}
