import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
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
import { User, Save, Calendar, History, ChevronDown } from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { FormField } from "@/types/form"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/dashboard/org/$orgId/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const utils = trpc.useUtils()

  const { data: whoami, isLoading } = trpc.user.whoami.useQuery()
  const { data: settings, isLoading: settingsLoading } = trpc.organizationSettings.get.useQuery({})
  const { data: myProfile, isLoading: profileLoading } = trpc.groupMemberProfile.myProfile.useQuery({})

  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState("")
  const [dirty, setDirty] = useState(false)

  const joinFormSchema = settings?.joinFormSchema as { fields?: FormField[] } | null
  const formFields = joinFormSchema?.fields || []

  useEffect(() => {
    if (myProfile?.answers) {
      setAnswers(myProfile.answers as Record<string, unknown>)
    }
  }, [myProfile])

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
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
    setDirty(true)
  }

  const handleSave = () => {
    setError("")
    for (const field of formFields) {
      if (field.required) {
        const value = answers[field.id]
        if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          setError(`"${field.label}" is required`)
          return
        }
      }
    }
    updateProfile.mutate({ answers })
  }

  if (isLoading || settingsLoading || profileLoading) {
    return (
      <div className="space-y-8 py-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const user = whoami?.user

  return (
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div>
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <User className="mr-2 h-3.5 w-3.5" />
          Profile
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          My{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Profile
          </span>
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          View and edit your profile for this group
        </p>
      </div>

      {/* Profile Information */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Profile Information</h2>
            <p className="text-sm text-muted-foreground">Your basic details</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <p className="text-sm font-medium text-muted-foreground">Name</p>
            <p className="mt-1 font-medium">{user?.name}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="mt-1 font-medium">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Group Profile Fields */}
      {formFields.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="font-semibold">Group Profile</h2>
            <p className="text-sm text-muted-foreground">
              Additional information for this group
            </p>
          </div>

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
                value={answers[field.id]}
                onChange={(value) => handleAnswerChange(field.id, value)}
              />
            ))}
          </div>

          <div className="mt-6 border-t border-border/50 pt-6">
            <Button
              onClick={handleSave}
              disabled={!dirty || updateProfile.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateProfile.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No Custom Fields</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This group hasn't configured any custom profile fields yet.
          </p>
        </div>
      )}

      {/* Participation History */}
      <ParticipationHistory />
    </div>
  )
}

function ParticipationHistory() {
  const { orgId } = Route.useParams()
  const [limit, setLimit] = useState(10)

  const { data: history, isLoading, isFetching } = trpc.participation.myHistory.useQuery({
    limit,
  })

  const hasMore = history && history.length === limit

  const statusColors: Record<string, string> = {
    joined: "bg-green-500/10 text-green-600",
    waitlisted: "bg-yellow-500/10 text-yellow-600",
    cancelled: "bg-muted text-muted-foreground",
  }

  const attendanceColors: Record<string, string> = {
    show: "bg-green-500/10 text-green-600",
    no_show: "bg-destructive/10 text-destructive",
    pending: "bg-muted text-muted-foreground",
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <History className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Participation History</h2>
          <p className="text-sm text-muted-foreground">
            Your session attendance in this group
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-background/50 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {history && history.length === 0 && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium">No History Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You haven't participated in any sessions yet.
          </p>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="space-y-3">
          {history.map((item) => (
            <Link
              key={item.participation.id}
              to="/dashboard/org/$orgId/sessions/$sessionId"
              params={{ orgId, sessionId: item.session.id }}
              className="group block rounded-lg border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="font-medium group-hover:text-primary">
                    {item.session.title}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(item.session.dateTime).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    statusColors[item.participation.status] || "bg-muted text-muted-foreground"
                  )}>
                    {item.participation.status}
                  </span>
                  {item.participation.attendance !== "pending" && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      attendanceColors[item.participation.attendance] || "bg-muted text-muted-foreground"
                    )}>
                      {item.participation.attendance === "show" ? "Present" : "No Show"}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setLimit((prev) => prev + 10)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

type ProfileFieldInputProps = {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
}

function ProfileFieldInput({ field, value, onChange }: ProfileFieldInputProps) {
  const renderInput = () => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="bg-background/50"
          />
        )
      case "number":
        return (
          <Input
            type="number"
            value={(value as number) || ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
            placeholder={field.placeholder}
            className="bg-background/50"
          />
        )
      case "textarea":
        return (
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            className="bg-background/50"
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
            <SelectTrigger className="bg-background/50">
              <SelectValue placeholder={field.placeholder || "Select..."} />
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
      case "multiselect":
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
                      onChange(selectedValues.filter((v) => v !== option))
                    }
                  }}
                />
                <span className="text-sm">{option}</span>
              </div>
            ))}
          </div>
        )
      default:
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className="bg-background/50"
          />
        )
    }
  }

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput()}
    </div>
  )
}
