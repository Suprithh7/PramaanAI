import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Clock3, Gavel, ShieldAlert } from "lucide-react";
import type { PortfolioApp } from "@/lib/queries";
import { activeApps, slaRows } from "@/lib/analytics";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { fmtNumber, shortRef } from "@/lib/format";
import {
  APPLICATION_TYPE_LABELS,
  REGION_META,
  type ApplicationType,
  type Region,
} from "@/lib/types";

function blockerFor(app: PortfolioApp) {
  const open = app.deficiencies.find((ticket) => ticket.status === "OPEN");
  if (open) {
    return {
      icon: <AlertTriangle size={10} className="text-red-600" />,
      text: `Deficiency ${open.noticeNo ?? "notice"} open`,
      tone: "text-red-800",
    };
  }
  const resubmitted = app.deficiencies.find((ticket) => ticket.status === "RESUBMITTED");
  if (resubmitted) {
    return {
      icon: <Clock3 size={10} className="text-amber-600" />,
      text: "Re-scrutiny of evidence pending",
      tone: "text-amber-800",
    };
  }
  const inspection =
    app.inspections.find((row) => row.siteReportStatus === "OVERDUE") ??
    app.inspections.find((row) => row.siteReportStatus === "PENDING");
  if (inspection) {
    return inspection.siteReportStatus === "OVERDUE"
      ? {
          icon: <ShieldAlert size={10} className="text-red-600" />,
          text: `Site report overdue · ${inspection.committeeLead}`,
          tone: "text-red-800",
        }
      : {
          icon: <Clock3 size={10} className="text-amber-600" />,
          text: `Visit ${inspection.committeeLead}`,
          tone: "text-amber-800",
        };
  }
  const flagged = app.ruleChecks.filter((rule) => rule.status !== "PASSED");
  if (flagged.length > 0) {
    return {
      icon: <AlertTriangle size={10} className="text-red-600" />,
      text: `${flagged.length} APH rule${flagged.length === 1 ? "" : "s"} flagged`,
      tone: "text-red-800",
    };
  }
  if (app.status === "APPROVED") {
    return {
      icon: <Gavel size={10} className="text-emerald-600" />,
      text: app.approvalOrderNo ?? "Approval order issued",
      tone: "text-emerald-800",
    };
  }
  return { icon: null, text: "No blocking exception", tone: "text-slate-400" };
}

export function PriorityTable({
  apps,
  limit = 7,
  title = "Priority docket",
  caption = "Active cases ranked by statutory clock pressure",
  href = "/applications",
  caseHrefBase = "/applications",
  onlyActive = true,
}: {
  apps: PortfolioApp[];
  limit?: number;
  title?: string;
  caption?: string;
  href?: string;
  caseHrefBase?: string;
  onlyActive?: boolean;
}) {
  const rows = slaRows(onlyActive ? activeApps(apps) : apps).slice(0, limit);
  const flaggedTotal = apps.reduce(
    (sum, app) => sum + app.ruleChecks.filter((rule) => rule.status !== "PASSED").length,
    0,
  );

  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Ranked intervention queue</div>
          <h2 className="panel-title mt-0.5">{title}</h2>
        </div>
        <div className="text-right text-[9px] text-slate-500">
          <div className="font-mono text-[11px] font-semibold text-navy-900">{rows.length} shown</div>
          <div>{flaggedTotal} rule exceptions</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Queue clear" description={caption} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[780px]">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Institution</th>
                <th>Status</th>
                <th className="w-[110px]">Stage clock</th>
                <th>Blocking exception</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ app, days, sla }) => {
                const blocker = blockerFor(app);
                const region = REGION_META[app.institution.region as Region];
                const flagCount = app.ruleChecks.filter((rule) => rule.status !== "PASSED").length;
                return (
                  <tr key={app.id} className={sla === "BREACHED" ? "bg-red-50/30" : undefined}>
                    <td>
                      <div className="font-mono text-[10px] font-semibold text-navy-900">
                        {shortRef(app.referenceNo)}
                      </div>
                      <div className="mt-0.5 text-[9px] text-slate-500">
                        {APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ??
                          app.applicationType.replaceAll("_", " ")}
                      </div>
                    </td>
                    <td>
                      <div className="max-w-[210px] truncate text-[11px] font-medium text-navy-950">
                        {app.institution.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                        {region?.code ?? app.institution.region.slice(0, 2)} · {app.institution.city}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={app.status} />
                      <div className="mt-1 text-[9px] text-slate-500">
                        {app.programName}
                        {app.intakeRequested ? ` · ${fmtNumber(app.intakeRequested)} seats` : ""}
                      </div>
                    </td>
                    <td>
                      <SlaBadge status={sla} days={days} />
                      <div className="mt-1.5 h-1 w-full bg-slate-200">
                        <div
                          className={
                            sla === "BREACHED"
                              ? "h-1 bg-red-600"
                              : sla === "WARNING"
                                ? "h-1 bg-amber-500"
                                : "h-1 bg-emerald-600"
                          }
                          style={{ width: `${Math.min(100, (days / 12) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className={`flex items-start gap-1 text-[10px] leading-snug ${blocker.tone}`}>
                        <span className="mt-px shrink-0">{blocker.icon}</span>
                        <span className="max-w-[230px]">{blocker.text}</span>
                      </div>
                      {flagCount > 0 && (
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-label text-slate-400">
                          {flagCount} APH exception{flagCount === 1 ? "" : "s"}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`${caseHrefBase}/${app.id}`}
                        aria-label={`Open ${app.referenceNo}`}
                        className="inline-flex h-6 w-6 items-center justify-center border border-slate-200 text-slate-400 transition hover:border-navy-400 hover:text-navy-800"
                      >
                        <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
        <Link
          href={href}
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-label text-navy-700 hover:text-navy-900"
        >
          Full register <ArrowUpRight size={9} />
        </Link>
      </div>
    </section>
  );
}
