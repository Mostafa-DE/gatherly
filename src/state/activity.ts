import { atom } from "jotai"

// Maps orgId → selected activityId (null = "All Activities")
export const selectedActivityByOrgAtom = atom<Record<string, string | null>>({})
