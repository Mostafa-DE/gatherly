export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "select",
  "multiselect",
  "checkbox",
  "date",
] as const

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export type FormFieldValidation = {
  min?: number
  max?: number
  pattern?: string
}

export type FormField = {
  id: string
  type: FormFieldType
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
  validation?: FormFieldValidation
}

export type JoinFormSchema = {
  fields: FormField[]
}
