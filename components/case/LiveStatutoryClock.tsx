"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

const DAY = 86_400_000;

const TONE = {
  ON_TRACK: {
    bar: "bg-emerald-600",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-900",
    text: "text-emerald-700",
  },
  WARNING: {
    bar: "bg-amber-500",
    badge: "border-amber-300 bg-amber-50 text-amber-900",
    text: "text-amber-700",
  },
  BREACHED: {
    bar: "bg-red-600",
    badge: "border-red-300 bg-red-50 text-red-900",
    text: "text-red-700",
  },
} as const;

function pad(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

/**
 * Ticks the statutory clock in real time. The server paints the figure from
 * `serverNow` so hydration matches, then the client re-syncs to the machine
 * clock and counts down every second against the real stage-entry timestamp.
 */
export function LiveStatutoryClock({
  stageEnteredAt,
  serverNow,
  enteredLabel,
  deadlineLabel,
  warningAtDays = 5,
  breachAfterDays = 10,
  deadlineDays = 10,
  variant = "full",
}: {
  stageEnteredAt: string;
  serverNow: string;
  enteredLabel: string;
  deadlineLabel: string;
  warningAtDays?: number;
  breachAfterDays?: number;
  deadlineDays?: number;
  variant?: "full" | "compact";
}) {
  const [now, setNow] = useState(() => new Date(serverNow).getTime());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const entered = new Date(stageEnteredAt).getTime();
  const stageWindow = deadlineDays * DAY;
  const deadline = entered + stageWindow;

  const days = Math.max(0, Math.floor((now - entered) / DAY));
  const status =
    days > breachAfterDays ? "BREACHED" : days >= warningAtDays ? "WARNING" : "ON_TRACK";
  const tone = TONE[status];
  const pct = Math.min(100, Math.max(0, ((now - entered) / stageWindow) * 100));

  const diff = deadline - now;
  const overdue = diff <= 0;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const ticking = (
    <>
      {overdue ? "+" : ""}
      {d}d : {pad(h)}h : {pad(m)}m : {pad(s)}s
    </>
  );

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-10px uppercase tracking-label text-slate-500">
          <Timer size={9} /> {overdue ? "Overdue by" : "Deadline in"}
        </span>
        <span className={`font-mono text-sm font-semibold tabular-nums ${tone.text}`}>
          {ticking}
        </span>
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <Timer size={10} /> Live statutory clock
          </div>
          <h2 className="panel-title mt-0.5">Time remaining in the current stage</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 border px-2 py-[3px] text-3xs font-semibold uppercase tracking-label ${tone.badge}`}
        >
          <span className={`h-1.5 w-1.5 ${tone.bar}`} />
          {status.replace("_", " ")}
        </span>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-11px font-semibold uppercase tracking-label text-slate-500">
              {overdue ? "Statutory deadline exceeded by" : "Statutory deadline in"}
            </div>
            <div className="mt-1 font-mono text-[28px] font-semibold leading-none tabular-nums text-navy-950 sm:text-[32px]">
              {ticking}
            </div>
          </div>
          <div className="space-y-0.5 text-right text-11px text-slate-500">
            <div>
              Stage entered <span className="font-mono text-slate-600">{enteredLabel}</span>
            </div>
            <div>
              Deadline <span className="font-mono text-slate-600">{deadlineLabel}</span>
            </div>
            <div>
              Elapsed <span className="font-mono text-slate-600">{pct.toFixed(2)}%</span> of the{" "}
              {deadlineDays}-day window
            </div>
          </div>
        </div>

        <div className="relative mt-3 h-2.5 w-full bg-slate-100">
          <div className={`h-2.5 ${tone.bar} bar-fill`} style={{ width: `${pct}%` }} />
          <span
            className="absolute inset-y-0 border-l border-dashed border-amber-500/70"
            style={{ left: `${(warningAtDays / deadlineDays) * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-10px uppercase tracking-label text-slate-400">
          <span>0d</span>
          <span className="text-amber-600">{warningAtDays}d warn</span>
          <span className="text-red-600">{deadlineDays}d limit</span>
        </div>
      </div>
    </section>
  );
}