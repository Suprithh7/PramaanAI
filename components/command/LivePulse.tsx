"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, Database, FileCheck2, Fingerprint, ShieldAlert, ShieldCheck, Timer } from "lucide-react";
import { fmtClock, fmtTime, fmtNumber, truncateHash } from "@/lib/format";
import type { TelemetryPayload } from "@/lib/evidence-types";
import { auditActionLabel } from "@/lib/types";

const POLL_MS = 5000;

function TelemetryCell({
  icon,
  label,
  value,
  detail,
  detailTone = "text-slate-500",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  detailTone?: string;
}) {
  return (
    <div className="bg-white px-3 py-2">
      <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[16px] font-semibold leading-none tabular-nums text-navy-950">
          {value}
        </span>
        <span className={`truncate text-[8px] ${detailTone}`}>{detail}</span>
      </div>
    </div>
  );
}

export function LivePulse({
  initial,
  scopeLabel,
}: {
  initial: TelemetryPayload;
  scopeLabel: string;
}) {
  const [payload, setPayload] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [seenTop] = useState(initial.recent[0]?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch("/api/telemetry", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = (await response.json()) as TelemetryPayload;
        if (cancelled) return;
        setPayload(next);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const latest = payload.recent[0] ?? null;
  const isNew = !!latest && latest.id !== seenTop;

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-navy-950 px-4 py-2 text-white">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping bg-brass-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 bg-brass-400" />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider2 text-brass-300">
            Live telemetry · 5 s poll
          </span>
          <span className="text-[9px] text-navy-200">{scopeLabel}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`font-mono text-[9px] ${failed ? "text-red-300" : "text-navy-200"}`}
            aria-live="polite"
          >
            {failed ? "TELEMETRY RETRYING" : `SYNCED ${fmtClock(payload.serverTime)} IST`}
          </span>
          <span
            className={`badge ${
              payload.ledgerValid
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                : "border-red-400/40 bg-red-500/15 text-red-200"
            }`}
          >
            {payload.ledgerValid ? <ShieldCheck size={9} /> : <ShieldAlert size={9} />}
            Ledger {payload.ledgerValid ? "verified" : "fault"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        <TelemetryCell
          icon={<FileCheck2 size={9} />}
          label="Active cases"
          value={fmtNumber(payload.activeCases)}
          detail={`${payload.breaches} breaching`}
          detailTone={payload.breaches > 0 ? "text-red-700" : "text-emerald-700"}
        />
        <TelemetryCell
          icon={<AlertTriangle size={9} />}
          label="Open notices"
          value={fmtNumber(payload.openDeficiencies)}
          detail={`${payload.openEscalations} escalations`}
          detailTone={payload.openDeficiencies > 0 ? "text-amber-700" : "text-emerald-700"}
        />
        <TelemetryCell
          icon={<Database size={9} />}
          label="Evidence store"
          value={fmtNumber(payload.evidenceFiles)}
          detail={
            payload.evidenceTampered > 0
              ? `${payload.evidenceTampered} mismatch`
              : `${payload.evidenceVerified} verified`
          }
          detailTone={payload.evidenceTampered > 0 ? "text-red-700" : "text-emerald-700"}
        />
        <TelemetryCell
          icon={<Fingerprint size={9} />}
          label="Ledger entries"
          value={fmtNumber(payload.ledgerEntries)}
          detail={payload.ledgerHead ? truncateHash(payload.ledgerHead, 6, 4) : "empty chain"}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2">
        {latest ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[9px]">
            <span className="border border-brass-300 bg-brass-50 px-1 font-mono text-[8px] font-semibold text-brass-800">
              #{String(latest.sequence).padStart(4, "0")}
            </span>
            {isNew && (
              <span className="bg-brass-500 px-1 text-[8px] font-semibold uppercase tracking-label text-navy-950">
                New
              </span>
            )}
            <span className="truncate font-semibold text-navy-900">
              {auditActionLabel(latest.action)}
            </span>
            <span className="truncate text-slate-500">{latest.performedBy}</span>
            <span className="flex items-center gap-1 font-mono text-slate-400">
              <Timer size={8} /> {fmtTime(latest.timestamp)}
            </span>
          </div>
        ) : (
          <span className="text-[9px] text-slate-500">No ledger events recorded.</span>
        )}
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Audit trail <ArrowUpRight size={8} />
        </Link>
      </div>
    </section>
  );
}
