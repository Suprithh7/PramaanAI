import Link from "next/link";
import {
  ArrowUpRight,
  Flame,
  Gavel,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { acknowledgeEscalationAction, runSlaSweepAction } from "@/app/actions";
import { activeApps, regionStats, slaRows } from "@/lib/analytics";
import { fmtDate, fmtDateTime, shortRef } from "@/lib/format";
import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { SLA_POLICY } from "@/lib/sla";
import {
  REGION_META,
  ROLE_META,
  can,
  type Region,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { SlaHeatmap } from "@/components/command/SlaHeatmap";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string; region?: string };

function triggerLabel(trigger: string): string {
  return trigger.replaceAll("_", " ").toLowerCase();
}

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const apps = await getPortfolio(session);
  const query = (params.q ?? "").trim().toLowerCase();
  const status = params.status ?? "ALL";
  const region = params.region ?? "ALL";

  const tickets = apps
    .flatMap((app) => app.escalations.map((ticket) => ({ ticket, app })))
    .filter(({ ticket, app }) => {
      if (status !== "ALL" && ticket.status !== status) return false;
      if (region !== "ALL" && ticket.region !== region) return false;
      if (query) {
        const haystack = [
          ticket.escalationNo,
          app.referenceNo,
          app.institution.name,
          app.institution.code,
          ticket.assignedTo ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const weight = { OPEN: 2, ACKNOWLEDGED: 1, RESOLVED: 0 } as Record<string, number>;
      if (weight[a.ticket.status] !== weight[b.ticket.status]) {
        return weight[b.ticket.status] - weight[a.ticket.status];
      }
      return b.ticket.daysInStage - a.ticket.daysInStage;
    });

  const allTickets = apps.flatMap((app) => app.escalations);
  const open = allTickets.filter((ticket) => ticket.status === "OPEN");
  const acknowledged = allTickets.filter((ticket) => ticket.status === "ACKNOWLEDGED");
  const active = allTickets.filter((ticket) => ticket.status !== "RESOLVED");
  const penalty = active.reduce((sum, ticket) => sum + ticket.penaltyPoints, 0);
  const breachRows = slaRows(activeApps(apps)).filter((row) => row.sla === "BREACHED");
  const warningRows = slaRows(activeApps(apps)).filter((row) => row.sla === "WARNING");
  const regions = regionStats(apps);
  const canSweep = can(session.role, "RUN_SLA_SWEEP");
  const canAck = can(session.role, "ACK_ESCALATION");

  const statuses = [
    { value: "ALL", label: "All statuses" },
    { value: "OPEN", label: "Open" },
    { value: "ACKNOWLEDGED", label: "Acknowledged" },
    { value: "RESOLVED", label: "Resolved" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${ROLE_META[session.role].short} authority · statutory clock`}
        title="SLA enforcement & escalation control"
        description="Every active filing is measured against a 10-day stage clock. Cases beyond the limit auto-escalate to the Bureau with penalty points; the daily sweep also closes inspection-report overruns."
        meta={
          <>
            <span className="badge border-red-300 bg-red-50 text-red-900">{breachRows.length} breached</span>
            <span className="text-[10px] text-amber-700">{warningRows.length} approaching limit</span>
            <span className="text-[10px] text-slate-600">{active.length} active escalation{active.length === 1 ? "" : "s"}</span>
            <span className="text-[10px] text-slate-600">{penalty} penalty point{penalty === 1 ? "" : "s"}</span>
            <span className="text-[10px] uppercase tracking-label text-slate-400">
              Green &lt;5d · amber 5–10d · red &gt;10d
            </span>
          </>
        }
        actions={
          <>
            <Link href="/audit" className="btn btn-outline">
              <ShieldCheck size={11} /> Escalation ledger
            </Link>
            {canSweep && (
              <ActionButton
                action={runSlaSweepAction}
                fields={{}}
                label="Run national SLA sweep"
                pendingLabel="Recomputing clocks…"
                variant="danger"
                size="sm"
                icon={<TimerReset size={11} />}
                confirm="Recompute every active stage clock, raise new escalations and close overdue inspection reports?"
              />
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Open escalations"
          value={open.length}
          unit="tickets"
          tone="red"
          icon={<Flame size={13} />}
          detail={open.length > 0 ? "Awaiting Bureau acknowledgement" : "No unacknowledged escalations"}
        />
        <MetricCard
          label="Acknowledged"
          value={acknowledged.length}
          unit="tickets"
          tone="amber"
          icon={<ShieldAlert size={13} />}
          detail="Penalty remains recorded against the region"
        />
        <MetricCard
          label="Penalty exposure"
          value={penalty}
          unit="pts"
          tone="brass"
          icon={<Scale size={13} />}
          detail={`${SLA_POLICY.penaltyPoints} points per auto-raised escalation`}
        />
        <MetricCard
          label="Breached cases"
          value={breachRows.length}
          unit="cases"
          tone="red"
          icon={<Gavel size={13} />}
          detail={
            breachRows[0]
              ? `Oldest ${breachRows[0].days} days in stage · ${shortRef(breachRows[0].app.referenceNo)}`
              : "All active cases within the limit"
          }
        />
      </div>

      <div className="mb-4">
        <SlaHeatmap rows={regions} />
      </div>

      <div className="panel mb-4">
        <form method="get" action="/escalations" className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <label htmlFor="q" className="field-label">Search</label>
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Escalation number, institution or reference…"
              className="input"
            />
          </div>
          <div className="lg:col-span-3">
            <label htmlFor="status" className="field-label">Status</label>
            <select id="status" name="status" defaultValue={status} className="select">
              {statuses.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="region" className="field-label">Region</label>
            <select id="region" name="region" defaultValue={region} className="select">
              <option value="ALL">All regions</option>
              {(Object.keys(REGION_META) as Region[]).map((value) => (
                <option key={value} value={value}>{REGION_META[value].label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end lg:col-span-1">
            <button type="submit" className="btn btn-primary btn-xs w-full">Apply</button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Automatic escalation register</div>
              <h2 className="panel-title mt-0.5">Bureau docket</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {tickets.length} of {allTickets.length}
            </span>
          </div>

          {tickets.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No escalations match"
                description={
                  allTickets.length === 0
                    ? "No case has crossed the statutory deadline. Run the sweep to recompute the live clocks."
                    : "Clear the filters to inspect the full escalation register."
                }
                icon={<ShieldCheck size={16} />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="w-[148px]">Escalation</th>
                    <th>Institution / case</th>
                    <th className="w-[56px]">Days</th>
                    <th className="w-[58px]">Penalty</th>
                    <th className="w-[120px]">Status / owner</th>
                    <th className="w-[112px]" />
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(({ ticket, app }) => {
                    const regionMeta = REGION_META[ticket.region as Region];
                    return (
                      <tr key={ticket.id} className={ticket.status === "OPEN" ? "bg-red-50/20" : undefined}>
                        <td>
                          <div className="whitespace-nowrap font-mono text-[9px] font-semibold text-navy-900">{ticket.escalationNo}</div>
                          <div className="mt-0.5 text-[8px] uppercase tracking-label text-slate-400">
                            {triggerLabel(ticket.trigger)}
                          </div>
                          <div className="mt-0.5 font-mono text-[8px] text-slate-400">{fmtDate(ticket.createdAt)}</div>
                        </td>
                        <td>
                          <div className="max-w-[260px] truncate text-[10px] font-medium text-navy-950">
                            {app.institution.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            <span className="font-mono text-[8px] text-slate-400">
                              {regionMeta?.code ?? ticket.region.slice(0, 2)}
                            </span>
                            <Link
                              href={`/applications/${app.id}`}
                              className="font-mono text-[8px] font-semibold text-navy-700 underline decoration-slate-300 underline-offset-2 hover:decoration-navy-700"
                            >
                              {app.referenceNo}
                            </Link>
                            <StatusBadge status={app.status} />
                          </div>
                        </td>
                        <td>
                          <div className="font-mono text-[12px] font-semibold text-red-700">{ticket.daysInStage}</div>
                          <div className="text-[8px] uppercase tracking-label text-slate-400">
                            over {ticket.daysInStage - SLA_POLICY.deadlineDays}d
                          </div>
                        </td>
                        <td className="font-mono text-[11px] font-semibold text-brass-700">{ticket.penaltyPoints}</td>
                        <td>
                          <span
                            className={`badge ${
                              ticket.status === "OPEN"
                                ? "border-red-300 bg-red-50 text-red-900"
                                : ticket.status === "ACKNOWLEDGED"
                                  ? "border-amber-300 bg-amber-50 text-amber-900"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
                            }`}
                          >
                            {ticket.status === "OPEN" ? "Open" : ticket.status === "ACKNOWLEDGED" ? "Acknowledged" : "Resolved"}
                          </span>
                          <div className="mt-0.5 max-w-[130px] truncate text-[8px] text-slate-500">
                            {ticket.assignedTo ?? "Unassigned"}
                          </div>
                          {ticket.acknowledgedAt && (
                            <div className="text-[8px] text-slate-400">{fmtDateTime(ticket.acknowledgedAt)}</div>
                          )}
                        </td>
                        <td>
                          {canAck && ticket.status === "OPEN" ? (
                            <ActionButton
                              action={acknowledgeEscalationAction}
                              fields={{ escalationId: ticket.id }}
                              label="Acknowledge"
                              pendingLabel="Recording…"
                              variant="outline"
                              size="xs"
                              icon={<ShieldAlert size={10} />}
                              confirm={`Acknowledge ${ticket.escalationNo}? The ${ticket.penaltyPoints}-point penalty remains on the regional register.`}
                            />
                          ) : (
                            <Link
                              href={`/applications/${app.id}`}
                              className="inline-flex items-center gap-0.5 font-mono text-[9px] font-semibold uppercase tracking-label text-navy-800 hover:underline"
                            >
                              Case <ArrowUpRight size={9} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Live breach queue</div>
                <h2 className="panel-title mt-0.5">Cases past 10 days</h2>
              </div>
              <span className="font-mono text-[10px] font-semibold text-red-700">{breachRows.length}</span>
            </div>
            {breachRows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No live breaches" description="Every active stage clock is inside the statutory limit." icon={<ShieldCheck size={16} />} />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {breachRows.slice(0, 7).map(({ app, days }) => (
                  <li key={app.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/applications/${app.id}`}
                          className="font-mono text-[9px] font-semibold text-navy-900 hover:underline"
                        >
                          {shortRef(app.referenceNo)}
                        </Link>
                        <div className="mt-0.5 truncate text-[10px] font-medium text-navy-950">{app.institution.name}</div>
                      </div>
                      <SlaBadge status="BREACHED" days={days} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-label text-slate-400">
                      <span>{REGION_META[app.institution.region as Region]?.code ?? app.institution.region} · {app.status.replaceAll("_", " ")}</span>
                      <span className="font-mono text-red-700">{days - SLA_POLICY.deadlineDays}d over</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Regional liability</div>
                <h2 className="panel-title mt-0.5">Penalty by region</h2>
              </div>
              <Scale size={14} className="text-slate-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th className="w-[58px] text-right">Active</th>
                    <th className="w-[54px] text-right">Breach</th>
                    <th className="w-[64px] text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((row) => {
                    const regionActive = allTickets.filter(
                      (ticket) => ticket.region === row.region && ticket.status !== "RESOLVED",
                    ).length;
                    return (
                    <tr key={row.region}>
                      <td>
                        <div className="text-[10px] font-medium text-navy-950">{REGION_META[row.region].label}</div>
                        <div className="font-mono text-[8px] text-slate-400">{REGION_META[row.region].code} · {REGION_META[row.region].hq}</div>
                      </td>
                      <td className="text-right font-mono text-[10px] text-slate-700">
                        {regionActive === 0 ? "—" : regionActive}
                      </td>
                      <td className="text-right font-mono text-[10px] font-semibold text-red-700">{row.breached}</td>
                      <td className="text-right font-mono text-[10px] font-semibold text-brass-700">{row.penalty}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Enforcement policy</div>
                <h2 className="panel-title mt-0.5">SLA ladder</h2>
              </div>
              <Gavel size={14} className="text-slate-400" />
            </div>
            <div className="space-y-2 p-3.5">
              {[
                { label: "On track", window: "0–4 days in stage", tone: "bg-emerald-600", copy: "No action. Clock monitored." },
                { label: "Approaching limit", window: "5–10 days in stage", tone: "bg-amber-500", copy: "Regional officer notified on the heatmap." },
                { label: "Breached", window: "More than 10 days", tone: "bg-red-600", copy: `Auto-escalation to the Bureau with ${SLA_POLICY.penaltyPoints} penalty points.` },
              ].map((row) => (
                <div key={row.label} className="border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-navy-950">
                      <span className={`h-1.5 w-1.5 ${row.tone}`} /> {row.label}
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-label text-slate-400">{row.window}</span>
                  </div>
                  <p className="mt-1 text-[9px] leading-snug text-slate-500">{row.copy}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
