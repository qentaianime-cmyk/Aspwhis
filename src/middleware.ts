import { nanoid } from "nanoid"
import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { verifyTokenEdge } from "./lib/session-edge"

const AUTH_PROTECTED = ["/dashboard"]
const ROOM_PATTERN = /^\/room\/([^/]+)$/

async function getSessionUsername(req: NextRequest): Promise<string | null> {
  const signedToken = req.cookies.get("authToken")?.value
  if (!signedToken) return null

  const uuid = await verifyTokenEdge(signedToken)
  if (!uuid) return null

  const username = await redis.get<string>(`session:${uuid}`)
  return username ?? null
}

function parseParticipants(value: unknown): string[] | null {
  if (!value) return null
  // Upstash auto-parses JSON — value may already be an array
  if (Array.isArray(value)) return value as string[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function parseConnected(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value as string[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAuthProtected = AUTH_PROTECTED.some((p) => pathname.startsWith(p))
  const roomMatch = pathname.match(ROOM_PATTERN)

  if (isAuthProtected) {
    const username = await getSessionUsername(req)
    if (!username) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  if (roomMatch) {
    const roomId = roomMatch[1]

    const username = await getSessionUsername(req)
    if (!username) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }

    const meta = await redis.hgetall<{
      connected: unknown
      createdAt: number
      maxConnected?: number
      participants?: unknown
    }>(`meta:${roomId}`)

    if (!meta) {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    const participants = parseParticipants(meta.participants)

    if (participants === null) {
      return NextResponse.redirect(new URL("/?error=unauthorized", req.url))
    }

    if (!participants.includes(username)) {
      return NextResponse.redirect(new URL("/?error=unauthorized", req.url))
    }

    const connected = parseConnected(meta.connected)
    const existingToken = req.cookies.get("x-auth-token")?.value

    if (existingToken && connected.includes(existingToken)) {
      return NextResponse.next()
    }

    const maxConnected = meta.maxConnected ?? 2

    if (connected.length >= maxConnected) {
      return NextResponse.redirect(new URL("/?error=room-full", req.url))
    }

    const response = NextResponse.next()
    const token = nanoid()

    response.cookies.set("x-auth-token", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    })

    await redis.hset(`meta:${roomId}`, {
      connected: [...connected, token],
    })

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/room/:path*"],
}
