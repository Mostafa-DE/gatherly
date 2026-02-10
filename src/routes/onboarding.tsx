import { createFileRoute, Navigate, useNavigate, Link } from "@tanstack/react-router"
import { useState, useEffect, useMemo } from "react"
import { useSession } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { InterestPicker } from "@/components/onboarding/interest-picker"
import { Calendar, Users, CalendarDays, Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { COUNTRIES } from "@/lib/countries"
import { getCitiesByCountry } from "@/lib/cities"
import { detectLocationFromTimezone } from "@/lib/timezone-location"

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
})

type Intent = "join" | "organize" | "both"

const INTENT_OPTIONS = [
  {
    value: "join" as Intent,
    icon: Users,
    title: "Join groups",
    description: "Find and participate in existing groups",
  },
  {
    value: "organize" as Intent,
    icon: CalendarDays,
    title: "Organize groups",
    description: "Create and manage your own groups",
  },
  {
    value: "both" as Intent,
    icon: Sparkles,
    title: "Both",
    description: "Join groups and organize your own",
  },
]

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
}))

function OnboardingPage() {
  const { data: session, isPending, refetch: refetchSession } = useSession()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [screen, setScreen] = useState<1 | 2>(1)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [country, setCountry] = useState("")
  const [city, setCity] = useState("")
  const [detectedTimezone, setDetectedTimezone] = useState("")
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [error, setError] = useState("")

  // Auto-detect country + city from timezone on mount
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setDetectedTimezone(tz)
      const location = detectLocationFromTimezone(tz)
      if (location.country) setCountry(location.country)
      if (location.city) setCity(location.city)
    } catch {
      // Fallback: leave empty
    }
  }, [])

  const completeMutation = trpc.onboarding.complete.useMutation({
    onSuccess: async () => {
      setScreen(2)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const saveInterestsMutation = trpc.onboarding.saveInterests.useMutation({
    onSuccess: () => {
      redirectByIntent()
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const redirectByIntent = async () => {
    // Refresh session atom without cookie cache so downstream guards read fresh onboarding state.
    await refetchSession({ query: { disableCookieCache: true } })
    utils.user.me.invalidate()
    if (intent === "organize") {
      navigate({ to: "/dashboard/groups/create" })
    } else {
      navigate({ to: "/dashboard" })
    }
  }

  // Auth guard
  if (!isPending && !session?.user) {
    return <Navigate to="/login" />
  }

  // Already onboarded guard
  if (!isPending && screen === 1 && session?.user?.onboardingCompleted) {
    return <Navigate to="/dashboard" />
  }

  // Loading
  if (isPending || !session?.user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  const handleScreen1Submit = () => {
    setError("")
    if (!intent) {
      setError("Please select what you'd like to do")
      return
    }
    if (!country) {
      setError("Please select your country")
      return
    }
    if (!city) {
      setError("Please select your city")
      return
    }

    completeMutation.mutate({
      intent,
      country,
      city,
      timezone: detectedTimezone || "UTC",
    })
  }

  const handleScreen2Submit = () => {
    setError("")
    saveInterestsMutation.mutate({ interestIds: selectedInterests })
  }

  const handleSkip = () => {
    redirectByIntent()
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
        </div>

        {screen === 1 ? (
          <Screen1
            intent={intent}
            setIntent={setIntent}
            country={country}
            setCountry={setCountry}
            city={city}
            setCity={setCity}
            error={error}
            isPending={completeMutation.isPending}
            onSubmit={handleScreen1Submit}
          />
        ) : (
          <Screen2
            selectedInterests={selectedInterests}
            setSelectedInterests={setSelectedInterests}
            error={error}
            isPending={saveInterestsMutation.isPending}
            onSubmit={handleScreen2Submit}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  )
}

type Screen1Props = {
  intent: Intent | null
  setIntent: (intent: Intent) => void
  country: string
  setCountry: (code: string) => void
  city: string
  setCity: (city: string) => void
  error: string
  isPending: boolean
  onSubmit: () => void
}

function Screen1({
  intent,
  setIntent,
  country,
  setCountry,
  city,
  setCity,
  error,
  isPending,
  onSubmit,
}: Screen1Props) {
  const cityOptions = useMemo(() => {
    if (!country) return []
    return getCitiesByCountry(country).map((c) => ({
      value: c.name,
      label: c.name,
    }))
  }, [country])

  const handleCountryChange = (code: string) => {
    setCountry(code)
    // Reset city when country changes (unless city is valid for new country)
    const citiesForCountry = getCitiesByCountry(code)
    if (!citiesForCountry.some((c) => c.name === city)) {
      setCity("")
    }
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome! Let's get you set up
        </h1>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Intent cards */}
        <div className="space-y-3">
          <p className="text-sm font-medium">What brings you to Gatherly?</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {INTENT_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = intent === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setIntent(option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors duration-150",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-transparent hover:bg-primary/5"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-semibold">{option.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Country dropdown */}
        <div className="space-y-2">
          <Label>Country</Label>
          <SearchableSelect
            value={country}
            onChange={handleCountryChange}
            options={COUNTRY_OPTIONS}
            placeholder="Select your country"
            searchPlaceholder="Search countries..."
            title="Select Country"
            emptyMessage="No countries found."
          />
        </div>

        {/* City dropdown */}
        <div className="space-y-2">
          <Label>City</Label>
          <SearchableSelect
            value={city}
            onChange={setCity}
            options={cityOptions}
            placeholder={country ? "Select your city" : "Select a country first"}
            searchPlaceholder="Search cities..."
            title="Select City"
            emptyMessage="No cities found for this country."
            disabled={!country}
          />
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={!intent || !country || !city || isPending}
          onClick={onSubmit}
        >
          {isPending ? "Saving..." : "Continue"}
        </Button>
      </div>
    </>
  )
}

type Screen2Props = {
  selectedInterests: string[]
  setSelectedInterests: (ids: string[]) => void
  error: string
  isPending: boolean
  onSubmit: () => void
  onSkip: () => void
}

function Screen2({
  selectedInterests,
  setSelectedInterests,
  error,
  isPending,
  onSubmit,
  onSkip,
}: Screen2Props) {
  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          What are you interested in?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Pick a few to help us find the right groups for you
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <InterestPicker
          selected={selectedInterests}
          onChange={setSelectedInterests}
          minRequired={1}
        />

        <Button
          className="w-full"
          size="lg"
          disabled={selectedInterests.length === 0 || isPending}
          onClick={onSubmit}
        >
          {isPending ? "Saving..." : "Continue"}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Skip for now
          </button>
        </div>
      </div>
    </>
  )
}
