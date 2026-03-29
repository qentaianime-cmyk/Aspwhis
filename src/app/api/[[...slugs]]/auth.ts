import { redis } from "@/lib/redis"
import { verifyToken } from "@/lib/session"
import Elysia from "elysia"

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

export const authMiddleware = new Elysia({ name: "auth" })
  .error({ AuthError })
  .onError(({ code, set }) => {
    if (code === "AuthError") {
      set.status = 401
      return { error: "Unauthorized" }
    }
  })
  .derive({ as: "scoped" }, async ({ query, cookie }) => {
    const roomId = query.roomId as string | undefined
    const xAuthToken = (cookie as Record<string, { value?: string }>)["x-auth-token"]?.value

    if (!roomId || !xAuthToken) {
      throw new AuthError("Missing roomId or token.")
    }

    const authTokenValue = (cookie as Record<string, { value?: string }>)["authToken"]?.value
    if (!authTokenValue) {
      throw new AuthError("No authenticated session.")
    }

    const uuid = verifyToken(authTokenValue)
    if (!uuid) {
      throw new AuthError("Invalid session token.")
    }

    const username = await redis.get<string>(`session:${uuid}`)
    if (!username) {
      throw new AuthError("Session expired or not found.")
    }

    const meta = await redis.hgetall<{
      connected: string[]
      participants?: string
    }>(`meta:${roomId}`)

    if (!meta) {
      throw new AuthError("Room not found.")
    }

    if (!meta.connected?.includes(xAuthToken)) {
      throw new AuthError("Invalid room token.")
    }

    let participants: string[] | null = null
    if (meta.participants) {
      try {
        participants = JSON.parse(meta.participants)
      } catch {
        participants = []
      }
    }

    if (participants === null || !participants.includes(username)) {
      throw new AuthError("Not a participant in this room.")
    }

    return { auth: { roomId, token: xAuthToken, connected: meta.connected, username } }
  })
