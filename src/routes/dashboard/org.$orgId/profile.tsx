import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Save, Calendar, History, ChevronDown } from "lucide-react"
import { Link } from "@tanstack/react-router"
import type { FormField } from "@/types/form"

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

  // Initialize answers from profile
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

    // Validate required fields
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
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const user = whoami?.user

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          View and edit your profile for this organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your profile details for this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">{user?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {formFields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Organization Profile</CardTitle>
            <CardDescription>
              Fill out additional information for this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {formFields.map((field) => (
              <ProfileFieldInput
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(value) => handleAnswerChange(field.id, value)}
              />
            ))}
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button
              onClick={handleSave}
              disabled={!dirty || updateProfile.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateProfile.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Custom Fields</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This organization hasn't configured any custom profile fields yet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ParticipationHistory />
    </div>
  )
}

// =============================================================================
// Participation History Component
// =============================================================================

function ParticipationHistory() {
  const { orgId } = Route.useParams()
  const [limit, setLimit] = useState(10)

  const { data: history, isLoading, isFetching } = trpc.participation.myHistory.useQuery({
    limit,
  })

  const hasMore = history && history.length === limit

  const statusVariant = (status: string) => {
    switch (status) {
      case "joined":
        return "default"
      case "waitlisted":
        return "secondary"
      case "cancelled":
        return "outline"
      default:
        return "secondary"
    }
  }

  const attendanceVariant = (attendance: string) => {
    switch (attendance) {
      case "show":
        return "default"
      case "no_show":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Participation History
        </CardTitle>
        <CardDescription>
          Your session attendance history in this organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}
        {history && history.length === 0 && (
          <div className="text-center py-6">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No History Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You haven't participated in any sessions yet.
            </p>
          </div>
        )}
        {history && history.length > 0 && (
          <div className="space-y-4">
            {history.map((item, index) => (
              <div key={item.participation.id}>
                {index > 0 && <Separator className="my-4" />}
                <Link
                  to="/dashboard/org/$orgId/sessions/$sessionId"
                  params={{ orgId, sessionId: item.session.id }}
                  className="block space-y-2 rounded-lg p-2 -m-2 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="font-medium">{item.session.title}</span>
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
                      <Badge variant={statusVariant(item.participation.status)}>
                        {item.participation.status}
                      </Badge>
                      {item.participation.attendance !== "pending" && (
                        <Badge variant={attendanceVariant(item.participation.attendance)}>
                          {item.participation.attendance === "show" ? "Present" : "No Show"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {hasMore && (
        <CardFooter className="border-t pt-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLimit((prev) => prev + 10)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

// =============================================================================
// Profile Field Input Component
// =============================================================================

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
          />
        )

      case "number":
        return (
          <Input
            type="number"
            value={(value as number) || ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
            placeholder={field.placeholder}
          />
        )

      case "textarea":
        return (
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <SelectTrigger>
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
