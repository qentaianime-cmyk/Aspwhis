# aspzap — Private Chat Platform

## Overview
A private, self-destructing realtime chat platform built with Next.js 16, MongoDB, Upstash Redis, and Upstash Realtime. Users create accounts, build a social graph (followers/following), and spin up ephemeral chat rooms.

## Architecture
- **Framework**: Next.js 16 with Turbopack (App Router)
- **Runtime**: Bun
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Backend**: Elysia.js API via Next.js API routes (`src/app/api/[[...slugs]]`)
- **Realtime**: Upstash Realtime
- **Database**: MongoDB (Mongoose) for users/rooms + Upstash Redis for sessions/rate-limiting/room metadata
- **Auth**: HMAC-SHA256 signed session tokens in httpOnly cookies; verified by middleware and API routes

## Social API Endpoints
- `GET /api/users/[username]` — public profile (follower/following counts, isFollowing, isMutual)
- `POST /api/users/follow` — follow a user (authenticated)
- `DELETE /api/users/follow` — unfollow a user (authenticated)
- `GET /api/users/search?q=` — username prefix search, up to 20 results (authenticated)

## Key Files
- `src/app/layout.tsx` — Root layout with Google Fonts registry
- `src/app/(app)/layout.tsx` — App shell with Navbar
- `src/app/(app)/page.tsx` — Lobby page (create room)
- `src/app/(app)/login/page.tsx` — Login form
- `src/app/(app)/register/page.tsx` — Registration form
- `src/app/(app)/dashboard/page.tsx` — User dashboard (protected, with social section)
- `src/app/(app)/[username]/page.tsx` — Public profile page (follow/unfollow, start room)
- `src/app/(app)/search/page.tsx` — User search with debounced input
- `src/app/room/[id]/page.tsx` — Chat room page
- `src/app/api/[[...slugs]]/route.ts` — Elysia backend (rooms, messages)
- `src/app/api/auth/*/route.ts` — Auth REST endpoints (register/login/logout/me)
- `src/middleware.ts` — Next.js middleware: auth guard + room membership proxy
- `src/lib/db.ts` — Mongoose singleton connection
- `src/lib/session.ts` — HMAC-signed token helpers (Node.js crypto, for API routes)
- `src/lib/session-edge.ts` — HMAC-signed token helpers (Web Crypto API, for Edge middleware)
- `src/lib/rate-limit.ts` — Redis sliding-window rate limiter
- `src/lib/redis.ts` — Upstash Redis client
- `src/hooks/use-auth.ts` — React Query auth hook (`/api/auth/me`)
- `src/hooks/use-username.ts` — Username hook (wraps useAuth)
- `src/models/User.ts` — Mongoose User schema
- `src/models/Room.ts` — Mongoose Room schema

## Environment Variables (Required)
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token
- `MONGODB_URI` — MongoDB connection string
- `SESSION_SECRET` — Min 32-char secret for HMAC session signing

## Replit Migration Notes
1. **Port/Host**: Dev and start scripts updated to `-p 5000 -H 0.0.0.0`
2. **PostCSS/Tailwind v4 fix**: Added `@source "../../src"` in `globals.css` and `base: "./src"` in `postcss.config.mjs` — do NOT remove, prevents 100%+ CPU spin
3. **React Compiler**: Removed `reactCompiler: true` from `next.config.ts`
4. **Workflow**: Configured to run `bun run dev` on port 5000

## Running
```bash
bun run dev    # Development (port 5000)
bun run build  # Build
bun run start  # Production (port 5000)
```
