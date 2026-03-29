"use client"

import { AnimatedThemeToggler } from "@/components/custom/animated-theme-toggler"
import { ThemeColorToggle } from "@/components/custom/theme-color-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loading } from "@/components/ui/loading"
import { client } from "@/lib/client"
import { useRealtime } from "@/lib/realtime-client"
import { cn } from "@/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

const MAX_CHARS = 1000
const WARN_CHARS = 800
const TYPING_THROTTLE_MS = 2000
const PRESENCE_INTERVAL_MS = 20_000
const AWAY_TIMEOUT_MS = 30_000
const VIRTUAL_THRESHOLD = 100

function formatTimeRemaining(seconds: number) {
  if (seconds < 0) return "∞"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`
  return `0:${s.toString().padStart(2, "0")}`
}

interface MessageType {
  id: string
  sender: string
  text: string
  timestamp: number
  token?: string
}

interface MessageGroup {
  sender: string
  messages: MessageType[]
  isMine: boolean
}

function groupMessages(messages: MessageType[], viewerUsername: string): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const msg of messages) {
    const last = groups[groups.length - 1]
    if (last && last.sender === msg.sender) {
      last.messages.push(msg)
    } else {
      groups.push({ sender: msg.sender, messages: [msg], isMine: msg.sender === viewerUsername })
    }
  }
  return groups
}

function MessageBubble({ group }: { group: MessageGroup }) {
  const lastMsg = group.messages[group.messages.length - 1]
  return (
    <div className={cn("flex flex-col gap-1", group.isMine ? "items-end" : "items-start")}>
      <span className="text-[11px] font-mono text-muted-foreground/70 px-1">
        {group.isMine ? "you" : `@${group.sender}`}
      </span>
      {group.messages.map((msg, i) => (
        <div
          key={msg.id}
          className={cn(
            "max-w-[75vw] sm:max-w-[60%] px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
            group.isMine
              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
              : "bg-muted text-foreground rounded-2xl rounded-bl-sm",
            i > 0 && group.isMine && "rounded-tr-lg",
            i > 0 && !group.isMine && "rounded-tl-lg"
          )}
        >
          {msg.text}
        </div>
      ))}
      <span className="text-[10px] text-muted-foreground/50 px-1">
        {format(lastMsg.timestamp, "HH:mm")}
      </span>
    </div>
  )
}

function TypingIndicator({ username }: { username: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-col items-start gap-1">
        <span className="text-[11px] font-mono text-muted-foreground/70 px-1">@{username}</span>
        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

function PresenceBadge({ status }: { status: "online" | "away" | "offline" }) {
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-green-500">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        online
      </span>
    )
  }
  if (status === "away") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-yellow-500">
        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
        away
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50">
      <span className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full" />
      offline
    </span>
  )
}

interface ChatPageProps {
  otherParticipant: string | null
  viewerUsername: string
}

export default function ChatPage({ otherParticipant, viewerUsername }: ChatPageProps) {
  const params = useParams()
  const roomId = params.roomId as string

  const router = useRouter()
  const [isNavigating, startTransition] = useTransition()

  const [input, setInput] = useState("")
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [typingUser, setTypingUser] = useState<string | null>(null)
  const [otherPresence, setOtherPresence] = useState<"online" | "away" | "offline">("offline")
  const [showNewMessages, setShowNewMessages] = useState(false)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const [virtualOffset, setVirtualOffset] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastTypingSentRef = useRef<number>(0)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const presenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAtBottomRef = useRef(true)

  useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } })
      setTimeRemaining(res.data?.ttl ?? null)
      return res.data
    },
  })

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return
    if (timeRemaining === 0) {
      startTransition(() => router.push("/?destroyed=true"))
      return
    }
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeRemaining, router])

  const { data: messagesData, refetch, isLoading: isMessagesLoading } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } })
      return res.data
    },
  })

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post({ text }, { query: { roomId } })
      setInput("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    },
  })

  const { mutate: sendTyping } = useMutation({
    mutationFn: async () => {
      await client.room.typing.post(null, { query: { roomId } })
    },
  })

  const { mutate: sendPresence } = useMutation({
    mutationFn: async (status: "online" | "away") => {
      await client.room.presence.post({ status }, { query: { roomId } })
    },
  })

  const handleTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now
      sendTyping()
    }
  }, [sendTyping])

  useEffect(() => {
    sendPresence("online")
    const interval = setInterval(() => sendPresence("online"), PRESENCE_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendPresence("away")
      } else {
        sendPresence("online")
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      sendPresence("away")
    }
  }, [sendPresence])

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.typing", "chat.presence"],
    onData: ({ event, data }) => {
      if (event === "chat.message") {
        refetch()
      }
      if (event === "chat.destroy") {
        startTransition(() => router.push("/?destroyed=true"))
      }
      if (event === "chat.typing") {
        const typingData = data as { username: string }
        if (typingData.username !== viewerUsername) {
          setTypingUser(typingData.username)
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000)
        }
      }
      if (event === "chat.presence") {
        const presenceData = data as { username: string; status: "online" | "away" }
        if (presenceData.username !== viewerUsername) {
          if (presenceData.status === "online") {
            setOtherPresence("online")
            if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current)
            presenceTimeoutRef.current = setTimeout(() => setOtherPresence("away"), AWAY_TIMEOUT_MS)
          } else {
            setOtherPresence("away")
            if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current)
          }
        }
      }
    },
  })

  const { mutate: destroyRoom, isPending: isDestroying } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } })
    },
    onSuccess: () => {
      setDestroyOpen(false)
    },
  })

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" })
  }, [])

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = distanceFromBottom < 80
    if (isAtBottomRef.current) setShowNewMessages(false)
  }, [])

  const allMessages = useMemo(() => (messagesData?.messages ?? []) as MessageType[], [messagesData])

  const isVirtualized = allMessages.length > VIRTUAL_THRESHOLD
  const displayedMessages = useMemo(() => {
    if (!isVirtualized) return allMessages
    return allMessages.slice(Math.max(0, allMessages.length - VIRTUAL_THRESHOLD - virtualOffset))
  }, [allMessages, isVirtualized, virtualOffset])

  const hasMoreMessages = isVirtualized && virtualOffset + VIRTUAL_THRESHOLD < allMessages.length
  const groups = useMemo(() => groupMessages(displayedMessages, viewerUsername), [displayedMessages, viewerUsername])

  useEffect(() => {
    if (allMessages.length) {
      if (isAtBottomRef.current) {
        scrollToBottom()
        setShowNewMessages(false)
      } else {
        setShowNewMessages(true)
      }
    }
  }, [allMessages, scrollToBottom])

  useEffect(() => {
    if (typingUser && isAtBottomRef.current) {
      scrollToBottom(true)
    }
  }, [typingUser, scrollToBottom])

  const handleSendMessage = () => {
    const text = input.trim()
    if (!text || isPending) return
    sendMessage({ text })
    isAtBottomRef.current = true
    requestAnimationFrame(() => scrollToBottom())
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (val.length > MAX_CHARS) return
    setInput(val)
    const ta = e.target
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px"
    handleTyping()
  }

  const charCount = input.length
  const isAtLimit = charCount >= MAX_CHARS
  const showCharCount = charCount >= WARN_CHARS

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden bg-background text-foreground">
      {isNavigating && <Loading overlay message="Leaving room..." />}

      <header className="shrink-0 border-b px-3 py-2.5 flex items-center justify-between bg-background gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => startTransition(() => router.push("/dashboard"))}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
            aria-label="Back to dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold font-mono text-foreground text-sm truncate">
                {otherParticipant ? `@${otherParticipant}` : "private room"}
              </span>
              <PresenceBadge status={otherPresence} />
            </div>
            {timeRemaining !== null && (
              <span
                className={cn(
                  "text-[10px] font-mono",
                  timeRemaining >= 0 && timeRemaining < 300
                    ? "text-destructive"
                    : "text-muted-foreground/60"
                )}
              >
                {timeRemaining === -1 ? "no expiry" : `expires in ${formatTimeRemaining(timeRemaining)}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeColorToggle />
          <AnimatedThemeToggler />

          <Dialog open={destroyOpen} onOpenChange={setDestroyOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Destroy room"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle className="font-mono">destroy this room?</DialogTitle>
                <DialogDescription>
                  All messages will be permanently deleted and both participants will be disconnected. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDestroyOpen(false)}
                  disabled={isDestroying}
                  className="font-mono text-xs"
                >
                  cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => destroyRoom()}
                  disabled={isDestroying}
                  className="font-mono text-xs"
                >
                  {isDestroying ? "destroying..." : "yes, destroy"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
      >
        {hasMoreMessages && (
          <div className="text-center">
            <button
              onClick={() => setVirtualOffset((v) => v + VIRTUAL_THRESHOLD)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors"
            >
              load earlier messages ({allMessages.length - VIRTUAL_THRESHOLD - virtualOffset} more)
            </button>
          </div>
        )}

        {isMessagesLoading && (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <div className={cn("h-8 rounded-2xl bg-muted animate-pulse", i % 2 === 0 ? "w-32" : "w-44")} />
              </div>
            ))}
          </div>
        )}

        {!isMessagesLoading && allMessages.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[40vh]">
            <p className="text-muted-foreground/50 text-sm font-mono text-center px-4">
              no messages yet — say hello!
            </p>
          </div>
        )}

        {groups.map((group, i) => (
          <MessageBubble key={`${group.sender}-${i}`} group={group} />
        ))}

        {typingUser && <TypingIndicator username={typingUser} />}

        <div ref={messagesEndRef} />
      </div>

      {showNewMessages && (
        <button
          onClick={() => {
            isAtBottomRef.current = true
            scrollToBottom(true)
            setShowNewMessages(false)
          }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground text-xs font-mono px-3 py-1.5 rounded-full shadow-lg hover:bg-primary/90 transition-all"
        >
          ↓ new messages
        </button>
      )}

      <div className="shrink-0 border-t bg-background px-3 py-2.5">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="message..."
              rows={1}
              disabled={isAtLimit}
              autoFocus
              className={cn(
                "w-full resize-none overflow-hidden rounded-2xl border bg-background px-4 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors",
                isAtLimit && "opacity-60"
              )}
              style={{ minHeight: "40px", maxHeight: "120px" }}
            />
            {showCharCount && (
              <span
                className={cn(
                  "absolute right-3 bottom-2 text-[10px] font-mono",
                  isAtLimit ? "text-destructive" : "text-muted-foreground/60"
                )}
              >
                {MAX_CHARS - charCount}
              </span>
            )}
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isPending || isAtLimit}
            className="shrink-0 mb-0.5 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 font-mono text-center mt-1">
          enter to send · shift+enter for new line
        </p>
      </div>
    </main>
  )
}
