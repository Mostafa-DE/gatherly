/**
 * Format a price with currency
 * Returns "Free" for null/undefined/0 prices
 */
export function formatPrice(
  price: string | number | null | undefined,
  currency: string | null | undefined
): string {
  if (price === null || price === undefined) return "Free"
  const num = typeof price === "string" ? parseFloat(price) : price
  if (isNaN(num) || num === 0) return "Free"
  if (!currency) return num.toFixed(2)

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(num)
  } catch {
    // Fallback if currency code is invalid
    return `${currency} ${num.toFixed(2)}`
  }
}

/**
 * Check if a price is set (non-null, non-zero)
 */
export function hasPrice(price: string | number | null | undefined): boolean {
  if (price === null || price === undefined) return false
  const num = typeof price === "string" ? parseFloat(price) : price
  return !isNaN(num) && num > 0
}
