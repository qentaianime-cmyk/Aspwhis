import { connectDB } from "@/lib/db"
import { redis } from "@/lib/redis"
import User from "@/models/User"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const token = req.cookies.get("authToken")?.value

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const username = await redis.get<string>(`session:${token}`)

  if (!username) {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 })
  }

  try {
    await connectDB()

    const user = await User.findByUsername(username)
    if (!user) {
      await redis.del(`session:${token}`)
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    return NextResponse.json(
      {
        username: user.username,
        followers: user.followers,
        following: user.following,
        createdAt: user.createdAt,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("[me]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
