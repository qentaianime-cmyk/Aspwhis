"use client"

import { UserAvatar } from "@/components/custom/user-avatar"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

interface Stats {
  totalUsers: number
  totalRooms: number
  activeRooms: number
  roomsToday: number
}

interface AdminUser {
  username: string
  followers: number
  following: number
  joinedAt: string
  roomCount: number
  banned: boolean
}

interface AdminRoom {
  roomId: string
  participants: string[]
  createdAt: number
  ttl: number
  messageCount: number
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 bg-card/50 backdrop-blur-sm space-y-1",
      accent ? "border-primary/40" : "border-border"
    )}>
      <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className={cn("text-3xl font-bold font-mono", accent ? "text-primary" : "text-foreground")}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function formatTtl(ttl: number) {
  if (ttl < 0) return "∞"
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`
  return `${Math.floor(ttl / 86400)}d`
}

type Tab = "overview" | "users" | "rooms"

export default function AdminPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [search, setSearch] = useState("")
  const [loadingData, setLoadingData] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch("/api/admin?section=stats", { credentials: "include" })
      if (res.ok) setStats(await res.json())
    } finally { setLoadingData(false) }
  }, [])

  const fetchUsers = useCallback(async (q = "") => {
    setLoadingData(true)
    try {
      const res = await fetch(`/api/admin?section=users&q=${encodeURIComponent(q)}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users ?? [])
        setTotalUsers(data.total ?? 0)
      }
    } finally { setLoadingData(false) }
  }, [])

  const fetchRooms = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch("/api/admin?section=rooms", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setRooms(data.rooms ?? [])
      }
    } finally { setLoadingData(false) }
  }, [])

  useEffect(() => {
    if (tab === "overview") fetchStats()
    if (tab === "users") fetchUsers(search)
    if (tab === "rooms") fetchRooms()
  }, [tab, fetchStats, fetchUsers, fetchRooms, search])

  async function doAction(action: string, payload: Record<string, string>) {
    const res = await fetch("/api/admin", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    })
    if (res.ok) {
      setActionMsg(`✓ ${action} successful`)
      setTimeout(() => setActionMsg(null), 3000)
      if (tab === "users") fetchUsers(search)
      if (tab === "rooms") fetchRooms()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "users", label: "Users" },
    { key: "rooms", label: "Rooms" },
  ]

  return (
    <div className="w-full max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-mono text-foreground">
            <span className="text-primary">{">"}</span> admin panel
          </h1>
          <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">
            logged in as @{user?.username}
          </p>
        </div>
        {actionMsg && (
          <span className="text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full">
            {actionMsg}
          </span>
        )}
      </div>

      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-mono font-medium transition-all",
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {loadingData && !stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="total users" value={stats.totalUsers} accent />
              <StatCard label="active rooms" value={stats.activeRooms} accent />
              <StatCard label="rooms created" value={stats.totalRooms} />
              <StatCard label="rooms today" value={stats.roomsToday} />
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground/60">quick actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTab("users")}
                className="text-xs font-mono px-4 py-2 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                manage users →
              </button>
              <button
                onClick={() => setTab("rooms")}
                className="text-xs font-mono px-4 py-2 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                monitor rooms →
              </button>
              <button
                onClick={fetchStats}
                className="text-xs font-mono px-4 py-2 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                refresh stats
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-xs rounded-xl border border-border bg-background px-4 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-xs font-mono text-muted-foreground/50">{totalUsers} users</span>
          </div>

          <div className="rounded-2xl border border-border overflow-hidden">
            {loadingData ? (
              <div className="space-y-0 divide-y divide-border/50">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 h-3 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-muted-foreground/40">
                no users found
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {users.map((u) => (
                  <div key={u.username} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <UserAvatar username={u.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-medium text-foreground">
                          @{u.username}
                        </span>
                        {u.banned && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
                            banned
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/50">
                        {u.followers} followers · {u.following} following · {u.roomCount} rooms · joined {format(new Date(u.joinedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {u.banned ? (
                        <button
                          onClick={() => doAction("unban", { username: u.username })}
                          className="text-[10px] font-mono px-2.5 py-1 rounded-lg border border-border bg-background hover:border-green-500/50 hover:text-green-500 transition-colors"
                        >
                          unban
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`Ban @${u.username}?`)) doAction("ban", { username: u.username })
                          }}
                          className="text-[10px] font-mono px-2.5 py-1 rounded-lg border border-border bg-background hover:border-destructive/50 hover:text-destructive transition-colors"
                        >
                          ban
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/${u.username}`)}
                        className="text-[10px] font-mono px-2.5 py-1 rounded-lg border border-border bg-background hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        view
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "rooms" && (
        <div className="space-y-4">
          <p className="text-xs font-mono text-muted-foreground/50">
            {rooms.length} active room{rooms.length !== 1 ? "s" : ""} in Redis
          </p>

          {loadingData && rooms.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="rounded-2xl border border-border py-10 text-center">
              <p className="text-xs font-mono text-muted-foreground/40">no active rooms</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.roomId}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground/40">room</span>
                      <span className="text-xs font-mono text-foreground font-medium truncate max-w-[120px]">
                        {room.roomId}
                      </span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                        room.ttl < 0 ? "bg-muted text-muted-foreground" : room.ttl < 300 ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"
                      )}>
                        {formatTtl(room.ttl)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {room.participants.map((p) => (
                        <div key={p} className="flex items-center gap-1">
                          <UserAvatar username={p} size="xs" />
                          <span className="text-[10px] font-mono text-muted-foreground">@{p}</span>
                        </div>
                      ))}
                      <span className="text-[10px] font-mono text-muted-foreground/40">
                        · {room.messageCount} msg{room.messageCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Destroy room ${room.roomId}?`)) {
                        doAction("destroy_room", { roomId: room.roomId })
                      }
                    }}
                    className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-lg border border-border bg-background hover:border-destructive/50 hover:text-destructive transition-colors"
                  >
                    destroy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
