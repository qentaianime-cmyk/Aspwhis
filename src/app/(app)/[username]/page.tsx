"use client"

import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/custom/user-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

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

function ProfileAvatar({ username, isOwnProfile }: { username: string; isOwnProfile: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [key, setKey] = useState(0)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large — max 2 MB")
      return
    }

    setUploading(true)
    const toastId = toast.loading("Uploading avatar...")

    try {
      const fd = new FormData()
      fd.append("file", file)

      const res = await fetch("/api/avatar", {
        method: "POST",
        body: fd,
        credentials: "include",
      })

      if (res.ok) {
        setKey((k) => k + 1)
        toast.success("Avatar updated", { id: toastId })
      } else {
        toast.error("Upload failed — try again", { id: toastId })
      }
    } catch {
      toast.error("Upload failed — network error", { id: toastId })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="relative group shrink-0">
      <UserAvatar key={key} username={username} size="xl" />

      {isOwnProfile && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
          >
            {uploading ? (
              <span className="text-white text-xs">...</span>
            ) : (
              <span className="text-white text-xs">edit</span>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
        </>
      )}
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

  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [isNavigating, startTransition] = useTransition()
  const [expiresIn, setExpiresIn] = useState<string | null>("1h")
  const [showTimerPicker, setShowTimerPicker] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username),
    staleTime: 15000,
    retry: false,
  })

  // ✅ LOADING
  if (isLoading) {
    return (
      <div className="w-full max-w-sm px-4 py-16 text-center">
        <p className="text-muted-foreground text-sm animate-pulse">
          loading profile...
        </p>
      </div>
    )
  }

  // ✅ HARD GUARD (MOST IMPORTANT FIX)
  if (!profile) {
    return (
      <div className="w-full max-w-sm px-4 py-16 text-center">
        <p className="text-red-500 font-bold">USER NOT FOUND</p>
        <Link href="/search">
          <Button className="mt-3">find people</Button>
        </Link>
      </div>
    )
  }

  // ✅ NOW SAFE
  const canShowStartRoom =
    isAuthenticated &&
    !profile.isOwnProfile &&
    (profile.isFollowing || profile.isFollowedBy)

  const { mutate: toggleFollow, isPending: isFollowPending } = useMutation({
    mutationFn: async (isFollowing: boolean) => {
      const res = await fetch("/api/users/follow", {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      })
      if (!res.ok) throw new Error()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", username] })
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

      const data = await res.json()
      startTransition(() => {
        router.push(`/room/${data.roomId}`)
      })
    },
  })

  return (
    <div className="w-full max-w-sm px-4 py-8 space-y-4">
      <div className="border p-5 rounded-xl space-y-4">

        <div className="flex gap-4 items-center">
          <ProfileAvatar
            username={profile.username}
            isOwnProfile={profile.isOwnProfile}
          />

          <div>
            <h1 className="font-bold">@{profile.username}</h1>
            {profile.isOwnProfile && <p className="text-xs">this is you</p>}
          </div>
        </div>

        <div className="flex justify-between">
          <span>{profile.followerCount} followers</span>
          <span>{profile.followingCount} following</span>
        </div>

        {isAuthenticated && !profile.isOwnProfile && (
          <>
            <Button
              onClick={() => toggleFollow(profile.isFollowing)}
              disabled={isFollowPending}
            >
              {profile.isFollowing ? "unfollow" : "follow"}
            </Button>

            {canShowStartRoom && (
              <Button onClick={() => startRoom()}>
                start room
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
