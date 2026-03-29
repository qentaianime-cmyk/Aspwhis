"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useTransition } from "react"

interface ProfileData {
  username: string
  followerCount: number
  followingCount: number
  isFollowing: boolean
  isFollowedBy: boolean
  isMutual: boolean
  isOwnProfile: boolean
}

async function fetchProfile(username: string): Promise<ProfileData | null> {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
    credentials: "include",
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json()
}

function InitialsAvatar({ username }: { username: string }) {
  const initials = username.slice(0, 2).toUpperCase()
  const colors = [
    "bg-red-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-yellow-500",
  ]
  const color = colors[username.charCodeAt(0) % colors.length]

  return (
    <div
      className={`${color} w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl font-mono`}
    >
      {initials}
    </div>
  )
}

const TIMER_OPTIONS = [
  { label: "1 hour", value: "1h" },
  { label: "6 hours", value: "6h" },
  { label: "24 hours", value: "24h" },
  { label: "no expiry", value: null },
]

export default function ProfilePage() {
  const params = useParams()
  const username = (params.username as string).toLowerCase()
  const { user: viewer, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()
  const [expiresIn, setExpiresIn] = useState<string | null>("1h")
  const [showTimerPicker, setShowTimerPicker] = useState(false)

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username),
    staleTime: 15_000,
    retry: false,
  })

  const { mutate: toggleFollow, isPending: isFollowPending } = useMutation({
    mutationFn: async (isFollowing: boolean) => {
      const res = await fetch("/api/users/follow", {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      })
      if (!res.ok) throw new Error("Failed to toggle follow")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", username] })
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
    },
  })

  const { mutate: startRoom, isPending: isStartingRoom } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ participantUsername: username, expiresIn }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to create room")
      }
      const { roomId } = await res.json()
      startTransition(() => {
        router.push(`/room/${roomId}`)
      })
    },
  })

  if (isLoading) {
    return (
      <div className="w-full max-w-sm px-4 py-16 text-center">
        <p className="text-muted-foreground font-mono text-sm animate-pulse">loading profile...</p>
      </div>
    )
  }

  if (error || profile === null) {
    return (
      <div className="w-full max-w-sm px-4 py-16 text-center space-y-3">
        <p className="text-destructive font-mono font-bold">USER NOT FOUND</p>
        <p className="text-muted-foreground text-sm">@{username} doesn't exist on aspzap.</p>
        <Link href="/search">
          <Button variant="outline" size="sm" className="font-mono text-xs mt-2">
            find people
          </Button>
        </Link>
      </div>
    )
  }

  const canShowStartRoom =
    isAuthenticated && !profile.isOwnProfile && (profile.isFollowing || profile.isFollowedBy)

  return (
    <div className="w-full max-w-sm space-y-4 px-4 py-8">
      {(isStartingRoom || isNavigating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="font-mono text-sm text-muted-foreground animate-pulse">creating room...</p>
        </div>
      )}

      <div className="border border-border rounded-2xl bg-card/50 p-6 backdrop-blur-md space-y-5">
        <div className="flex items-center gap-4">
          <InitialsAvatar username={profile.username} />
          <div>
            <h1 className="text-xl font-bold font-mono text-foreground">
              @{profile.username}
            </h1>
            {profile.isOwnProfile && (
              <p className="text-xs text-muted-foreground font-mono">this is you</p>
            )}
            {profile.isMutual && !profile.isOwnProfile && (
              <p className="text-xs text-primary font-mono">mutual follow</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-center">
            <p className="text-2xl font-bold font-mono text-foreground">
              {profile.followerCount}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">followers</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3 text-center">
            <p className="text-2xl font-bold font-mono text-foreground">
              {profile.followingCount}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">following</p>
          </div>
        </div>

        {isAuthenticated && !profile.isOwnProfile && (
          <div className="space-y-2">
            <Button
              onClick={() => toggleFollow(profile.isFollowing)}
              disabled={isFollowPending}
              variant={profile.isFollowing ? "outline" : "default"}
              className="w-full font-mono"
            >
              {isFollowPending
                ? "..."
                : profile.isFollowing
                ? "unfollow"
                : "follow"}
            </Button>

            {canShowStartRoom && (
              <>
                {showTimerPicker ? (
                  <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground font-mono">room self-destructs in</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TIMER_OPTIONS.map((opt) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => setExpiresIn(opt.value)}
                          className={`rounded-lg border px-3 py-2 text-xs font-mono transition-colors ${
                            expiresIn === opt.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => startRoom()}
                        disabled={isStartingRoom || isNavigating}
                        className="flex-1 font-mono text-xs"
                        size="sm"
                      >
                        {isStartingRoom || isNavigating ? "creating..." : "create room"}
                      </Button>
                      <Button
                        onClick={() => setShowTimerPicker(false)}
                        variant="ghost"
                        size="sm"
                        className="font-mono text-xs"
                      >
                        cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowTimerPicker(true)}
                    variant="outline"
                    className="w-full font-mono text-primary border-primary/40 hover:bg-primary/5"
                  >
                    start private room
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {profile.isOwnProfile && (
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="w-full font-mono text-xs">
              go to your dashboard
            </Button>
          </Link>
        )}

        {!isAuthenticated && (
          <Link href="/login">
            <Button variant="outline" size="sm" className="w-full font-mono text-xs">
              sign in to follow
            </Button>
          </Link>
        )}
      </div>

      <div className="text-center">
        <Link href="/search" className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
          ← find more people
        </Link>
      </div>
    </div>
  )
}
