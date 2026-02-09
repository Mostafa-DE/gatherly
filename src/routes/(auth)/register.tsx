import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { signIn, signUp } from "@/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { Calendar, UserPlus, Check, X, Loader2 } from "lucide-react"
import { useUsernameAvailable } from "@/hooks/use-username-available"
import { navigateToRedirect } from "@/lib/redirect-utils"

type RegisterSearchParams = {
  redirect?: string
}

export const Route = createFileRoute("/(auth)/register")({
  component: RegisterPage,
  validateSearch: (search: Record<string, unknown>): RegisterSearchParams => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
})

const SIGNUP_GENERIC_ERROR =
  "We couldn't create your account. Please try again with different information."

function RegisterPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { isAvailable, isChecking, isValidFormat } = useUsernameAvailable(username)

  const handleNameChange = (value: string) => {
    setName(value)
    if (!username || username === generateUsername(name)) {
      setUsername(generateUsername(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    // Validate phone number
    if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      setError("Please enter a valid phone number")
      return
    }

    // Validate username
    if (!username || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(username) || username.length < 3) {
      setError("Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens")
      return
    }

    setLoading(true)

    try {
      const result = await signUp.email({
        email,
        password,
        name,
        phoneNumber,
        username,
      })

      if (result.error) {
        setError(SIGNUP_GENERIC_ERROR)
      } else {
        const signInResult = await signIn.email({
          email,
          password,
        })

        if (signInResult.error) {
          setError("Account created, but automatic sign-in failed. Please sign in.")
          navigate({ to: "/login", search: redirectTo ? { redirect: redirectTo } : {} })
          return
        }

        navigateToRedirect(navigate, redirectTo, "/dashboard")
      }
    } catch {
      setError(SIGNUP_GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      {/* Grid pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <Link to="/" className="flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">Gatherly</span>
          </Link>

          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary mb-4">
            <UserPlus className="mr-2 h-3.5 w-3.5" />
            Get started
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-center">
            Create your{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              account
            </span>
          </h1>
          <p className="mt-2 text-center text-muted-foreground">
            Join Gatherly and start organizing your sessions
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="bg-popover"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={30}
                className="bg-popover"
              />
              <div className="flex items-center gap-1.5">
                {username.length >= 3 && isChecking && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Checking...</span>
                  </>
                )}
                {username.length >= 3 && !isChecking && isAvailable === true && (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">Username available</span>
                  </>
                )}
                {username.length >= 3 && !isChecking && isAvailable === false && (
                  <>
                    <X className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive">Username already taken</span>
                  </>
                )}
                {username.length >= 3 && !isChecking && isAvailable === null && !isValidFormat && (
                  <span className="text-xs text-muted-foreground">
                    Must start with a letter, only lowercase letters, numbers, and hyphens
                  </span>
                )}
                {username.length < 3 && (
                  <span className="text-xs text-muted-foreground">
                    /{username || "username"}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-popover"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <PhoneInput
                id="phoneNumber"
                value={phoneNumber}
                onChange={setPhoneNumber}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-popover"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-popover"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters
            </p>

            <Button type="submit" className="w-full" size="lg" disabled={loading || isAvailable === false}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            search={redirectTo ? { redirect: redirectTo } : {}}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function generateUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
