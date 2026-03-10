import type { RankingDomain } from "../types"

export const readingDomain: RankingDomain = {
  id: "reading",
  name: "Reading",
  statFields: [
    { id: "books_read", label: "Books Read", source: "team" },
    { id: "pages_read", label: "Pages Read", source: "team" },
    { id: "sessions_attended", label: "Sessions Attended", source: "team" },
  ],
  tieBreak: [
    { field: "books_read", direction: "desc" },
    { field: "pages_read", direction: "desc" },
  ],
}
