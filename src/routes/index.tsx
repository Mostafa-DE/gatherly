import { createFileRoute, Link } from "@tanstack/react-router"
import { useSession, signOut } from "@/auth/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">
            Welcome to Gatherly
          </CardTitle>
          <CardDescription>
            A full-stack application built with TanStack Start, Drizzle, tRPC,
            and Better Auth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session?.user ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <p className="font-medium">{session.user.name}</p>
                <p className="text-sm text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
              <Button
                onClick={() => signOut()}
                variant="outline"
                className="w-full"
              >
                Sign out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/register">Create account</Link>
              </Button>
            </div>
          )}

          <div className="pt-4">
            <h3 className="mb-2 font-semibold">Tech Stack</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>TanStack Start (React 19)</li>
              <li>Tailwind CSS v4 + shadcn/ui</li>
              <li>Drizzle ORM + PostgreSQL</li>
              <li>tRPC + React Query</li>
              <li>Better Auth</li>
              <li>Jotai + Zod</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
