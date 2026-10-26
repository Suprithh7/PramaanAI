import Link from "next/link";
import { ArrowUpRight, GitCommitHorizontal, ShieldCheck, ShieldX } from "lucide-react";
import { auditActionLabel, isRole, ROLE_META } from "@/lib/types";
import { fmtShortDate, fmtTime, truncateHash } from "@/lib/format";

export type LedgerEntry = {
  id: string;
  sequence: number;
  action: string;
  performedBy: string;
  role: string;
  detail: string | null;
  hashChecksum: string;
  timestamp: Date;
  application?: { referenceNo: string } | null;
};

export function LedgerStream({
  entries,
  valid,
  totalEntries,
  headHash,
  title = "Live audit ledger",
  limit = 6,
}: {
  entries: LedgerEntry[];
  valid: boolean;
  totalEntries: number;
  headHash: string | null;
  title?: string;
  limit?: number;
}) {
  const visible = entries.slice(0, limit);

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <GitCommitHorizontal size={10} /> Cryptographic evidence
          </div>
          <h2 className="panel-title mt-0.5">{title}</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 border px-1.5 py-[3px] text-3xs font-semibold uppercase tracking-label ${
            valid
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {valid ? <ShieldCheck size={10} /> : <ShieldX size={10} />}
          {valid ? "Chain verified" : "Integrity fault"}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {visible.map((entry) => {
          const actor = isRole(entry.role) ? ROLE_META[entry.role].short : entry.role === "SYSTEM" ? "System" : entry.role;
          return (
            <li key={entry.id} className="flex gap-3 px-4 py-2.5">
              <div className="w-9 shrink-0 pt-px font-mono text-[9px] text-slate-400">
                #{String(entry.sequence).padStart(4, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] font-semibold leading-tight text-navy-950">
                    {auditActionLabel(entry.action)}
                  </div>
                  <time className="shrink-0 font-mono text-[9px] text-slate-400">
                    {fmtShortDate(entry.timestamp)} · {fmtTime(entry.timestamp)}
                  </time>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[9px] text-slate-500">
                  <span className="font-medium text-slate-600">{entry.performedBy}</span>
                  <span className="text-slate-300">/</span>
                  <span className="uppercase tracking-label">{actor}</span>
                  {entry.application && (
                    <>
                      <span className="text-slate-300">/</span>
                      <span className="font-mono">{entry.application.referenceNo}</span>
                    </>
                  )}
                </div>
                {entry.detail && (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-600">{entry.detail}</p>
                )}
                <div className="mt-1 font-mono text-[8px] tracking-tight text-slate-400">
                  {truncateHash(entry.hashChecksum, 12, 8)}
                </div>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-[11px] text-slate-500">No ledger events in this scope.</li>
        )}
      </ul>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <span>
          {totalEntries} entries · head{" "}
          <span className="font-mono text-slate-600">{headHash ? truncateHash(headHash, 8, 6) : "genesis"}</span>
        </span>
        <Link
          href="/audit"
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Audit trail <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
