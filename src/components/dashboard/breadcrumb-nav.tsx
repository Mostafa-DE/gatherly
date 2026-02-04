import * as React from "react"
import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type BreadcrumbSegment = {
  label: string
  href?: string
}

export function BreadcrumbNav() {
  const { orgId, sessionId } = useParams({ strict: false })
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const isOrgRoute = pathname.includes("/dashboard/org/")

  const { data: whoami } = trpc.user.whoami.useQuery()
  const orgName = whoami?.activeOrganization?.name

  const segments: BreadcrumbSegment[] = []

  // Add org breadcrumb if we're in an org context (check pathname, not just params)
  if (isOrgRoute && orgId && orgName) {
    segments.push({
      label: orgName,
      href: `/dashboard/org/${orgId}`,
    })
  }

  // Parse the rest of the path
  const pathParts = pathname.split("/").filter(Boolean)

  // Find the position after org/$orgId
  const orgIndex = pathParts.indexOf("org")
  if (orgIndex !== -1 && pathParts[orgIndex + 1]) {
    const afterOrgParts = pathParts.slice(orgIndex + 2)

    // Build breadcrumbs for remaining path parts
    if (afterOrgParts.length > 0) {
      let currentPath = `/dashboard/org/${orgId}`

      afterOrgParts.forEach((part, index) => {
        // Skip IDs (session IDs, etc.)
        if (part === sessionId) {
          return
        }

        currentPath += `/${part}`
        const isLast = index === afterOrgParts.length - 1

        const label = formatLabel(part)

        if (isLast) {
          segments.push({ label })
        } else {
          segments.push({ label, href: currentPath })
        }
      })
    }
  }

  // If we're just on /org/$orgId, show "Overview"
  if (segments.length === 1 && segments[0].href === `/dashboard/org/${orgId}`) {
    segments[0] = { label: segments[0].label }
  }

  if (segments.length === 0) {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isFirst = index === 0
          const isLast = index === segments.length - 1

          return (
            <React.Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator className={isFirst ? "" : "hidden sm:block"} />}
              <BreadcrumbItem className={isFirst && segments.length > 1 ? "hidden sm:block" : ""}>
                {segment.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={segment.href} className="max-w-[120px] truncate sm:max-w-none">
                      {segment.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="max-w-[150px] truncate sm:max-w-none">
                    {segment.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function formatLabel(segment: string): string {
  // Handle special cases
  const labels: Record<string, string> = {
    sessions: "Sessions",
    create: "Create",
    members: "Members",
    settings: "Settings",
    profile: "My Profile",
    roster: "Roster",
  }

  return labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
}
