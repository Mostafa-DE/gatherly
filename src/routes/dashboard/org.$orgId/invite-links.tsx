import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LinkIcon,
  MoreVertical,
  Copy,
  XCircle,
  Ban,
  Shield,
  Users,
  Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buildInviteUrl } from "@/lib/share-urls"
import { copyToClipboard } from "@/lib/clipboard"
import { toast } from "sonner"

export const Route = createFileRoute("/dashboard/org/$orgId/invite-links")({
  component: InviteLinksPage,
})

function InviteLinksPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin =
    whoami?.membership?.role === "owner" ||
    whoami?.membership?.role === "admin"

  const { data: links, isLoading: linksLoading } =
    trpc.inviteLink.list.useQuery(undefined, { enabled: isAdmin })

  const deactivateMutation = trpc.inviteLink.deactivate.useMutation({
    onSuccess: () => {
      utils.inviteLink.list.invalidate()
      toast.success("Invite link deactivated")
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  if (whoamiLoading) {
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Only group owners and admins can manage invite links.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId" params={{ orgId }}>
            Back to Overview
          </Link>
        </Button>
      </div>
    )
  }

  const username = whoami?.activeOrganization?.ownerUsername ?? ""
  const groupSlug = whoami?.activeOrganization?.userSlug ?? ""

  const getStatus = (link: {
    isActive: boolean
    expiresAt: string | Date | null
    maxUses: number | null
    usedCount: number
  }) => {
    if (!link.isActive) {
      return { label: "Deactivated", className: "bg-muted text-muted-foreground" }
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return { label: "Expired", className: "bg-destructive/10 text-destructive" }
    }
    if (link.maxUses !== null && link.usedCount >= link.maxUses) {
      return { label: "Depleted", className: "bg-yellow-500/10 text-yellow-600" }
    }
    return { label: "Active", className: "bg-green-500/10 text-green-600" }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return {
          icon: Shield,
          text: "Admin",
          className: "bg-yellow-500/10 text-yellow-600",
        }
      case "owner":
        return {
          icon: Crown,
          text: "Owner",
          className: "bg-primary/10 text-primary",
        }
      default:
        return {
          icon: Users,
          text: "Member",
          className: "bg-muted text-muted-foreground",
        }
    }
  }

  return (
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div>
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <LinkIcon className="mr-2 h-3.5 w-3.5" />
          Invite Links
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Invite{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Links
              </span>
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {links?.length || 0} invite link{links?.length !== 1 ? "s" : ""} created
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
              <Users className="mr-2 h-4 w-4" />
              Members
            </Link>
          </Button>
        </div>
      </div>

      {/* Links List */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        {linksLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-border/50 bg-background/50 p-4"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : links?.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <LinkIcon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium">No Invite Links</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate invite links from the Share dialog on your group page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {links?.map((link) => {
              const status = getStatus(link)
              const role = getRoleBadge(link.role)
              const RoleIcon = role.icon
              const isActionable = link.isActive && status.label === "Active"

              return (
                <div
                  key={link.id}
                  className="flex items-center gap-4 rounded-lg border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <LinkIcon className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono truncate">
                        {link.token.slice(0, 12)}...
                      </code>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          role.className
                        )}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {role.text}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Created{" "}
                        {new Date(link.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {link.expiresAt && (
                        <span>
                          Expires{" "}
                          {new Date(link.expiresAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      <span>
                        Used {link.usedCount}
                        {link.maxUses !== null ? `/${link.maxUses}` : ""} time
                        {link.usedCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        status.className
                      )}
                    >
                      {status.label}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            const url = buildInviteUrl(
                              username,
                              groupSlug,
                              link.token
                            )
                            copyToClipboard(url, "Invite link")
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </DropdownMenuItem>
                        {isActionable && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              deactivateMutation.mutate({
                                inviteLinkId: link.id,
                              })
                            }
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
