"use client"

import { Button } from "@/components/ui/button"
import { Loading } from "@/components/ui/loading"
import { useAuth } from "@/hooks/use-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface ActiveRoom {
  roomId: string
  otherParticipant: string | null
  expiresAt: string | null
  secondsLeft: number | null
  createdAt: string
}

function formatSecondsLeft(seconds: number): string {
  if (seconds <= 0) return "expiring..."
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function RoomCountdownBadge({ secondsLeft }: { secondsLeft: number | null }) {
  const [current, setCurrent] = useState(secondsLeft)

  useEffect(() => {
    setCurrent(secondsLeft)
    if (secondsLeft === null || secondsLeft <= 0) return
    const interval = setInterval(() => {
      setCurrent((prev) => (prev !== null && prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [secondsLeft])

  if (current === null) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
        no expiry
      </span>
    )
  }

  const isUrgent = current < 300
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
        isUrgent
          ? "bg-destructive/15 text-destructive"
          : "bg-primary/10 text-primary"
      }`}
    >
      {formatSecondsLeft(current)}
    </span>
  )
}

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?next=/dashboard")
    }
  }, [isLoading, isAuthenticated, router])

  const { data: roomsData } = useQuery({
    queryKey: ["active-rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms", { credentials: "include" })
      if (!res.ok) return { rooms: [] }
      return res.json() as Promise<{ rooms: ActiveRoom[] }>
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    queryClient.setQueryData(["auth", "me"], null)
    router.push("/login")
  }

  async function handleCopyUsername() {
    if (!user) return
    await navigator.clipboard.writeText(`@${user.username}`)
  }

  if (isLoading) {
    return <Loading message="Loading your profile..." />
  }

  if (!user) return null

  const activeRooms = roomsData?.rooms ?? []

  return (
    <div className="w-full max-w-md space-y-4 px-4 py-8">
      <div className="border border-border rounded-2xl bg-card/50 p-6 backdrop-blur-md space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              your handle
            </p>
            <h1 className="text-2xl font-bold font-mono text-primary tracking-tight">
              @{user.username}
            </h1>
          </div>
          <button
            onClick={handleCopyUsername}
            title="Copy @handle"
            className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/${user.username}`}
            className="rounded-xl border border-border bg-background px-4 py-3 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <p className="text-2xl font-bold font-mono text-foreground">
              {user.followers.length}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">followers</p>
          </Link>
          <Link
            href={`/${user.username}`}
            className="rounded-xl border border-border bg-background px-4 py-3 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <p className="text-2xl font-bold font-mono text-foreground">
              {user.following.length}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">following</p>
          </Link>
        </div>

        <div className="pt-1 space-y-3">
          <Link href="/search" className="block">
            <Button variant="outline" size="sm" className="w-full font-mono text-xs">
              find people & start a room
            </Button>
          </Link>
          <p className="text-center text-[10px] text-muted-foreground font-mono">
            visit someone's profile to start a private room
          </p>

          <Button
            variant="ghost"
            size="sm"
            className="w-full font-mono text-xs text-muted-foreground"
            onClick={handleLogout}
          >
            sign out
          </Button>
        </div>
      </div>

      {activeRooms.length > 0 && (
        <div className="border border-border rounded-2xl bg-card/50 p-5 backdrop-blur-md space-y-3">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            active rooms
          </p>
          <div className="space-y-2">
            {activeRooms.map((room) => (
              <Link
                key={room.roomId}
                href={`/room/${room.roomId}`}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-primary/60 font-mono text-xs">@</span>
                  <span className="font-mono text-sm text-foreground">
                    {room.otherParticipant ?? "unknown"}
                  </span>
                </div>
                <RoomCountdownBadge secondsLeft={room.secondsLeft} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {user.following.length > 0 && (
        <div className="border border-border rounded-2xl bg-card/50 p-5 backdrop-blur-md space-y-3">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            following
          </p>
          <div className="flex flex-wrap gap-2">
            {user.following.map((uname) => (
              <Link
                key={uname}
                href={`/${uname}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-mono text-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <span className="text-primary/60">@</span>{uname}
              </Link>
            ))}
          </div>
        </div>
      )}

      {user.followers.length > 0 && (
        <div className="border border-border rounded-2xl bg-card/50 p-5 backdrop-blur-md space-y-3">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            followers
          </p>
          <div className="flex flex-wrap gap-2">
            {user.followers.map((uname) => (
              <Link
                key={uname}
                href={`/${uname}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-mono text-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <span className="text-primary/60">@</span>{uname}
              </Link>
            ))}
          </div>
        </div>
      )}

      {user.following.length === 0 && user.followers.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground font-mono">
            no connections yet —{" "}
            <Link href="/search" className="text-primary hover:underline">
              find people to follow
            </Link>
          </p>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground font-mono">
        member since{" "}
        {new Date(user.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  )
}
