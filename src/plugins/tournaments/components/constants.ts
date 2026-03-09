export const formatLabels: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  swiss: "Swiss",
  group_knockout: "Group + Knockout",
  free_for_all: "Free For All",
}

export const statusLabels: Record<string, string> = {
  draft: "Draft",
  registration: "Registration",
  check_in: "Check-In",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const statusStyles: Record<string, string> = {
  draft: "bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]",
  registration: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  check_in: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  in_progress: "bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]",
  completed: "bg-[var(--color-primary-subtle)] text-primary",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400",
}

export const entryStatusLabels: Record<string, string> = {
  registered: "Registered",
  checked_in: "Checked In",
  active: "Active",
  eliminated: "Eliminated",
  withdrawn: "Withdrawn",
  disqualified: "Disqualified",
}

export const entryStatusStyles: Record<string, string> = {
  registered: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  checked_in: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  active: "bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]",
  eliminated: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  withdrawn: "bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]",
  disqualified: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

export const matchStatusLabels: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  forfeit: "Forfeit",
  bye: "BYE",
  cancelled: "Cancelled",
}

export const matchStatusStyles: Record<string, string> = {
  pending: "bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]",
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  in_progress: "bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]",
  completed: "bg-[var(--color-primary-subtle)] text-primary",
  forfeit: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  bye: "bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400",
}

export const visibilityLabels: Record<string, string> = {
  activity_members: "Activity Members",
  org_members: "Org Members",
  public: "Public",
}

export const seedingLabels: Record<string, string> = {
  manual: "Manual",
  random: "Random",
  ranking: "From Ranking",
}

export const participantTypeLabels: Record<string, string> = {
  individual: "Individual",
  team: "Team",
}
