// Utility types
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> =
  T extends (...args: unknown[]) => Promise<infer R> ? R : never

// Make specific keys optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Make specific keys required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Extract array element type
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never

// Pagination types
export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export type PaginationInput = {
  page?: number
  pageSize?: number
}

// API response types
export type ApiResponse<T> = {
  success: true
  data: T
} | {
  success: false
  error: string
}
