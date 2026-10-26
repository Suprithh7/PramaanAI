import Link from "next/link";
import { ArrowUpRight, FileWarning, ShieldCheck } from "lucide-react";
import type { getDocuments } from "@/lib/queries";
import { documentStats } from "@/lib/analytics";
import { DocStatusBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { daysUntil, fmtDate } from "@/lib/format";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/types";

type DocumentRow = Awaited<ReturnType<typeof getDocuments>>[number];

function expiryCaption(expiryDate: Date) {
  const days = daysUntil(expiryDate);
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days <= 60) return `${days}d remaining`;
  return fmtDate(expiryDate);
}

export function DocumentExposure({
  documents,
  national = true,
}: {
  documents: DocumentRow[];
  national?: boolean;
}) {
  const stats = documentStats(documents);
  const risk = stats.expiring + stats.expired;
  const urgent = documents
    .filter((document) => document.status !== "VALID")
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
    .slice(0, 5);
  const total = Math.max(1, stats.total);

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <FileWarning size={10} /> Statutory evidence
          </div>
          <h2 className="panel-title mt-0.5">
            {national ? "National document exposure" : "Institutional document exposure"}
          </h2>
        </div>
        <div className="text-right">
          <div className={`font-mono text-[11px] font-semibold ${risk > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {risk} at risk
          </div>
          <div className="text-[9px] text-slate-500">
            {stats.institutions} institution{stats.institutions === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="p-4 pb-3">
        <div className="flex h-2 w-full overflow-hidden bg-slate-100">
          <span className="bg-emerald-600" style={{ width: `${(stats.valid / total) * 100}%` }} />
          <span className="bg-amber-500" style={{ width: `${(stats.expiring / total) * 100}%` }} />
          <span className="bg-red-600" style={{ width: `${(stats.expired / total) * 100}%` }} />
          <span className="bg-slate-400" style={{ width: `${(stats.pending / total) * 100}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-[9px]">
          {[
            { label: "Valid", value: stats.valid, dot: "bg-emerald-600", tone: "text-emerald-700" },
            { label: "Expiring", value: stats.expiring, dot: "bg-amber-500", tone: "text-amber-700" },
            { label: "Expired", value: stats.expired, dot: "bg-red-600", tone: "text-red-700" },
            { label: "Renewal", value: stats.pending, dot: "bg-slate-400", tone: "text-slate-600" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 ${item.dot}`} />
              <span className="text-slate-500">{item.label}</span>
              <span className={`ml-auto font-mono font-semibold ${item.tone}`}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {urgent.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState
            title="All documents valid"
            description="Lease, fire safety, building plan and undertakings are current."
            icon={<ShieldCheck size={16} />}
            className="py-6"
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {urgent.map((document) => (
            <li key={document.id} className="flex items-center gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-medium text-navy-900">
                  {DOC_TYPE_LABELS[document.docType as DocType] ?? document.docType}
                </div>
                <div className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-label text-slate-500">
                  {document.institution.code} · {expiryCaption(document.expiryDate)}
                </div>
              </div>
              <DocStatusBadge status={document.status} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <Link
          href="/compliance"
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Compliance <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
