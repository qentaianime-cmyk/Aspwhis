import { treaty } from "@elysiajs/eden"
import type { App } from "../app/api/[[...slugs]]/route"

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  return "http://localhost:5000"
}

export const client = treaty<App>(getApiUrl()).api
