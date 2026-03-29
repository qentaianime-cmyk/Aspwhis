import { connectDB } from "@/lib/db"
import { redis } from "@/lib/redis"
import { verifyToken } from "@/lib/session"
import Room from "@/models/Room"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import ChatPage from "./chat"

async function getSessionUsername(): Promise<string | null> {
  const cookieStore = await cookies()
  const signedToken = cookieStore.get("authToken")?.value
  if (!signedToken) return null
  const uuid = verifyToken(signedToken)
  if (!uuid) return null
  return redis.get<string>(`session:${uuid}`)
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params

  const username = await getSessionUsername()
  if (!username) {
    redirect(`/login?next=/room/${roomId}`)
  }

  await connectDB()

  const now = new Date()
  const room = await Room.findOne({
    roomId,
    participants: username,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean()

  if (!room) {
    redirect("/?error=unauthorized")
  }

  const otherParticipant = room!.participants.find((p) => p !== username) ?? null

  return <ChatPage otherParticipant={otherParticipant} viewerUsername={username} />
}
