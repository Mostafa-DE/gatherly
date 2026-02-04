import { Calendar, Users, MapPin, Check } from "lucide-react"

export function DashboardMockup() {
  return (
    <div className="mx-auto mt-16 max-w-4xl px-4">
      {/* Browser frame */}
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl">
        {/* Browser header */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <div className="ml-4 flex-1">
            <div className="mx-auto w-fit rounded-md bg-background/50 px-3 py-1 text-xs text-muted-foreground">
              app.gatherly.com/dashboard
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="bg-background p-4 sm:p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Weekly Basketball</h3>
              <p className="text-sm text-muted-foreground">3 upcoming sessions</p>
            </div>
            <button className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95">
              + New Session
            </button>
          </div>

          {/* Session cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Session 1 - Almost full */}
            <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Thursday, Feb 6</p>
                    <p className="text-sm text-muted-foreground">6:00 PM</p>
                  </div>
                </div>
                <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600">
                  2 spots left
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Downtown Sports Center</span>
              </div>

              {/* Capacity bar */}
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">8/10</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[80%] rounded-full bg-primary" />
                </div>
              </div>

              {/* Attendees */}
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500"].map((color, i) => (
                    <div
                      key={i}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs font-medium text-white ${color} transition-transform hover:scale-110 hover:z-10`}
                    >
                      {["JD", "MK", "AS", "RB"][i]}
                    </div>
                  ))}
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
                    +4
                  </div>
                </div>
                <button className="text-sm font-medium text-primary hover:underline transition-colors">
                  View roster →
                </button>
              </div>
            </div>

            {/* Session 2 - Few signups */}
            <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Thursday, Feb 13</p>
                    <p className="text-sm text-muted-foreground">6:00 PM</p>
                  </div>
                </div>
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  Open
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Downtown Sports Center</span>
              </div>

              {/* Capacity bar */}
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">3/10</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-[30%] rounded-full bg-primary" />
                </div>
              </div>

              {/* Attendees */}
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {["bg-pink-500", "bg-cyan-500", "bg-amber-500"].map((color, i) => (
                    <div
                      key={i}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs font-medium text-white ${color} transition-transform hover:scale-110 hover:z-10`}
                    >
                      {["KL", "TW", "NP"][i]}
                    </div>
                  ))}
                </div>
                <button className="text-sm font-medium text-primary hover:underline transition-colors">
                  View roster →
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl border bg-muted/30 p-4">
            <div className="text-center group">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary transition-transform group-hover:scale-110">
                <Users className="h-5 w-5" />
                <span>24</span>
              </div>
              <p className="text-xs text-muted-foreground">Total members</p>
            </div>
            <div className="text-center group">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary transition-transform group-hover:scale-110">
                <Calendar className="h-5 w-5" />
                <span>12</span>
              </div>
              <p className="text-xs text-muted-foreground">Sessions this month</p>
            </div>
            <div className="text-center group">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-500 transition-transform group-hover:scale-110">
                <Check className="h-5 w-5" />
                <span>89%</span>
              </div>
              <p className="text-xs text-muted-foreground">Attendance rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
