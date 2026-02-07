import { Calendar, Users, MapPin, Check } from "lucide-react"

export function DashboardMockup() {
  return (
    <div className="mx-auto mt-14 max-w-4xl">
      <div className="overflow-hidden border border-border bg-card">
        {/* Browser header */}
        <div className="flex items-center gap-2 border-b border-border bg-popover px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-600" />
          </div>
          <div className="ml-4 flex-1">
            <div className="landing-body mx-auto w-fit rounded bg-background px-3 py-1 text-xs text-muted-foreground">
              app.gatherly.com/dashboard
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="bg-card p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="landing-body text-lg font-semibold text-foreground">Weekly Basketball</h3>
              <p className="landing-body text-sm text-muted-foreground">3 upcoming sessions</p>
            </div>
            <button className="landing-body rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              + New Session
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Session 1 */}
            <div className="rounded border border-border bg-popover p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--color-primary-subtle)]">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="landing-body font-medium text-foreground">Thursday, Feb 6</p>
                    <p className="landing-body text-sm text-muted-foreground">6:00 PM</p>
                  </div>
                </div>
                <span className="landing-body rounded bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600">
                  2 spots left
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="landing-body">Downtown Sports Center</span>
              </div>

              <div className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="landing-body text-muted-foreground">Capacity</span>
                  <span className="landing-body font-medium text-foreground">8/10</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div className="h-full w-[80%] rounded-full bg-primary" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500"].map((color, i) => (
                    <div
                      key={i}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-popover text-xs font-medium text-white ${color}`}
                    >
                      {["JD", "MK", "AS", "RB"][i]}
                    </div>
                  ))}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-popover bg-background text-xs font-medium text-muted-foreground">
                    +4
                  </div>
                </div>
                <span className="landing-body text-sm font-medium text-primary">View session →</span>
              </div>
            </div>

            {/* Session 2 */}
            <div className="rounded border border-border bg-popover p-4">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--color-primary-subtle)]">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="landing-body font-medium text-foreground">Thursday, Feb 13</p>
                    <p className="landing-body text-sm text-muted-foreground">6:00 PM</p>
                  </div>
                </div>
                <span className="landing-body rounded bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  Open
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="landing-body">Downtown Sports Center</span>
              </div>

              <div className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="landing-body text-muted-foreground">Capacity</span>
                  <span className="landing-body font-medium text-foreground">3/10</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div className="h-full w-[30%] rounded-full bg-primary" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {["bg-pink-500", "bg-cyan-500", "bg-amber-500"].map((color, i) => (
                    <div
                      key={i}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-popover text-xs font-medium text-white ${color}`}
                    >
                      {["KL", "TW", "NP"][i]}
                    </div>
                  ))}
                </div>
                <span className="landing-body text-sm font-medium text-primary">View session →</span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 rounded border border-border bg-background p-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                <Users className="h-5 w-5" />
                <span className="landing-body">24</span>
              </div>
              <p className="landing-body text-xs text-muted-foreground">Total members</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                <Calendar className="h-5 w-5" />
                <span className="landing-body">12</span>
              </div>
              <p className="landing-body text-xs text-muted-foreground">Sessions this month</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-600">
                <Check className="h-5 w-5" />
                <span className="landing-body">89%</span>
              </div>
              <p className="landing-body text-xs text-muted-foreground">Attendance rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
