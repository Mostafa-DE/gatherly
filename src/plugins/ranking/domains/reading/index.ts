import type { RankingDomain } from "../types"

export const readingDomain: RankingDomain = {
  id: "reading",
  name: "Reading",
  statFields: [
    { id: "books_read", label: "Books Read" },
    { id: "pages_read", label: "Pages Read" },
    { id: "sessions_attended", label: "Sessions Attended" },
  ],
  tieBreak: [
    { field: "books_read", direction: "desc" },
    { field: "pages_read", direction: "desc" },
  ],
}
