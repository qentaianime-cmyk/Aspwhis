"use client"

import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Loading } from "@/components/ui/loading"

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (target === 0) return
    const start = performance.now()
    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return count
}

function AnimatedCounter({ value, label }: { value: number; label: string }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = useCountUp(visible ? value : 0)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl font-bold font-mono text-foreground">
        {count.toLocaleString()}
        <span className="text-primary">+</span>
      </div>
      <div className="text-xs font-mono text-muted-foreground/60 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function RevealOnScroll({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(className, "transition-all duration-700")}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
      }}
    >
      {children}
    </div>
  )
}

function FloatingOrb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute rounded-full blur-3xl opacity-20 pointer-events-none",
        className
      )}
    />
  )
}

const FEATURES = [
  {
    icon: "🔐",
    title: "Participant-only access",
    desc: "Only invited participants can enter. Zero bystanders, zero leaks.",
  },
  {
    icon: "💣",
    title: "Self-destructing rooms",
    desc: "Set a timer — 1h, 6h, 24h — or keep it forever. Room destroys itself on cue.",
  },
  {
    icon: "⚡",
    title: "Real-time everything",
    desc: "Typing indicators, presence badges, live message delivery. No refresh needed.",
  },
  {
    icon: "🖼️",
    title: "Ephemeral media",
    desc: "Share images that disappear with the room. Nothing lingers on any server.",
  },
  {
    icon: "🌐",
    title: "Link previews",
    desc: "URLs auto-expand into rich cards. Share a link, see the preview instantly.",
  },
  {
    icon: "👥",
    title: "Social graph",
    desc: "Follow people, get followed. Rooms only between people who know each other.",
  },
]

const STEPS = [
  { num: "01", title: "Create an account", desc: "Choose your handle. No email, no phone, just a username." },
  { num: "02", title: "Follow someone", desc: "Find a person and follow them. They follow back — connection made." },
  { num: "03", title: "Start a private room", desc: "Visit their profile, hit start room, pick an expiry. That's it." },
]

const Page = () => (
  <Suspense>
    <LandingPage />
  </Suspense>
)

export default Page

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isNavigating, startTransition] = useTransition()
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const wasDestroyed = searchParams.get("destroyed") === "true"
  const error = searchParams.get("error")
  const searchParamsString = searchParams.toString()

  useEffect(() => {
    if (!searchParamsString) return
    timerRef.current = setTimeout(() => router.replace("/"), 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [searchParamsString, router])

  return (
    <div className="relative overflow-hidden">
      {isNavigating && <Loading overlay message="Navigating..." />}

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 pt-8 pb-16 overflow-hidden">
        {/* Animated orbs */}
        <FloatingOrb className="w-[600px] h-[600px] bg-primary top-[-10%] left-[-20%] animate-[orbFloat_8s_ease-in-out_infinite]" />
        <FloatingOrb className="w-[400px] h-[400px] bg-primary/70 bottom-[-5%] right-[-15%] animate-[orbFloat_6s_ease-in-out_infinite_reverse]" />
        <FloatingOrb className="w-[200px] h-[200px] bg-primary/50 top-[40%] left-[60%] animate-[orbFloat_10s_ease-in-out_infinite_1s]" />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] pointer-events-none" />

        {/* Toasts */}
        {(wasDestroyed || error) && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-[slideDown_0.3s_ease-out]"
            onClick={() => router.replace("/")}
          >
            <div className="relative overflow-hidden bg-destructive/15 border border-destructive/50 px-5 py-3 rounded-2xl text-center cursor-pointer hover:bg-destructive/20 transition-colors">
              <p className="text-destructive text-xs font-bold font-mono">
                {wasDestroyed ? "ROOM DESTROYED — all messages deleted" :
                  error === "room-not-found" ? "ROOM NOT FOUND — expired or never existed" :
                    error === "unauthorized" ? "ACCESS DENIED — not a participant" :
                      "ERROR"}
              </p>
              <div className="warning-progress-bar mt-1" />
            </div>
          </div>
        )}

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6">
          <div
            className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary"
            style={{ animation: "fadeUp 0.6s ease-out" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            private · ephemeral · real-time
          </div>

          <h1
            className="text-5xl sm:text-7xl font-bold font-mono tracking-tight"
            style={{ animation: "fadeUp 0.7s ease-out 0.1s both" }}
          >
            <span className="text-primary" style={{
              filter: "drop-shadow(0 0 24px oklch(var(--primary) / 0.5))",
            }}>{">"}</span>
            <span className="text-foreground">aspzap</span>
          </h1>

          <p
            className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-md mx-auto"
            style={{ animation: "fadeUp 0.7s ease-out 0.2s both" }}
          >
            Private rooms that self-destruct. Real-time chat with people you actually know.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            style={{ animation: "fadeUp 0.7s ease-out 0.3s both" }}
          >
            {isLoading ? null : isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  className="font-mono px-8 text-base rounded-2xl"
                  onClick={() => startTransition(() => router.push("/dashboard"))}
                >
                  go to dashboard →
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="font-mono text-sm rounded-2xl"
                  onClick={() => startTransition(() => router.push("/search"))}
                >
                  find people
                </Button>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="font-mono px-8 text-base rounded-2xl w-full sm:w-auto">
                    get started — free
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="font-mono text-sm rounded-2xl w-full sm:w-auto">
                    sign in
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-muted/20 py-12 px-4">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-8">
          <AnimatedCounter value={0} label="users" />
          <AnimatedCounter value={0} label="rooms created" />
          <AnimatedCounter value={0} label="messages sent" />
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 max-w-4xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-12 space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-primary">features</p>
            <h2 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">
              Built for privacy. Engineered for speed.
            </h2>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <RevealOnScroll key={f.title} delay={i * 80}>
              <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-5 space-y-3 hover:border-primary/40 hover:bg-card/60 transition-all group h-full">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="font-bold font-mono text-sm text-foreground group-hover:text-primary transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-muted/10 border-y border-border">
        <div className="max-w-3xl mx-auto space-y-12">
          <RevealOnScroll>
            <div className="text-center space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-primary">how it works</p>
              <h2 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">
                Three steps to a private chat.
              </h2>
            </div>
          </RevealOnScroll>

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <RevealOnScroll key={step.num} delay={i * 120}>
                <div className="flex gap-5 items-start rounded-2xl border border-border bg-card/40 p-5 hover:border-primary/30 transition-colors group">
                  <span className="text-3xl font-black font-mono text-primary/20 group-hover:text-primary/40 transition-colors shrink-0 leading-none pt-1">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="font-bold font-mono text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-4 overflow-hidden">
        <FloatingOrb className="w-[500px] h-[500px] bg-primary left-[50%] top-[50%] -translate-x-1/2 -translate-y-1/2 opacity-10 animate-[orbFloat_7s_ease-in-out_infinite]" />
        <RevealOnScroll>
          <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold font-mono text-foreground">
              Ready to start<br />
              <span className="text-primary">your first room?</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              No email required. No phone number. Just pick a handle and go.
            </p>
            {!isAuthenticated && (
              <Link href="/register">
                <Button size="lg" className="font-mono px-10 text-base rounded-2xl">
                  create account — free
                </Button>
              </Link>
            )}
            {isAuthenticated && (
              <Button
                size="lg"
                className="font-mono px-10 text-base rounded-2xl"
                onClick={() => startTransition(() => router.push("/dashboard"))}
              >
                go to dashboard →
              </Button>
            )}
          </div>
        </RevealOnScroll>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center">
        <p className="text-xs font-mono text-muted-foreground/40">
          <span className="text-primary">{">"}</span>aspzap — private, self-destructing chat
        </p>
      </footer>
    </div>
  )
}
