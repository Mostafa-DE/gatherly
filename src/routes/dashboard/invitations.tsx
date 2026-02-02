import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Mail, Check, X } from "lucide-react"

export const Route = createFileRoute("/dashboard/invitations")({
  component: UserInvitationsPage,
})

function UserInvitationsPage() {
  const utils = trpc.useUtils()

  const { data: invitations, isLoading } = trpc.user.listMyInvitations.useQuery()

  const acceptMutation = trpc.user.acceptInvitation.useMutation({
    onSuccess: () => {
      utils.user.listMyInvitations.invalidate()
      utils.user.myOrgs.invalidate()
    },
  })

  const rejectMutation = trpc.user.rejectInvitation.useMutation({
    onSuccess: () => {
      utils.user.listMyInvitations.invalidate()
    },
  })

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Invitations</h1>
        <p className="text-muted-foreground">
          Invitations you've received to join organizations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
          <CardDescription>
            Accept or decline invitations to join organizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : invitations?.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Mail className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Invitations</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You don't have any pending invitations at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations?.map(({ invitation, organization }) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <Avatar>
                    <AvatarImage src={organization.logo ?? undefined} alt={organization.name} />
                    <AvatarFallback>
                      {organization.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{organization.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Role: {invitation.role ?? "member"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate({ invitationId: invitation.id })}
                      disabled={acceptMutation.isPending || rejectMutation.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate({ invitationId: invitation.id })}
                      disabled={acceptMutation.isPending || rejectMutation.isPending}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(acceptMutation.error || rejectMutation.error) && (
            <p className="mt-4 text-sm text-destructive text-center">
              {acceptMutation.error?.message || rejectMutation.error?.message}
            </p>
          )}
          {acceptMutation.isSuccess && (
            <p className="mt-4 text-sm text-muted-foreground text-center">
              Invitation accepted! Check your organizations list.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
