import { connectDB } from "@/lib/db"
import { redis } from "@/lib/redis"
import { verifyToken } from "@/lib/session"
import Room from "@/models/Room"
import { Elysia } from "elysia"
import { nanoid } from "nanoid"
import { authMiddleware } from "./auth"
import { z } from "zod"
import { Message, realtime } from "@/lib/realtime"

const ROOM_TTL_SECONDS = 60 * 10
const DEFAULT_MAX_CONNECTED = 2

async function getUsernameFromCookieValue(authTokenValue: string | undefined): Promise<string | null> {
  if (!authTokenValue) return null
  const uuid = verifyToken(authTokenValue)
  if (!uuid) return null
  return redis.get<string>(`session:${uuid}`)
}

const rooms = new Elysia({ prefix: "/room" })
  .post(
    "/create",
    async ({ body }) => {
      const roomId = nanoid()
      const maxConnected = body?.maxConnected ?? DEFAULT_MAX_CONNECTED

      await redis.hset(`meta:${roomId}`, {
        connected: [],
        createdAt: Date.now(),
        maxConnected,
      })

      await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

      return { roomId }
    },
    {
      body: z.object({
        maxConnected: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(DEFAULT_MAX_CONNECTED),
      }),
    }
  )
  .use(authMiddleware)
  .get(
    "/ttl",
    async ({ auth }) => {
      const ttl = await redis.ttl(`meta:${auth.roomId}`)
      return { ttl: ttl > 0 ? ttl : 0 }
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
    async ({ body, auth, cookie }) => {
      const { text } = body
      const { roomId } = auth

      const roomExists = await redis.exists(`meta:${roomId}`)

      if (!roomExists) {
        throw new Error("Room does not exist")
      }

      const sessionUsername = await getUsernameFromCookieValue(
        (cookie as Record<string, { value?: string }>)["authToken"]?.value
      )
      const sender = sessionUsername ?? body.sender

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      }

      await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token })
      await realtime.channel(roomId).emit("chat.message", message)

      const remaining = await redis.ttl(`meta:${roomId}`)

      await redis.expire(`messages:${roomId}`, remaining)
      await redis.expire(`history:${roomId}`, remaining)
      await redis.expire(roomId, remaining)
    },
    {
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100).optional().default(""),
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
