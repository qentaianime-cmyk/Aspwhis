"use client"

import { AnimatedThemeToggler } from "@/components/custom/animated-theme-toggler"
import { ThemeColorToggle } from "@/components/custom/theme-color-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function Navbar() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
      queryClient.setQueryData(["auth", "me"], null)
      router.push("/login")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 max-w-5xl mx-auto gap-2">

        {/* Logo — always visible, never shrinks */}
        <Link href="/" className="shrink-0 flex items-center gap-1">
          <span className="text-primary font-mono font-bold text-base tracking-tight">
            {">"}<span className="text-foreground">aspzap</span>
          </span>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">

          {/* Theme color picker — fixed narrow width */}
          <div className="w-[52px] shrink-0">
            <ThemeColorToggle />
          </div>

          {/* Dark/light toggle */}
          <div className="shrink-0">
            <AnimatedThemeToggler />
          </div>

          {/* Search icon — only when authenticated */}
          {isAuthenticated && (
            <Link href="/search" title="Find people" className="shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="px-1.5 text-muted-foreground hover:text-foreground h-7 w-7"
              >
                <SearchIcon />
                <span className="sr-only">Search</span>
              </Button>
            </Link>
          )}

          {/* Auth section */}
          {isLoading ? (
            <div className="w-12 h-7 rounded-md bg-muted animate-pulse shrink-0" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              <Link href="/dashboard" className="min-w-0 shrink overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-mono text-primary px-1.5 h-7 text-xs max-w-[90px] overflow-hidden"
                >
                  <span className="truncate block">@{user!.username}</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="font-mono text-xs shrink-0 px-2 h-7"
              >
                {loggingOut ? "..." : "out"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-mono text-xs px-2 h-7">
                  login
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="sm" className="font-mono text-xs px-2 h-7">
                  join
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
