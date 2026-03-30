const DEV_SECRET = "dev-only-secret-do-not-use-in-prod-32chars"

// ✅ Ensure production safety
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
) {
  throw new Error(
    "SESSION_SECRET must be set and at least 32 characters in production"
  )
}

// ✅ Convert hex → Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

// ✅ Create HMAC key (Edge-safe)
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET ?? DEV_SECRET
  const enc = new TextEncoder()

  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

// ✅ MAIN VERIFY FUNCTION (FULL FIXED)
export async function verifyTokenEdge(
  token: string
): Promise<string | null> {
  const dot = token.lastIndexOf(".")
  if (dot === -1) return null

  const uuid = token.slice(0, dot)
  const sigHex = token.slice(dot + 1)

  // basic validation
  if (!uuid || !sigHex || sigHex.length !== 64) return null

  try {
    const key = await getKey()

    const sigBytes = hexToBytes(sigHex)
    const enc = new TextEncoder()

    // ✅ CRITICAL FIX (Railway + TS safe)
    const signature =
      sigBytes instanceof Uint8Array
        ? sigBytes.buffer
        : new Uint8Array(sigBytes).buffer

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      enc.encode(uuid)
    )

    return valid ? uuid : null
  } catch {
    return null
  }
}
