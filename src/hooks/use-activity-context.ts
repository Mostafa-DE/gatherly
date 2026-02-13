import { useEffect, useCallback } from "react"
import { useAtom } from "jotai"
import { trpc } from "@/lib/trpc"
import { selectedActivityByOrgAtom } from "@/state/activity"

const STORAGE_KEY = "gatherly:selected-activity"

function readPersistedSelection(): Record<string, string | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useActivityContext(orgId: string) {
  const [selectionMap, setSelectionMap] = useAtom(selectedActivityByOrgAtom)

  const { data: activities, isLoading } = trpc.activity.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !!orgId }
  )

  // Hydrate atom from localStorage on first mount
  useEffect(() => {
    setSelectionMap((prev) => {
      if (Object.keys(prev).length > 0) return prev
      return readPersistedSelection()
    })
  }, [setSelectionMap])

  // Persist selection changes to localStorage
  useEffect(() => {
    if (Object.keys(selectionMap).length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectionMap))
    } catch {
      // localStorage unavailable/full
    }
  }, [selectionMap])

  // Reset selection if the selected activity is no longer in the list
  // (e.g., it was deactivated and the list only shows active activities)
  useEffect(() => {
    if (!activities || activities.length === 0) return
    const currentSelection = selectionMap[orgId] ?? null
    if (currentSelection && !activities.some((a) => a.id === currentSelection)) {
      setSelectionMap((prev) => ({
        ...prev,
        [orgId]: null,
      }))
    }
  }, [activities, orgId, selectionMap, setSelectionMap])

  const selectedActivityId = selectionMap[orgId] ?? null

  const setSelectedActivity = useCallback(
    (activityId: string | null) => {
      setSelectionMap((prev) => ({
        ...prev,
        [orgId]: activityId,
      }))
    },
    [orgId, setSelectionMap]
  )

  const isMultiActivity = (activities?.length ?? 0) > 1
  const defaultActivityId = activities?.[0]?.id ?? null

  return {
    activities: activities ?? [],
    isMultiActivity,
    selectedActivityId,
    setSelectedActivity,
    defaultActivityId,
    isLoading,
  }
}
