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
      connected: string[]
      createdAt: number
      maxConnected?: number
      participants?: string
    }>(`meta:${roomId}`)

    if (!meta) {
      return NextResponse.redirect(new URL("/?error=room-not-found", req.url))
    }

    let participants: string[] | null = null
    if (meta.participants) {
      try {
        participants = JSON.parse(meta.participants)
      } catch {
        participants = []
      }
    }

    if (participants === null) {
      return NextResponse.redirect(new URL("/?error=unauthorized", req.url))
    }

    if (!participants.includes(username)) {
      return NextResponse.redirect(new URL("/?error=unauthorized", req.url))
    }

    const existingToken = req.cookies.get("x-auth-token")?.value

    if (existingToken && meta.connected.includes(existingToken)) {
      return NextResponse.next()
    }

    const maxConnected = meta.maxConnected ?? 2

    if (meta.connected.length >= maxConnected) {
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
      connected: [...meta.connected, token],
    })

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/room/:path*"],
}
