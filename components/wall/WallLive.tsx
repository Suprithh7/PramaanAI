"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function WallLive() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  useEffect(() => {
    setNow(new Date());
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const sync = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        startTransition(() => router.refresh());
      }
    }, 30_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(sync);
    };
  }, [router]);

  const time = now
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      }).format(now)
    : "—:—:—";

  const date = now
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(now)
    : "—";

  return (
    <div className="flex items-center gap-3 border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <div>
        <div className="font-mono text-[14px] leading-none tabular-nums text-white">{time}</div>
        <div className="mt-0.5 text-[8px] uppercase tracking-label text-navy-500">IST · {date}</div>
      </div>
      <span className="h-7 w-px bg-white/10" />
      <div>
        <div className="text-[8px] uppercase tracking-label text-navy-500">National feed</div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-label text-navy-300 transition hover:text-brass-200 disabled:opacity-60"
        >
          {pending ? "Syncing" : "Live · 30s"}
          <RefreshCw size={9} className={pending ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
