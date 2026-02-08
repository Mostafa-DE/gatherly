import { Crown, ShieldCheck, User } from "lucide-react"
import { cn } from "@/lib/utils"

const roleConfig: Record<string, {
  icon: typeof Crown
  label: string
  className: string
}> = {
  owner: {
    icon: Crown,
    label: "Owner",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  admin: {
    icon: ShieldCheck,
    label: "Admin",
    className: "bg-primary/10 text-primary",
  },
  member: {
    icon: User,
    label: "Member",
    className: "bg-muted text-muted-foreground",
  },
}

export function RoleBadge({ role }: { role: string }) {
  const config = roleConfig[role] ?? {
    icon: User,
    label: role,
    className: "bg-muted text-muted-foreground",
  }

  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        config.className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}
