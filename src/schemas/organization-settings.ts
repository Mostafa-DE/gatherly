import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organizationSettings } from "@/db/schema";
import {
  FORM_FIELD_TYPES,
  type FormField,
  type FormFieldType,
  type JoinFormSchema,
} from "@/types/form";

// =============================================================================
// Form Field Types (for join form schema)
// =============================================================================

export const formFieldTypeSchema: z.ZodType<FormFieldType> = z.enum(FORM_FIELD_TYPES);

export const formFieldSchema: z.ZodType<FormField> = z.object({
  id: z.string(),
  type: formFieldTypeSchema,
  label: z.string().min(1).max(200),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export const joinFormSchemaSchema: z.ZodType<JoinFormSchema> = z.object({
  fields: z.array(formFieldSchema).max(50),
});

// =============================================================================
// Schema generated from Drizzle table
// =============================================================================

export const organizationSettingsSelectSchema = createSelectSchema(organizationSettings);
export const organizationSettingsInsertSchema = createInsertSchema(organizationSettings);

// =============================================================================
// Input Schemas
// =============================================================================

/** Get organization settings */
export const getOrgSettingsSchema = z.object({
  // organizationId comes from context (activeOrganization)
});

/** Update join form schema */
export const updateJoinFormSchema = z.object({
  joinFormSchema: joinFormSchemaSchema.nullable(),
});

// =============================================================================
// Types
// =============================================================================

export type OrganizationSettingsSelect = z.infer<typeof organizationSettingsSelectSchema>;
export type OrganizationSettingsInsert = z.infer<typeof organizationSettingsInsertSchema>;
export type GetOrgSettingsInput = z.infer<typeof getOrgSettingsSchema>;
export type UpdateJoinFormInput = z.infer<typeof updateJoinFormSchema>;
export type { FormFieldType, FormField, JoinFormSchema };
