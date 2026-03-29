import { redis } from "@/lib/redis"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const token = req.cookies.get("authToken")?.value

  if (token) {
    await redis.del(`session:${token}`)
  }

  const response = NextResponse.json({ success: true }, { status: 200 })

  response.cookies.set("authToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })

  return response
}
