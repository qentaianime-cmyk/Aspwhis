"use client";

import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useTransition, useRef } from "react";

const Page = () => {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  );
};

export default Page;

function Lobby() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startTransition] = useTransition();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const searchParams = useSearchParams();
  const wasDestroyed = searchParams.get("destroyed") === "true";
  const error = searchParams.get("error");
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    if (!searchParamsString) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (pathname === "/") {
        router.replace(pathname);
      }
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pathname, router, searchParamsString]);

  useEffect(() => {
    if (isNavigating && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [isNavigating]);

  return (
    <main className="flex flex-col items-center justify-center p-4">
      {isNavigating && (
        <Loading overlay message="Navigating..." />
      )}
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <div className="relative overflow-hidden bg-destructive/15 border border-destructive/50 p-4 text-center">
            <p className="text-destructive text-sm font-bold">ROOM DESTROYED</p>
            <p className="text-muted-foreground text-xs mt-1">
              All messages were permanently deleted.
            </p>
            <div className="warning-progress-bar" />
          </div>
        )}
        {error === "room-not-found" && (
          <div className="relative overflow-hidden bg-destructive/15 border border-destructive/50 p-4 text-center">
            <p className="text-destructive text-sm font-bold">ROOM NOT FOUND</p>
            <p className="text-muted-foreground text-xs mt-1">
              This room may have expired or never existed.
            </p>
            <div className="warning-progress-bar" />
          </div>
        )}
        {error === "room-full" && (
          <div className="relative overflow-hidden bg-destructive/15 border border-destructive/50 p-4 text-center">
            <p className="text-destructive text-sm font-bold">ROOM FULL</p>
            <p className="text-muted-foreground text-xs mt-1">
              This room is at maximum capacity.
            </p>
            <div className="warning-progress-bar" />
          </div>
        )}
        {error === "unauthorized" && (
          <div className="relative overflow-hidden bg-destructive/15 border border-destructive/50 p-4 text-center">
            <p className="text-destructive text-sm font-bold">ACCESS DENIED</p>
            <p className="text-muted-foreground text-xs mt-1">
              You are not a participant in this room.
            </p>
            <div className="warning-progress-bar" />
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary font-mono">
            {">"}<span className="text-foreground">aspzap</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Private, self-destructing chat rooms.
          </p>
        </div>

        <div className="border border-border rounded-2xl bg-card/50 p-6 backdrop-blur-md space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Rooms are private and participant-restricted. Sign in to create or join a room with someone you follow.
          </p>

          {isLoading ? null : isAuthenticated ? (
            <div className="space-y-2">
              <Button
                className="w-full font-mono"
                size="lg"
                onClick={() => startTransition(() => router.push("/dashboard"))}
              >
                go to dashboard
              </Button>
              <Button
                variant="outline"
                className="w-full font-mono text-xs"
                onClick={() => startTransition(() => router.push("/search"))}
              >
                find people to chat with
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login" className="block">
                <Button className="w-full font-mono" size="lg">
                  sign in
                </Button>
              </Link>
              <Link href="/register" className="block">
                <Button variant="outline" className="w-full font-mono text-xs">
                  create account
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
