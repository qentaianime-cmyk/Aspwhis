"use client"

import { Button } from "@/components/ui/button"
import { Loading } from "@/components/ui/loading"
import { useAuth } from "@/hooks/use-auth"
import { client } from "@/lib/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isNavigating, startTransition] = useTransition()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login?next=/dashboard")
    }
  }, [isLoading, isAuthenticated, router])

  const { mutate: createRoom, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await client.room.create.post({ maxConnected: 2 })
      if (res.status === 200 && res.data?.roomId) {
        startTransition(() => {
          router.push(`/room/${res.data!.roomId}`)
        })
      }
    },
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

  return (
    <div className="w-full max-w-md space-y-6 px-4 py-8">
      {(isCreating || isNavigating) && (
        <Loading overlay message="Creating room..." />
      )}

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/u/${user.username}/followers`}
            className="rounded-xl border border-border bg-background px-4 py-3 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <p className="text-2xl font-bold font-mono text-foreground">
              {user.followers.length}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">followers</p>
          </Link>
          <Link
            href={`/u/${user.username}/following`}
            className="rounded-xl border border-border bg-background px-4 py-3 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <p className="text-2xl font-bold font-mono text-foreground">
              {user.following.length}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">following</p>
          </Link>
        </div>

        <div className="pt-1 space-y-3">
          <Button
            onClick={() => createRoom()}
            className="w-full font-mono"
            size="lg"
            disabled={isCreating || isNavigating}
          >
            {isCreating || isNavigating ? "CREATING..." : "+ CREATE SECURE ROOM"}
          </Button>

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
