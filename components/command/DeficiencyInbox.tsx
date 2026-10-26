import Link from "next/link";
import { AlertTriangle, ArrowUpRight, FileCheck2, MailWarning } from "lucide-react";
import type { PortfolioApp } from "@/lib/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeficiencyStatusBadge } from "@/components/ui/Badges";
import { daysUntil, fmtDate, shortRef } from "@/lib/format";

export function DeficiencyInbox({
  apps,
  limit = 5,
  role = "REGIONAL_OFFICER",
}: {
  apps: PortfolioApp[];
  limit?: number;
  role?: string;
}) {
  const tickets = apps
    .flatMap((app) =>
      app.deficiencies
        .filter((ticket) => ticket.status === "OPEN" || ticket.status === "RESUBMITTED")
        .map((ticket) => ({ ticket, app })),
    )
    .sort((a, b) => {
      const weight = (status: string) => (status === "OPEN" ? 0 : 1);
      if (weight(a.ticket.status) !== weight(b.ticket.status)) {
        return weight(a.ticket.status) - weight(b.ticket.status);
      }
      return a.ticket.complianceDeadline.getTime() - b.ticket.complianceDeadline.getTime();
    });
  const visible = tickets.slice(0, limit);
  const open = tickets.filter(({ ticket }) => ticket.status === "OPEN").length;
  const resubmitted = tickets.length - open;
  const overdue = tickets.filter(
    ({ ticket }) => ticket.status === "OPEN" && daysUntil(ticket.complianceDeadline) < 0,
  ).length;
  const next = tickets.find(({ ticket }) => ticket.status === "OPEN");

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <MailWarning size={10} className="text-red-600" /> Two-way deficiency loop
          </div>
          <h2 className="panel-title mt-0.5">Deficiency inbox</h2>
        </div>
        <div className="text-right">
          <div className={`font-mono text-[11px] font-semibold ${open > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {open} open
          </div>
          <div className="text-[9px] text-slate-500">
            {resubmitted} resubmitted
            {overdue > 0 ? ` · ${overdue} overdue` : ""}
          </div>
        </div>
      </div>

      {next && (
        <div className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50/60 px-4 py-1.5 text-[9px]">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-label text-red-800">
            <AlertTriangle size={10} />
            Nearest evidence deadline
          </span>
          <span className="font-mono font-semibold text-red-800">
            {fmtDate(next.ticket.complianceDeadline)} ·{" "}
            {daysUntil(next.ticket.complianceDeadline) < 0
              ? `${Math.abs(daysUntil(next.ticket.complianceDeadline))}d overdue`
              : `${daysUntil(next.ticket.complianceDeadline)}d left`}
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No pending deficiencies"
            description="Every formal notice has been resolved or no notice is currently open."
            icon={<FileCheck2 size={16} />}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map(({ ticket, app }) => {
            const remaining = daysUntil(ticket.complianceDeadline);
            const late = ticket.status === "OPEN" && remaining < 0;
            return (
              <li key={ticket.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[10px] font-semibold text-navy-900">
                      {ticket.noticeNo ?? "Notice pending numbering"}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-600">
                      {app.institution.name}
                    </div>
                  </div>
                  <DeficiencyStatusBadge status={ticket.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-500">
                  <span className="font-mono">{shortRef(app.referenceNo)}</span>
                  <span className={late ? "font-semibold text-red-700" : "text-slate-500"}>
                    {ticket.status === "OPEN"
                      ? late
                        ? `${Math.abs(remaining)}d overdue`
                        : `${remaining}d to respond`
                      : `Filed ${ticket.resubmittedAt ? fmtDate(ticket.resubmittedAt) : ""}`}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-[9px] leading-relaxed text-slate-500">
                    {ticket.deficiencyDetails}
                  </p>
                  <Link
                    href={`/applications/${app.id}#deficiency`}
                    className="shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
                  >
                    {role === "INSTITUTION_ADMIN" ? "Respond" : ticket.status === "RESUBMITTED" ? "Review" : "Notice"}{" "}
                    <ArrowUpRight size={9} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <Link
          href={role === "INSTITUTION_ADMIN" ? "/applications" : "/scrutiny"}
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Open queue <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
