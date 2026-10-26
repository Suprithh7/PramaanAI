import { Timer } from "lucide-react";
import type { AnalyticsApp } from "@/lib/analytics";
import { activeApps } from "@/lib/analytics";
import { liveDaysInStage, slaForDays } from "@/lib/sla";

const MAX_DAYS = 15;
const WARNING_AT = 5;
const BREACH_AT = 10;

const TICK = {
  ON_TRACK: { bar: "bg-emerald-500", dot: "bg-emerald-600", text: "text-emerald-700" },
  WARNING: { bar: "bg-amber-500", dot: "bg-amber-600", text: "text-amber-700" },
  BREACHED: { bar: "bg-red-500", dot: "bg-red-600", text: "text-red-700" },
} as const;

type ClockApp = AnalyticsApp & { id?: string; referenceNo?: string };

/**
 * Plots every active filing against the statutory 0–15 day window, so the
 * command centre can read clock pressure as a shape rather than a table.
 */
export function StatutoryClockBand({ apps }: { apps: ClockApp[] }) {
  const rows = activeApps(apps).map((app) => {
    const days = liveDaysInStage(app.stageEnteredAt);
    return { app, days, sla: slaForDays(days) };
  });

  const onTrack = rows.filter((row) => row.sla === "ON_TRACK").length;
  const warning = rows.filter((row) => row.sla === "WARNING").length;
  const breached = rows.filter((row) => row.sla === "BREACHED").length;
  const withinWindow = rows.filter((row) => row.days <= MAX_DAYS);
  const beyond = rows.filter((row) => row.days > MAX_DAYS);
  const oldest = rows.reduce((max, row) => Math.max(max, row.days), 0);

  const positionFor = (days: number) => (Math.min(days, MAX_DAYS) / MAX_DAYS) * 100;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <Timer size={10} /> Statutory clock · live distribution
          </div>
          <h2 className="panel-title mt-0.5">Case age against the 10-day limit</h2>
        </div>
        <span className="font-mono text-[10px] text-slate-500">
          {rows.length} active · oldest {oldest}d
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-[26px] text-center text-[11px] text-slate-500">
          No active filings under the statutory clock in this scope.
        </div>
      ) : (
        <div className="p-4">
          <div
            className="relative h-[74px]"
            role="img"
            aria-label={`Statutory clock distribution: ${onTrack} on track, ${warning} warning, ${breached} breached of ${rows.length} active filings`}
          >
            {/* Zone tints across the 0–15 day window */}
            <div className="absolute inset-x-0 top-[30px] flex h-4 overflow-hidden border-y border-slate-200 bg-slate-100">
              <span className="h-full bg-emerald-50" style={{ width: `${(WARNING_AT / MAX_DAYS) * 100}%` }} />
              <span
                className="h-full bg-amber-50"
                style={{ width: `${((BREACH_AT - WARNING_AT) / MAX_DAYS) * 100}%` }}
              />
              <span
                className="h-full bg-red-50"
                style={{ width: `${((MAX_DAYS - BREACH_AT) / MAX_DAYS) * 100}%` }}
              />
            </div>

            {/* Threshold rails */}
            <div
              className="absolute bottom-6 top-2 border-l border-dashed border-amber-500/70"
              style={{ left: `${(WARNING_AT / MAX_DAYS) * 100}%` }}
            />
            <div
              className="absolute bottom-6 top-2 border-l border-dashed border-red-500/70"
              style={{ left: `${(BREACH_AT / MAX_DAYS) * 100}%` }}
            />

            {/* Case markers */}
            {withinWindow.map((row, index) => {
              const tone = TICK[row.sla];
              return (
                <div
                  key={row.app.id ?? index}
                  title={`${row.app.referenceNo} · ${row.days} days in stage`}
                  className="clock-marker absolute bottom-6 -translate-x-1/2"
                  style={{ left: `${positionFor(row.days)}%`, animationDelay: `${index * 45}ms` }}
                >
                  <span className={`block h-4 w-[2px] ${tone.bar}`} />
                  <span className={`-ml-[2px] mt-[1px] block h-[5px] w-[6px] ${tone.dot}`} />
                </div>
              );
            })}

            {/* Beyond-window cluster */}
            {beyond.length > 0 && (
              <div
                className="clock-marker absolute bottom-6 right-0 translate-x-1/2"
                title={`${beyond.length} cases ${MAX_DAYS}+ days in stage`}
              >
                <span className="block h-4 w-[2px] bg-red-600" />
                <span className="mt-[2px] inline-flex h-[15px] min-w-[26px] -translate-x-1/2 items-center justify-center bg-red-600 px-1 font-mono text-[9px] font-semibold text-white">
                  +{beyond.length}
                </span>
              </div>
            )}

            {/* Day axis */}
            <div className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-[8px] uppercase tracking-label text-slate-400">
              <span>0d</span>
              <span className="absolute left-[33.333%] -translate-x-1/2 text-amber-600">5d warn</span>
              <span className="absolute left-[66.666%] -translate-x-1/2 text-red-600">10d breach</span>
              <span>{MAX_DAYS}d+</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-[10px]">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 bg-emerald-500" /> On track
              <span className="ml-auto font-mono font-semibold text-emerald-700">{onTrack}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 bg-amber-500" /> Warning
              <span className="ml-auto font-mono font-semibold text-amber-700">{warning}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 bg-red-500" /> Breached
              <span className="ml-auto font-mono font-semibold text-red-700">{breached}</span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}