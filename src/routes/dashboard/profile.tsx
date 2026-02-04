import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { User, Save, Mail, Calendar, CheckCircle2, XCircle, Pencil } from "lucide-react"

export const Route = createFileRoute("/dashboard/profile")({
  component: UserProfilePage,
})

function UserProfilePage() {
  const utils = trpc.useUtils()
  const { data: user, isLoading } = trpc.user.me.useQuery()

  const [name, setName] = useState("")
  const [image, setImage] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const updateMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate()
      setIsEditing(false)
    },
  })

  // Initialize form when user data loads
  const handleStartEdit = () => {
    if (user) {
      setName(user.name)
      setImage(user.image ?? "")
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    const updates: { name?: string; image?: string } = {}
    if (name && name !== user?.name) {
      updates.name = name
    }
    if (image !== (user?.image ?? "")) {
      updates.image = image || undefined
    }
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates)
    } else {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setName("")
    setImage("")
  }

  if (isLoading) {
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

  if (!user) {
    return null
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div>
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <User className="mr-2 h-3.5 w-3.5" />
          Account
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          My{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Profile
          </span>
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Card */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarImage
                src={isEditing ? image || undefined : user.image ?? undefined}
                alt={user.name}
              />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-muted-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Member since {new Date(user.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={handleStartEdit} className="border-border/50">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {isEditing && (
          <div className="space-y-4 border-t border-border/50 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Profile Image URL</Label>
                <Input
                  id="image"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="bg-background/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
            {updateMutation.error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {updateMutation.error.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Account Details */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Account Details</h2>
            <p className="text-sm text-muted-foreground">
              Information about your account status
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="font-medium truncate">{user.email}</p>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              {user.emailVerified ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              Email Status
            </div>
            <p className={`font-medium ${user.emailVerified ? "text-green-500" : "text-destructive"}`}>
              {user.emailVerified ? "Verified" : "Not Verified"}
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Account Created
            </div>
            <p className="font-medium">
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
