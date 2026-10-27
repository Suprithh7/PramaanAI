import { ArrowUpRight, FlaskConical, Radar, Route } from "lucide-react";
import Link from "next/link";

export function ShowcaseRail({
  activeCount,
  breachCount,
  ruleRate,
}: {
  activeCount: number;
  breachCount: number;
  ruleRate: number;
}) {
  return (
    <section className="mb-4 grid gap-2.5 lg:grid-cols-3">
      <Link
        href="/journey"
        className="rise-in panel group relative overflow-hidden px-4 py-3 transition hover:border-brass-500 hover:shadow-md"
      >
        <div className="absolute inset-y-0 left-0 w-[3px] bg-brass-500" />
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(185,138,43,0.14),transparent_65%)]" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass-400/50 bg-brass-50 text-brass-700">
            <Route size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[8px] font-semibold uppercase tracking-wider2 text-brass-700">
              Statutory Reference Record
            </div>
            <div className="mt-0.5 font-serif text-[19px] font-semibold leading-tight text-navy-950">
              Lifecycle Case Audit
            </div>
          </div>
          <ArrowUpRight
            size={14}
            className="mt-0.5 shrink-0 text-slate-400 transition group-hover:text-brass-700"
          />
        </div>
        <div className="relative mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-[8px] font-semibold uppercase tracking-label text-slate-500">
          <span>Verified Ledger Trail</span>
          <span className="text-slate-300">|</span>
          <span>Multi-Tier Authority Hierarchy</span>
          <span className="text-slate-300">|</span>
          <span>Cryptographic Audit Proof</span>
          <span className="ml-auto text-brass-700 transition group-hover:text-brass-900">
            Inspect Audit →
          </span>
        </div>
      </Link>

      <Link
        href="/wall"
        className="rise-in group relative overflow-hidden border border-navy-800 bg-navy-950 px-4 py-3 text-white shadow-panel transition hover:border-brass-500/60"
        style={{ animationDelay: "70ms" }}
      >
        <div className="pointer-events-none absolute inset-0 wall-grid opacity-25" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(185,138,43,0.16),transparent_65%)]" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-brass-400/40 bg-white/[0.04] text-brass-200">
            <Radar size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-wider2 text-brass-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live national telemetry
            </div>
            <div className="mt-0.5 font-serif text-[19px] font-semibold leading-tight">
              National Command Wall
            </div>
          </div>
          <ArrowUpRight
            size={14}
            className="mt-0.5 shrink-0 text-navy-500 transition group-hover:text-brass-200"
          />
        </div>
        <div className="relative mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-[8px] font-semibold uppercase tracking-label text-navy-400">
          <span>{activeCount} active filings</span>
          <span className="text-white/15">|</span>
          <span className={breachCount > 0 ? "text-red-300" : "text-emerald-300"}>
            {breachCount} SLA breach{breachCount === 1 ? "" : "es"}
          </span>
          <span className="text-white/15">|</span>
          <span>{ruleRate}% APH conformity</span>
          <span className="ml-auto text-brass-200 transition group-hover:text-brass-100">
            Enter wall →
          </span>
        </div>
      </Link>

      <Link
        href="/simulator"
        className="rise-in panel group relative overflow-hidden px-4 py-3 transition hover:border-navy-400 hover:shadow-md"
        style={{ animationDelay: "140ms" }}
      >
        <div className="absolute inset-y-0 left-0 w-[3px] bg-brass-500" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-slate-300 bg-navy-50 text-navy-700">
            <FlaskConical size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[8px] font-semibold uppercase tracking-wider2 text-brass-700">
              AI Statutory Compliance Engine
            </div>
            <div className="mt-0.5 font-serif text-[19px] font-semibold leading-tight text-navy-950">
              APH Norms &amp; Compliance Twin
            </div>
          </div>
          <ArrowUpRight
            size={14}
            className="mt-0.5 shrink-0 text-slate-400 transition group-hover:text-navy-800"
          />
        </div>
        <div className="relative mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2 text-[8px] font-semibold uppercase tracking-label text-slate-500">
          <span>7 APH Norm Matrices</span>
          <span className="text-slate-300">|</span>
          <span>Zero-Write Simulation</span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-700">Gemini AI Guidance</span>
          <span className="ml-auto text-navy-700 transition group-hover:text-navy-900">
            Open Simulator →
          </span>
        </div>
      </Link>
    </section>
  );
}