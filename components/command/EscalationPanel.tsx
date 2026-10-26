import Link from "next/link";
import { ArrowUpRight, Flame, ShieldAlert } from "lucide-react";
import type { PortfolioApp } from "@/lib/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { EscalationStatusBadge } from "@/components/ui/Badges";
import { fmtDate, shortRef } from "@/lib/format";
import { REGION_META, type Region } from "@/lib/types";

export function EscalationPanel({ apps, limit = 4 }: { apps: PortfolioApp[]; limit?: number }) {
  const tickets = apps
    .flatMap((app) => app.escalations.map((ticket) => ({ ticket, app })))
    .filter(({ ticket }) => ticket.status !== "RESOLVED")
    .sort((a, b) => {
      const statusWeight = { OPEN: 2, ACKNOWLEDGED: 1, RESOLVED: 0 } as Record<string, number>;
      if (statusWeight[a.ticket.status] !== statusWeight[b.ticket.status]) {
        return statusWeight[b.ticket.status] - statusWeight[a.ticket.status];
      }
      return b.ticket.daysInStage - a.ticket.daysInStage;
    });
  const visible = tickets.slice(0, limit);
  const penalty = tickets.reduce((sum, { ticket }) => sum + ticket.penaltyPoints, 0);
  const open = tickets.filter(({ ticket }) => ticket.status === "OPEN").length;

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <Flame size={10} className="text-red-600" /> Automatic escalation
          </div>
          <h2 className="panel-title mt-0.5">Escalation register</h2>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] font-semibold text-red-700">{penalty} pts</div>
          <div className="text-[9px] text-slate-500">
            {open} open · {tickets.length} active
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No active escalations"
            description="Every statutory clock is within the 10-day limit."
            icon={<ShieldAlert size={16} />}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map(({ ticket, app }) => {
            const region = REGION_META[ticket.region as Region];
            return (
              <li key={ticket.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-semibold text-navy-900">
                      {ticket.escalationNo}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-600">
                      {app.institution.name}
                    </div>
                  </div>
                  <EscalationStatusBadge status={ticket.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-500">
                  <span className="font-mono">
                    {region?.code ?? ticket.region.slice(0, 2)} · {shortRef(app.referenceNo)}
                  </span>
                  <span className="font-semibold text-red-700">{ticket.daysInStage}d in stage</span>
                  <span>+{ticket.penaltyPoints} penalty</span>
                  <span>{fmtDate(ticket.createdAt)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-400">
                    {ticket.status === "OPEN" ? "Awaiting Bureau acknowledgement" : "Bureau has acknowledged"}
                  </span>
                  <Link
                    href={`/applications/${app.id}#escalations`}
                    className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
                  >
                    Case <ArrowUpRight size={9} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <Link
          href="/escalations"
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Matrix <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
