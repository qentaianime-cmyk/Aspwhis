import { connectDB } from "@/lib/db"
import { redis } from "@/lib/redis"
import { verifyToken } from "@/lib/session"
import Room from "@/models/Room"
import { Elysia } from "elysia"
import { nanoid } from "nanoid"
import { authMiddleware } from "./auth"
import { z } from "zod"
import { Message, realtime } from "@/lib/realtime"

async function getUsernameFromCookieValue(authTokenValue: string | undefined): Promise<string | null> {
  if (!authTokenValue) return null
  const uuid = verifyToken(authTokenValue)
  if (!uuid) return null
  return redis.get<string>(`session:${uuid}`)
}

const rooms = new Elysia({ prefix: "/room" })
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`)
      return { ttl: ttl >= 0 ? ttl : -1 }
    },
    { query: z.object({ roomId: z.string() }) }
  )
  .delete(
    "/",
    async ({ auth }) => {
      await realtime.channel(auth.roomId).emit("chat.destroy", { isDestroyed: true })

      await Promise.allSettled([
        redis.del(auth.roomId),
        redis.del(`meta:${auth.roomId}`),
        redis.del(`messages:${auth.roomId}`),
        (async () => {
          try {
            await connectDB()
            await Room.deleteOne({ roomId: auth.roomId })
          } catch (err) {
            console.error("[room DELETE] MongoDB cleanup error:", err)
          }
        })(),
      ])
    },
    { query: z.object({ roomId: z.string() }) }
  )

const messages = new Elysia({ prefix: "/messages" })
  .use(authMiddleware)
  .post(
    "/",
    async ({ body, auth, cookie, set }) => {
      const { text } = body
      const { roomId } = auth

      const roomExists = await redis.exists(`meta:${roomId}`)

      if (!roomExists) {
        set.status = 400
        return { error: "Room does not exist" }
      }

      const sessionUsername = await getUsernameFromCookieValue(
        (cookie as Record<string, { value?: string }>)["authToken"]?.value
      )

      if (!sessionUsername) {
        set.status = 401
        return { error: "Unauthorized: no valid session" }
      }

      const message: Message = {
        id: nanoid(),
        sender: sessionUsername,
        text,
        timestamp: Date.now(),
        roomId,
      }

      await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token })
      await realtime.channel(roomId).emit("chat.message", message)

      const remaining = await redis.ttl(`meta:${roomId}`)

      if (remaining > 0) {
        await Promise.all([
          redis.expire(`messages:${roomId}`, remaining),
          redis.expire(`history:${roomId}`, remaining),
          redis.expire(roomId, remaining),
        ])
      }
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        text: z.string().max(1000),
      }),
    }
  )
  .get(
    "/",
    async ({ auth }) => {
      const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)

      return {
        messages: messages.map((m) => ({
          ...m,
          token: m.token === auth.token ? auth.token : undefined,
        })),
      }
    },
    { query: z.object({ roomId: z.string() }) }
  )

const app = new Elysia({ prefix: "/api" }).use(rooms).use(messages)

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch

export type App = typeof app
