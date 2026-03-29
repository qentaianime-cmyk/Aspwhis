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
      width="16"
      height="16"
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
      <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="text-primary font-mono font-bold text-lg tracking-tight">
            {">"}<span className="text-foreground">aspzap</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeColorToggle />
          <AnimatedThemeToggler />

          {isAuthenticated && (
            <Link href="/search" title="Find people">
              <Button variant="ghost" size="sm" className="px-2 text-muted-foreground hover:text-foreground">
                <SearchIcon />
                <span className="sr-only">Search</span>
              </Button>
            </Link>
          )}

          {isLoading ? (
            <div className="w-20 h-8 rounded-md bg-muted animate-pulse" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="font-mono text-primary px-2">
                  @{user!.username}
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={loggingOut}
                className="font-mono text-xs"
              >
                {loggingOut ? "..." : "logout"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-mono text-xs">
                  login
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" size="sm" className="font-mono text-xs">
                  register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
