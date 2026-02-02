import { createFileRoute, Link } from "@tanstack/react-router"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId/roster"
)({
  component: SessionRosterPage,
})

function SessionRosterPage() {
  const { orgId, sessionId } = Route.useParams()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: sessionData } = trpc.session.getById.useQuery({ sessionId })

  const {
    data: joinedParticipants,
    isLoading: joinedLoading,
  } = trpc.participation.roster.useQuery(
    { sessionId, status: "joined", limit: 100 },
    { enabled: isAdmin }
  )

  const {
    data: waitlistedParticipants,
    isLoading: waitlistedLoading,
  } = trpc.participation.roster.useQuery(
    { sessionId, status: "waitlisted", limit: 100 },
    { enabled: isAdmin }
  )

  const updateParticipation = trpc.participation.update.useMutation({
    onSuccess: () => {
      utils.participation.roster.invalidate({ sessionId })
    },
  })

  if (whoamiLoading) {
    return (
      <div className="py-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only organization owners and admins can view the roster.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId"
                params={{ orgId, sessionId }}
              >
                Back to Session
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link
            to="/dashboard/org/$orgId/sessions/$sessionId"
            params={{ orgId, sessionId }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Session Roster</h1>
        {sessionData && (
          <p className="text-muted-foreground">{sessionData.title}</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Joined Participants */}
        <Card>
          <CardHeader>
            <CardTitle>
              Joined ({joinedParticipants?.length ?? 0})
            </CardTitle>
            <CardDescription>
              Participants registered for this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            {joinedLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            {joinedParticipants && joinedParticipants.length === 0 && (
              <p className="text-muted-foreground">No participants yet</p>
            )}
            {joinedParticipants && joinedParticipants.length > 0 && (
              <div className="space-y-3">
                {joinedParticipants.map((item, index) => (
                  <div key={item.participation.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <ParticipantRow
                      participation={item.participation}
                      user={item.user}
                      onUpdate={(data) =>
                        updateParticipation.mutate({
                          participationId: item.participation.id,
                          ...data,
                        })
                      }
                      isUpdating={updateParticipation.isPending}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waitlisted Participants */}
        <Card>
          <CardHeader>
            <CardTitle>
              Waitlist ({waitlistedParticipants?.length ?? 0})
            </CardTitle>
            <CardDescription>
              Participants waiting for a spot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {waitlistedLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            {waitlistedParticipants && waitlistedParticipants.length === 0 && (
              <p className="text-muted-foreground">No one on waitlist</p>
            )}
            {waitlistedParticipants && waitlistedParticipants.length > 0 && (
              <div className="space-y-3">
                {waitlistedParticipants.map((item, index) => (
                  <div key={item.participation.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{item.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

type ParticipantRowProps = {
  participation: {
    id: string
    attendance: string
    payment: string
    notes: string | null
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  onUpdate: (data: { attendance?: "pending" | "show" | "no_show"; payment?: "unpaid" | "paid" }) => void
  isUpdating: boolean
}

function ParticipantRow({
  participation,
  user,
  onUpdate,
  isUpdating,
}: ParticipantRowProps) {
  const attendanceVariant = (attendance: string) => {
    switch (attendance) {
      case "show":
        return "default"
      case "no_show":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const paymentVariant = (payment: string) => {
    switch (payment) {
      case "paid":
        return "default"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={attendanceVariant(participation.attendance)}>
            {participation.attendance}
          </Badge>
          <Badge variant={paymentVariant(participation.payment)}>
            {participation.payment}
          </Badge>
        </div>
      </div>
      <div className="flex gap-2">
        <Select
          value={participation.attendance}
          onValueChange={(value) =>
            onUpdate({ attendance: value as "pending" | "show" | "no_show" })
          }
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="show">Show</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={participation.payment}
          onValueChange={(value) =>
            onUpdate({ payment: value as "unpaid" | "paid" })
          }
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
