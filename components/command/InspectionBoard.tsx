import Link from "next/link";
import { ArrowUpRight, CalendarClock, ClipboardCheck, Crosshair, MapPin } from "lucide-react";
import type { PortfolioApp } from "@/lib/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConflictBadge, EvcReportBadge } from "@/components/ui/Badges";
import { daysUntil, fmtDate, shortRef } from "@/lib/format";

export function InspectionBoard({
  apps,
  currentLead,
  limit = 5,
}: {
  apps: PortfolioApp[];
  currentLead?: string;
  limit?: number;
}) {
  const visits = apps
    .flatMap((app) => app.inspections.map((inspection) => ({ inspection, app })))
    .sort((a, b) => {
      const weight = (status: string) =>
        status === "OVERDUE" ? 0 : status === "PENDING" ? 1 : 2;
      if (weight(a.inspection.siteReportStatus) !== weight(b.inspection.siteReportStatus)) {
        return weight(a.inspection.siteReportStatus) - weight(b.inspection.siteReportStatus);
      }
      return a.inspection.scheduledDate.getTime() - b.inspection.scheduledDate.getTime();
    });
  const visible = visits.slice(0, limit);
  const overdue = visits.filter(({ inspection }) => inspection.siteReportStatus === "OVERDUE").length;
  const pending = visits.filter(({ inspection }) => inspection.siteReportStatus === "PENDING").length;
  const mine = visits.filter(({ inspection }) => inspection.committeeLead === currentLead).length;

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow flex items-center gap-1">
            <ClipboardCheck size={10} /> Geofenced inspections
          </div>
          <h2 className="panel-title mt-0.5">Expert Visit Committee docket</h2>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] font-semibold text-navy-900">
            {pending} pending · {overdue} overdue
          </div>
          <div className="text-[9px] text-slate-500">{mine} assigned to this identity</div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No constituted visits"
            description="Committees appear here once scrutiny clears and a visit is scheduled."
            icon={<CalendarClock size={16} />}
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map(({ inspection, app }) => {
            const remaining = daysUntil(inspection.scheduledDate);
            const assigned = currentLead && inspection.committeeLead === currentLead;
            return (
              <li
                key={inspection.id}
                className={`relative px-4 py-3 ${assigned ? "bg-brass-50/40" : ""}`}
              >
                {assigned && <span className="absolute inset-y-0 left-0 w-[2px] bg-brass-500" />}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[11px] font-semibold text-navy-950">
                        {app.institution.name}
                      </span>
                      {assigned && (
                        <span className="border border-brass-300 bg-brass-50 px-1 py-px text-[8px] font-semibold uppercase tracking-label text-brass-800">
                          Your visit
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                      {shortRef(app.referenceNo)} · {app.programName}
                    </div>
                  </div>
                  <EvcReportBadge status={inspection.siteReportStatus} />
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-slate-600">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin size={9} className="shrink-0 text-slate-400" />
                    {app.institution.city} · {app.institution.region}
                  </span>
                  <span className="flex items-center justify-end gap-1 font-mono">
                    <CalendarClock size={9} className="text-slate-400" />
                    {fmtDate(inspection.scheduledDate)}
                  </span>
                  <span className="truncate text-slate-500">{inspection.committeeLead}</span>
                  <span
                    className={`text-right font-semibold ${
                      inspection.siteReportStatus === "OVERDUE"
                        ? "text-red-700"
                        : inspection.siteReportStatus === "PENDING" && remaining <= 2
                          ? "text-amber-700"
                          : "text-slate-500"
                    }`}
                  >
                    {inspection.siteReportStatus === "COMPLETED"
                      ? "Report filed"
                      : remaining < 0
                        ? `${Math.abs(remaining)}d overdue`
                        : `in ${remaining}d`}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <ConflictBadge passed={inspection.conflictCheckPassed} />
                    <span
                      className={`badge ${
                        inspection.geofenceVerified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : "border-slate-300 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <Crosshair size={9} />
                      {inspection.geofenceVerified
                        ? inspection.geofenceDistanceM !== null
                          ? `${Math.round(inspection.geofenceDistanceM)}m verified`
                          : "Geofence verified"
                        : "Awaiting field fix"}
                    </span>
                  </div>
                  <Link
                    href={`/applications/${app.id}#evc`}
                    className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
                  >
                    Visit file <ArrowUpRight size={9} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <Link
          href="/evc"
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Visit console <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
