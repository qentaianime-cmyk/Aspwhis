# Private Chat - Next.js 16 Realtime Chat App

## Overview
A private, self-destructing realtime chat room app built with Next.js 16, Upstash Redis, and Upstash Realtime.

## Architecture
- **Framework**: Next.js 16 with Turbopack (App Router)
- **Runtime**: Bun
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Backend**: Elysia.js API via Next.js API routes (`src/app/api/[[...slugs]]`)
- **Realtime**: Upstash Realtime
- **Database**: Upstash Redis
- **Auth**: Cookie-based token auth via Next.js middleware (`src/proxy.ts`)

## Key Files
- `src/app/layout.tsx` — Root layout with Google Fonts registry
- `src/app/(app)/page.tsx` — Lobby page (client component)
- `src/app/room/[id]/page.tsx` — Chat room page
- `src/app/api/[[...slugs]]/route.ts` — Elysia backend API
- `src/app/api/realtime/route.ts` — Upstash Realtime handler
- `src/lib/redis.ts` — Redis client (uses env vars)
- `src/lib/realtime.ts` — Realtime schema definition
- `src/proxy.ts` — Next.js middleware for room auth

## Environment Variables (Required)
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token

## Replit Migration Notes
The following changes were made to run on Replit:

1. **Port/Host**: Dev and start scripts updated to `-p 5000 -H 0.0.0.0`
2. **PostCSS/Tailwind v4 fix**: Added `@source "../../src"` in `globals.css` and `base: "./src"` in `postcss.config.mjs` to prevent the `@tailwindcss/postcss` PostCSS worker from scanning the entire filesystem (causing 100%+ CPU spin in Replit's environment)
3. **React Compiler**: Removed `reactCompiler: true` from `next.config.ts` to avoid experimental feature issues
4. **Workflow**: Configured to run `bun run dev` on port 5000

## Running
```bash
bun run dev    # Development (port 5000)
bun run build  # Build
bun run start  # Production (port 5000)
```
