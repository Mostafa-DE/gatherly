import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  User,
  Save,
  Calendar,
  ChevronDown,
  ArrowRight,
  Pencil,
  X,
  Check,
} from "lucide-react"
import type { FormField } from "@/types/form"
import { cn } from "@/lib/utils"
import { RoleBadge } from "@/components/role-badge"
import { EngagementStatsCard } from "@/components/engagement-stats"

export const Route = createFileRoute("/dashboard/org/$orgId/profile")({
  component: ProfilePage,
})

/* ─────────────────────────── main page ─────────────────────────── */

function ProfilePage() {
  const utils = trpc.useUtils()

  const { data: whoami, isLoading } = trpc.user.whoami.useQuery()
  const { data: settings, isLoading: settingsLoading } =
    trpc.organizationSettings.get.useQuery({})
  const { data: myProfile, isLoading: profileLoading } =
    trpc.groupMemberProfile.myProfile.useQuery({})
  const { data: stats, isLoading: statsLoading } =
    trpc.groupMemberProfile.myStats.useQuery()

  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState("")
  const [dirty, setDirty] = useState(false)

  // Nickname editing state
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameValue, setNicknameValue] = useState("")

  // Scroll to hash anchor after data loads
  useEffect(() => {
    if (
      !isLoading &&
      !settingsLoading &&
      !profileLoading &&
      window.location.hash
    ) {
      const id = window.location.hash.slice(1)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
    }
  }, [isLoading, settingsLoading, profileLoading])

  const joinFormSchema = settings?.joinFormSchema as {
    fields?: FormField[]
  } | null
  const formFields = joinFormSchema?.fields || []
  const persistedAnswers =
    (myProfile?.answers as Record<string, unknown>) || {}
  const activeAnswers = dirty ? answers : persistedAnswers

  const updateProfile = trpc.groupMemberProfile.updateMyProfile.useMutation({
    onSuccess: () => {
      utils.groupMemberProfile.myProfile.invalidate()
      setDirty(false)
      setError("")
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const handleAnswerChange = (fieldId: string, value: unknown) => {
    setAnswers((prev) => ({
      ...(dirty ? prev : activeAnswers),
      [fieldId]: value,
    }))
    setDirty(true)
  }

  const handleSave = () => {
    setError("")
    for (const field of formFields) {
      if (field.required) {
        const value = activeAnswers[field.id]
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          setError(`"${field.label}" is required`)
          return
        }
      }
    }
    updateProfile.mutate({ answers: activeAnswers })
  }

  const handleNicknameSave = () => {
    const trimmed = nicknameValue.trim()
    updateProfile.mutate(
      {
        nickname: trimmed || null,
        answers: persistedAnswers,
      },
      {
        onSuccess: () => {
          setEditingNickname(false)
        },
      }
    )
  }

  const handleNicknameCancel = () => {
    setEditingNickname(false)
    setNicknameValue((myProfile as { nickname?: string | null } | null)?.nickname ?? "")
  }

  if (isLoading || settingsLoading || profileLoading) {
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const user = whoami?.user
  const role = whoami?.membership?.role
  const currentNickname = (myProfile as { nickname?: string | null } | null)?.nickname

  return (
    <div className="space-y-6 py-6">
      {/* ── Header + profile bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary shrink-0">
            {user?.name
              ? user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "?"}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              {user?.name}
            </h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        {role && <RoleBadge role={role} />}
      </div>

      {/* ── Nickname section ── */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Nickname
        </h2>
        {editingNickname ? (
          <div className="flex items-center gap-2">
            <Input
              value={nicknameValue}
              onChange={(e) => setNicknameValue(e.target.value)}
              placeholder="Enter a nickname for this group"
              maxLength={100}
              className="bg-white dark:bg-input/30 max-w-sm"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNicknameSave}
              disabled={updateProfile.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleNicknameCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn("text-sm", !currentNickname && "text-muted-foreground italic")}>
              {currentNickname || "No nickname set"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setNicknameValue(currentNickname ?? "")
                setEditingNickname(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Engagement stats ── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <EngagementStatsCard stats={stats} />
      ) : null}

      {/* ── Group profile fields ── */}
      {formFields.length > 0 ? (
        <div
          id="group-profile"
          className="rounded-xl border bg-card p-5"
        >
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            Group Details
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {formFields.map((field) => (
              <ProfileFieldInput
                key={field.id}
                field={field}
                value={activeAnswers[field.id]}
                onChange={(value) => handleAnswerChange(field.id, value)}
              />
            ))}
          </div>

          <div className="mt-5 border-t pt-5">
            <Button
              onClick={handleSave}
              disabled={!dirty || updateProfile.isPending}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {updateProfile.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <p className="font-medium">No Custom Fields</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This group hasn't configured any custom profile fields yet.
          </p>
        </div>
      )}

      {/* ── Participation history ── */}
      <ParticipationHistory />
    </div>
  )
}

/* ─────────────────────────── participation history ─────────────────────────── */

function ParticipationHistory() {
  const { orgId } = Route.useParams()
  const [limit, setLimit] = useState(10)

  const {
    data: history,
    isLoading,
    isFetching,
  } = trpc.participation.myHistory.useQuery({ limit })

  const hasMore = history && history.length === limit

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Participation History
        </h2>
        {history && history.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {history.length} session{history.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-[46px] w-12 rounded-lg shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-1 h-4 w-24" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {history && history.length === 0 && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No History Yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You haven't participated in any sessions yet.
          </p>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="space-y-3">
          {history.map((item) => {
            const dateObj = new Date(item.session.dateTime)
            return (
              <Link
                key={item.participation.id}
                to="/dashboard/org/$orgId/sessions/$sessionId"
                params={{ orgId, sessionId: item.session.id }}
                className="group flex items-center gap-3 rounded-lg border bg-background p-3 transition-all hover:border-primary/50 hover:shadow-md"
              >
                {/* Date badge */}
                <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1.5 min-w-[3rem] shrink-0">
                  <span className="text-base font-bold text-primary leading-none">
                    {dateObj.getDate()}
                  </span>
                  <span className="text-[10px] font-semibold text-primary/70 mt-0.5">
                    {dateObj
                      .toLocaleDateString(undefined, { month: "short" })
                      .toUpperCase()}
                  </span>
                </div>

                {/* Title + time */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {item.session.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {dateObj.toLocaleDateString(undefined, {
                      weekday: "short",
                    })}{" "}
                    {dateObj.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <ParticipationStatusBadge
                    status={item.participation.status}
                  />
                  {item.participation.attendance !== "pending" && (
                    <AttendanceBadge
                      attendance={item.participation.attendance}
                    />
                  )}
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLimit((prev) => prev + 10)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-1.5" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── status badges ─────────────────────────── */

function ParticipationStatusBadge({ status }: { status: string }) {
  if (status === "joined") {
    return (
      <Badge className="bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] border-0 text-xs">
        Joined
      </Badge>
    )
  }
  if (status === "waitlisted") {
    return (
      <Badge className="bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] border-0 text-xs">
        Waitlisted
      </Badge>
    )
  }
  return (
    <Badge className="bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)] border-0 text-xs">
      Cancelled
    </Badge>
  )
}

function AttendanceBadge({ attendance }: { attendance: string }) {
  if (attendance === "show") {
    return (
      <Badge className="bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] border-0 text-xs">
        Present
      </Badge>
    )
  }
  return (
    <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 text-xs">
      No Show
    </Badge>
  )
}

/* ─────────────────────────── form field input ─────────────────────────── */

type ProfileFieldInputProps = {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
}

function ProfileFieldInput({
  field,
  value,
  onChange,
}: ProfileFieldInputProps) {
  const renderInput = () => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            type={
              field.type === "email"
                ? "email"
                : field.type === "phone"
                  ? "tel"
                  : "text"
            }
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="bg-white dark:bg-input/30"
          />
        )
      case "number":
        return (
          <Input
            type="number"
            value={(value as number) || ""}
            onChange={(e) =>
              onChange(e.target.value ? Number(e.target.value) : "")
            }
            placeholder={field.placeholder}
            className="bg-white dark:bg-input/30"
          />
        )
      case "textarea":
        return (
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-white dark:bg-input/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        )
      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className="bg-white dark:bg-input/30"
          />
        )
      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => onChange(checked === true)}
            />
            <span className="text-sm text-muted-foreground">
              {field.placeholder || "Yes"}
            </span>
          </div>
        )
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="bg-white dark:bg-input/30">
              <SelectValue
                placeholder={field.placeholder || "Select..."}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case "multiselect": {
        const selectedValues = (value as string[]) || []
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option])
                    } else {
                      onChange(
                        selectedValues.filter((v) => v !== option)
                      )
                    }
                  }}
                />
                <span className="text-sm">{option}</span>
              </div>
            ))}
          </div>
        )
      }
      default:
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.required && (
          <span className="text-destructive ml-1">*</span>
        )}
      </Label>
      {renderInput()}
    </div>
  )
}
