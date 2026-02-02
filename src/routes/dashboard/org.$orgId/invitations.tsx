import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Mail, Send, X, Clock } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/invitations")({
  component: InvitationsPage,
})

function InvitationsPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"member" | "admin">("member")

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: invitations, isLoading: invitationsLoading } = trpc.organization.listInvitations.useQuery(
    undefined,
    { enabled: isAdmin }
  )

  const inviteMutation = trpc.organization.inviteMember.useMutation({
    onSuccess: () => {
      utils.organization.listInvitations.invalidate()
      setEmail("")
    },
  })

  const cancelMutation = trpc.organization.cancelInvitation.useMutation({
    onSuccess: () => {
      utils.organization.listInvitations.invalidate()
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    inviteMutation.mutate({ email: email.trim(), role })
  }

  if (whoamiLoading) {
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only organization owners and admins can manage invitations.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard/org/$orgId" params={{ orgId }}>
                Back to Overview
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invitations</h1>
        <p className="text-muted-foreground">
          Invite new members to join your organization
        </p>
      </div>

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Invitation
          </CardTitle>
          <CardDescription>
            Invite someone to join your organization by email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="member"
                    checked={role === "member"}
                    onChange={() => setRole("member")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Member</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={role === "admin"}
                    onChange={() => setRole("admin")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Admin</span>
                </label>
              </div>
            </div>
            <Button type="submit" disabled={!email.trim() || inviteMutation.isPending}>
              <Mail className="mr-2 h-4 w-4" />
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>

            {inviteMutation.error && (
              <p className="text-sm text-destructive">
                {inviteMutation.error.message}
              </p>
            )}
            {inviteMutation.isSuccess && (
              <p className="text-sm text-muted-foreground">
                Invitation sent successfully!
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
          <CardDescription>
            Invitations waiting to be accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : invitations?.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Pending Invitations</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                All sent invitations have been accepted or expired.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations?.map(({ invitation, inviter }) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Role: {invitation.role ?? "member"} • Invited by {inviter.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelMutation.mutate({ invitationId: invitation.id })}
                    disabled={cancelMutation.isPending}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          )}

          {cancelMutation.error && (
            <p className="mt-4 text-sm text-destructive text-center">
              {cancelMutation.error.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
