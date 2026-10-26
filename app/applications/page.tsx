import Link from "next/link";
import { ArrowUpRight, Download, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABELS,
  PROCESSING_PATH_META,
  REGIONS,
  REGION_META,
  STATUS_META,
  type ApplicationType,
  type ProcessingPath,
  type Region,
} from "@/lib/types";
import { liveDaysInStage, slaForDays } from "@/lib/sla";
import { activeApps, ruleStats } from "@/lib/analytics";
import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { fmtDate, fmtNumber, relativeDays, shortRef } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeficiencyStatusBadge, EvcReportBadge, SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { EmptyState, SlaMeter } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

type StatusGroup = { key: string; label: string; statuses: string[] | null };

const STATUS_GROUPS: StatusGroup[] = [
  { key: "ALL", label: "All filings", statuses: null },
  { key: "SCRUTINY", label: "Scrutiny", statuses: ["SUBMITTED", "UNDER_SCRUTINY"] },
  { key: "DEFICIENCY", label: "Deficiency loop", statuses: ["DEFICIENCY_REVERTED", "RE_SCRUTINY"] },
  { key: "EVC", label: "EVC stage", statuses: ["SCRUTINY_CLEARED", "EVC_SCHEDULED", "EVC_COMPLETED"] },
  { key: "COUNCIL", label: "Council", statuses: ["SAC_REVIEW", "SHC_REVIEW"] },
  { key: "DECIDED", label: "Decided", statuses: ["APPROVED", "REJECTED"] },
];

type SearchParams = {
  status?: string;
  region?: string;
  type?: string;
  sla?: string;
  q?: string;
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const status = params.status ?? "ALL";
  const region = params.region ?? "ALL";
  const type = params.type ?? "ALL";
  const sla = params.sla ?? "ALL";
  const query = (params.q ?? "").trim();

  const all = await getPortfolio(session);
  const rules = ruleStats(all);
  const active = activeApps(all);
  const breached = active.filter((app) => slaForDays(liveDaysInStage(app.stageEnteredAt)) === "BREACHED").length;
  const flagged = all.filter((app) => app.ruleChecks.some((rule) => rule.status !== "PASSED")).length;
  const openDeficiencies = all.reduce(
    (sum, app) => sum + app.deficiencies.filter((ticket) => ticket.status !== "RESOLVED").length,
    0,
  );

  const group = STATUS_GROUPS.find((item) => item.key === status);
  const needle = query.toLowerCase();

  const filtered = all.filter((app) => {
    if (group && group.statuses && !group.statuses.includes(app.status)) return false;
    if (!group && status !== "ALL" && app.status !== status) return false;
    if (region !== "ALL" && app.institution.region !== region) return false;
    if (type !== "ALL" && app.applicationType !== type) return false;
    const slaStatus = slaForDays(liveDaysInStage(app.stageEnteredAt));
    if (sla !== "ALL" && slaStatus !== sla) return false;
    if (needle) {
      const haystack = [
        app.referenceNo,
        app.institution.name,
        app.institution.code,
        app.institution.city,
        app.programName,
        app.approvalOrderNo ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const daysA = liveDaysInStage(a.stageEnteredAt);
    const daysB = liveDaysInStage(b.stageEnteredAt);
    const weight = (days: number, statusValue: string) =>
      ["APPROVED", "REJECTED"].includes(statusValue) ? 0 : days > 10 ? 3 : days >= 5 ? 2 : 1;
    if (weight(daysA, a.status) !== weight(daysB, b.status)) {
      return weight(daysB, b.status) - weight(daysA, a.status);
    }
    return daysB - daysA;
  });

  const groupCount = (statuses: string[] | null) =>
    statuses ? all.filter((app) => statuses.includes(app.status)).length : all.length;

  const hasFilters = status !== "ALL" || region !== "ALL" || type !== "ALL" || sla !== "ALL" || query.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={session.role === "INSTITUTION_ADMIN" ? "Institutional filings" : "National application register"}
        title={session.role === "INSTITUTION_ADMIN" ? "My applications" : "Application register"}
        description={
          session.role === "INSTITUTION_ADMIN"
            ? `Every filing held by ${session.tenant?.name ?? "the selected institution"}, including live deficiencies and inspection status.`
            : "The consolidated APH pipeline across all regions, processing paths and statutory clocks. Select a filing to open its full case workspace."
        }
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">{all.length} filings</span>
            <span className="text-[10px] text-slate-600">{active.length} active</span>
            <span className="text-[10px] text-slate-600">{openDeficiencies} open notice{openDeficiencies === 1 ? "" : "s"}</span>
            <span className={`text-[10px] font-semibold ${breached > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {breached} SLA breach{breached === 1 ? "" : "es"}
            </span>
            <span className="text-[10px] text-slate-600">
              APH pass rate {rules.rate}% · {rules.flagged} flag{rules.flagged === 1 ? "" : "s"}
            </span>
          </>
        }
        actions={
          session.role === "INSTITUTION_ADMIN" ? (
            <Link href="/compliance" className="btn btn-outline">
              <Download size={11} /> Compliance renewals
            </Link>
          ) : (
            <Link href="/scrutiny" className="btn btn-primary">
              <SlidersHorizontal size={11} /> Scrutiny desk
            </Link>
          )
        }
      />

      <div className="space-y-4">
        <div className="panel">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 py-2.5">
            {STATUS_GROUPS.map((item) => {
              const activeTab = status === item.key || (item.key === "ALL" && status === "ALL");
              const count = groupCount(item.statuses);
              const href = `/applications${item.key === "ALL" ? "" : `?status=${item.key}`}`;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`inline-flex items-center gap-1.5 border px-2 py-1 text-3xs font-semibold uppercase tracking-label transition ${
                    activeTab
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                  <span className={`font-mono ${activeTab ? "text-brass-200" : "text-slate-400"}`}>{count}</span>
                </Link>
              );
            })}
            <span className="ml-auto hidden items-center gap-1 text-[9px] text-slate-500 sm:flex">
              <Filter size={10} /> {sorted.length} matched
            </span>
          </div>

          <form method="get" action="/applications" className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label htmlFor="q" className="field-label">
                Search
              </label>
              <div className="relative">
                <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="q"
                  name="q"
                  defaultValue={query}
                  placeholder="Reference, institution, program or order no."
                  className="input pl-7"
                />
              </div>
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="status" className="field-label">
                Status
              </label>
              <select id="status" name="status" defaultValue={status} className="select">
                <option value="ALL">All statuses</option>
                {STATUS_GROUPS.filter((item) => item.key !== "ALL").map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
                {Object.entries(STATUS_META).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="region" className="field-label">
                Region
              </label>
              <select id="region" name="region" defaultValue={region} className="select">
                <option value="ALL">All regions</option>
                {REGIONS.map((value) => (
                  <option key={value} value={value}>
                    {REGION_META[value].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="type" className="field-label">
                Application type
              </label>
              <select id="type" name="type" defaultValue={type} className="select">
                <option value="ALL">All types</option>
                {Object.entries(APPLICATION_TYPE_LABELS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label htmlFor="sla" className="field-label">
                SLA
              </label>
              <select id="sla" name="sla" defaultValue={sla} className="select">
                <option value="ALL">Any</option>
                <option value="ON_TRACK">On track</option>
                <option value="WARNING">Warning</option>
                <option value="BREACHED">Breached</option>
              </select>
            </div>
            <div className="flex items-end gap-1.5 lg:col-span-1">
              <button type="submit" className="btn btn-primary btn-xs w-full">
                Apply
              </button>
              {hasFilters && (
                <Link href="/applications" className="btn btn-ghost btn-xs" aria-label="Clear filters">
                  <X size={11} />
                </Link>
              )}
            </div>
          </form>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Case register · statutory clock order</div>
              <h2 className="panel-title mt-0.5">
                {STATUS_GROUPS.find((item) => item.key === status)?.label ?? "Filtered applications"}
              </h2>
            </div>
            <div className="text-right text-[9px] text-slate-500">
              <div className="font-mono text-[11px] font-semibold text-navy-900">{sorted.length} shown</div>
              <div>{all.length - sorted.length} filtered out</div>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No filings match this view"
                description="Clear one or more filters, or switch the status group to inspect the wider register."
              >
                <Link href="/applications" className="btn btn-outline btn-xs">
                  Reset filters
                </Link>
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1120px]">
                <thead>
                  <tr>
                    <th className="w-[130px]">Reference</th>
                    <th>Institution</th>
                    <th>Program / intake</th>
                    <th className="w-[130px]">Processing path</th>
                    <th className="w-[130px]">Status</th>
                    <th className="w-[150px]">Stage clock</th>
                    <th className="w-[160px]">Deficiency</th>
                    <th className="w-[130px]">EVC</th>
                    <th className="w-[90px]">Updated</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((app) => {
                    const days = liveDaysInStage(app.stageEnteredAt);
                    const slaStatus = slaForDays(days);
                    const regionMeta = REGION_META[app.institution.region as Region];
                    const openTicket = app.deficiencies.find((ticket) => ticket.status === "OPEN");
                    const pendingTicket = app.deficiencies.find((ticket) => ticket.status === "RESUBMITTED");
                    const inspection = app.inspections[0];
                    const flaggedRules = app.ruleChecks.filter((rule) => rule.status !== "PASSED");
                    return (
                      <tr key={app.id} className={slaStatus === "BREACHED" ? "bg-red-50/25" : undefined}>
                        <td>
                          <Link
                            href={`/applications/${app.id}`}
                            className="font-mono text-[10px] font-semibold text-navy-900 underline decoration-slate-300 underline-offset-2 hover:decoration-navy-600"
                          >
                            {shortRef(app.referenceNo)}
                          </Link>
                          <div className="mt-0.5 text-[9px] text-slate-500">
                            {APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ??
                              app.applicationType.replaceAll("_", " ")}
                          </div>
                        </td>
                        <td>
                          <div className="max-w-[230px] truncate text-[11px] font-medium text-navy-950">
                            {app.institution.name}
                          </div>
                          <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                            {regionMeta?.code ?? app.institution.region.slice(0, 2)} · {app.institution.city} · {app.institution.code}
                          </div>
                        </td>
                        <td>
                          <div className="max-w-[180px] truncate text-[10px] text-slate-700">{app.programName}</div>
                          <div className="mt-0.5 text-[9px] text-slate-500">
                            {app.intakeRequested ? `${fmtNumber(app.intakeRequested)} seats` : "No intake change"}
                          </div>
                        </td>
                        <td>
                          <div className="text-[10px] text-slate-700">
                            {PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.label ??
                              app.processingPath}
                          </div>
                          <div
                            className="max-w-[128px] truncate font-mono text-[8px] uppercase tracking-label text-slate-400"
                            title={PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.route ?? app.processingPath}
                          >
                            {PROCESSING_PATH_META[app.processingPath as ProcessingPath]?.route ??
                              app.processingPath}
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={app.status} />
                          {flaggedRules.length > 0 && (
                            <div className="mt-1 text-[8px] font-semibold uppercase tracking-label text-red-700">
                              {flaggedRules.length} APH flag{flaggedRules.length === 1 ? "" : "s"}
                            </div>
                          )}
                        </td>
                        <td>
                          <SlaBadge status={slaStatus} days={days} />
                          <div className="mt-1.5">
                            <SlaMeter days={days} />
                          </div>
                        </td>
                        <td>
                          {openTicket ? (
                            <>
                              <DeficiencyStatusBadge status="OPEN" />
                              <div className="mt-1 font-mono text-[8px] text-slate-500">
                                {openTicket.noticeNo ?? "Notice"} · due {fmtDate(openTicket.complianceDeadline)}
                              </div>
                            </>
                          ) : pendingTicket ? (
                            <>
                              <DeficiencyStatusBadge status="RESUBMITTED" />
                              <div className="mt-1 font-mono text-[8px] text-slate-500">
                                Re-scrutiny pending
                              </div>
                            </>
                          ) : (
                            <span className="text-[9px] text-slate-400">No open notice</span>
                          )}
                        </td>
                        <td>
                          {inspection ? (
                            <>
                              <EvcReportBadge status={inspection.siteReportStatus} />
                              <div className="mt-1 truncate text-[8px] text-slate-500">
                                {inspection.committeeLead}
                              </div>
                            </>
                          ) : (
                            <span className="text-[9px] text-slate-400">Not constituted</span>
                          )}
                        </td>
                        <td>
                          <div className="text-[10px] text-slate-600">{relativeDays(app.updatedAt)}</div>
                          <div className="mt-0.5 font-mono text-[8px] text-slate-400">{fmtDate(app.updatedAt)}</div>
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/applications/${app.id}`}
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

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[9px] text-slate-500">
            <span className="font-mono">
              LEDGER-VERIFIED · {active.length} ACTIVE / {all.length} TOTAL
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
