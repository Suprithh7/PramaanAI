import Link from "next/link";
import { ArrowRight, CheckCircle2, FilePlus2, Search, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABELS,
  REGIONS,
  REGION_META,
  type ApplicationType,
  type Region,
} from "@/lib/types";
import { liveDaysInStage, slaForDays } from "@/lib/sla";
import { activeApps } from "@/lib/analytics";
import { getPortfolio } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { fmtDate, fmtNumber, shortRef } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlaBadge, StatusBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

const GROUPS = [
  { key: "ALL", label: "All", statuses: null as string[] | null },
  {
    key: "REVIEW",
    label: "In review",
    statuses: ["SUBMITTED", "UNDER_SCRUTINY", "RE_SCRUTINY"],
  },
  { key: "ACTION", label: "College must act", statuses: ["DEFICIENCY_REVERTED"] },
  {
    key: "INSPECTION",
    label: "Inspection",
    statuses: ["SCRUTINY_CLEARED", "EVC_SCHEDULED", "EVC_COMPLETED"],
  },
  { key: "DECIDED", label: "Decided", statuses: ["APPROVED", "REJECTED"] },
];

const NEXT_STEP: Record<string, string> = {
  SUBMITTED: "Waiting for an officer to start the review.",
  UNDER_SCRUTINY: "An officer is checking the application against AICTE rules.",
  DEFICIENCY_REVERTED: "The college must fix the listed deficiencies and respond.",
  RE_SCRUTINY: "The college has responded. The officer must re-check the file.",
  SCRUTINY_CLEARED: "All rules pass. A campus inspection can now be scheduled.",
  EVC_SCHEDULED: "A campus inspection is scheduled.",
  EVC_COMPLETED: "The inspection report is filed. A decision is pending.",
  SAC_REVIEW: "The file is with the standing review committee.",
  SHC_REVIEW: "The file is with the higher review committee.",
  APPROVED: "Approved. The order is available on the case page.",
  REJECTED: "Rejected. The reason is recorded on the case page.",
};

type SearchParams = {
  status?: string;
  region?: string;
  type?: string;
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
  const query = (params.q ?? "").trim();

  const all = await getPortfolio(session);
  const active = activeApps(all);
  const group = GROUPS.find((item) => item.key === status);
  const needle = query.toLowerCase();

  const filtered = all.filter((app) => {
    if (group && group.statuses && !group.statuses.includes(app.status)) return false;
    if (region !== "ALL" && app.institution.region !== region) return false;
    if (type !== "ALL" && app.applicationType !== type) return false;
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
    const terminal = (value: string) => value === "APPROVED" || value === "REJECTED";
    if (terminal(a.status) !== terminal(b.status)) return terminal(a.status) ? 1 : -1;
    const daysA = liveDaysInStage(a.stageEnteredAt);
    const daysB = liveDaysInStage(b.stageEnteredAt);
    return daysB - daysA;
  });

  const groupCount = (statuses: string[] | null) =>
    statuses ? all.filter((app) => statuses.includes(app.status)).length : all.length;
  const hasFilters = status !== "ALL" || region !== "ALL" || type !== "ALL" || query.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={session.role === "INSTITUTION_ADMIN" ? "Your college" : "AICTE · national queue"}
        title={session.role === "INSTITUTION_ADMIN" ? "My applications" : "Applications"}
        description={
          session.role === "INSTITUTION_ADMIN"
            ? `Every filing from ${session.tenant?.name ?? "your college"}, with the current rule status, deadline and next action.`
            : "Every approval application in one queue. Open a case to see the rule checks, documents, inspection and full history."
        }
        actions={
          session.role === "INSTITUTION_ADMIN" ? (
            <>
              <Link href="/documents" className="btn btn-outline">
                My documents
              </Link>
              <Link href="/applications/new" className="btn btn-primary">
                <FilePlus2 size={13} /> New application
              </Link>
            </>
          ) : (
            <Link href="/scrutiny" className="btn btn-primary">
              Officer review desk
            </Link>
          )
        }
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">
              {all.length} applications
            </span>
            <span className="badge border-slate-300 bg-white text-slate-700">
              {active.length} open
            </span>
            <span className="badge border-slate-300 bg-white text-slate-700">
              {all.length - active.length} decided
            </span>
          </>
        }
      />

      <div className="panel mb-4">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2.5">
          {GROUPS.map((item) => {
            const current = status === item.key;
            const count = groupCount(item.statuses);
            return (
              <Link
                key={item.key}
                href={item.key === "ALL" ? "/applications" : `/applications?status=${item.key}`}
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-semibold transition ${
                  current
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {item.label}
                <span className={`font-mono ${current ? "text-brass-200" : "text-slate-400"}`}>
                  {count}
                </span>
              </Link>
            );
          })}
          <span className="ml-auto text-xs text-slate-500">{sorted.length} shown</span>
        </div>

        <form
          method="get"
          action="/applications"
          className="grid gap-2 px-3 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]"
        >
          {status !== "ALL" && <input type="hidden" name="status" value={status} />}
          <div>
            <label htmlFor="q" className="field-label">
              Search
            </label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                id="q"
                name="q"
                defaultValue={query}
                placeholder="College, program or reference number"
                className="input pl-8"
              />
            </div>
          </div>
          <div>
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
          <div>
            <label htmlFor="type" className="field-label">
              Type
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
          <div className="flex items-end gap-1.5">
            <button type="submit" className="btn btn-primary">
              Apply
            </button>
            {hasFilters && (
              <Link href="/applications" className="btn btn-ghost" aria-label="Clear filters">
                <X size={14} /> Clear
              </Link>
            )}
          </div>
        </form>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="Nothing matches this view" description="Clear a filter or try a different search.">
          <Link href="/applications" className="btn btn-outline btn-xs">
            Reset filters
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((app) => {
            const days = liveDaysInStage(app.stageEnteredAt);
            const sla = slaForDays(days);
            const decided = app.status === "APPROVED" || app.status === "REJECTED";
            const flagged = app.ruleChecks.filter((rule) => rule.status !== "PASSED").length;
            const openNotice = app.deficiencies.find((ticket) => ticket.status === "OPEN");
            const inspection = app.inspections[0];
            const regionMeta = REGION_META[app.institution.region as Region];
            return (
              <li key={app.id}>
                <Link
                  href={`/applications/${app.id}`}
                  className={`panel group grid gap-3 p-4 transition hover:border-navy-400 hover:shadow-panel-lift lg:grid-cols-[150px_minmax(0,1.6fr)_minmax(0,1.4fr)_170px_20px] lg:items-center ${
                    sla === "BREACHED" && !decided ? "border-l-4 border-l-red-500" : ""
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-navy-800">
                      {shortRef(app.referenceNo)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType] ??
                        app.applicationType.replaceAll("_", " ")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-navy-950 group-hover:text-brass-700">
                      {app.institution.name}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-slate-600">{app.programName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {regionMeta?.label ?? app.institution.region} · {app.institution.city}
                      {app.intakeRequested ? ` · ${fmtNumber(app.intakeRequested)} seats` : ""}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <StatusBadge status={app.status} />
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {NEXT_STEP[app.status] ?? app.status.replaceAll("_", " ")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {flagged > 0 ? (
                        <span className="font-semibold text-red-700">
                          {flagged} rule{flagged === 1 ? "" : "s"} failing
                        </span>
                      ) : (
                        <span className="font-semibold text-emerald-700">All rules pass</span>
                      )}
                      {openNotice && (
                        <span className="text-slate-500">
                          Notice due {fmtDate(openNotice.complianceDeadline)}
                        </span>
                      )}
                      {inspection && (
                        <span className="text-slate-500">
                          Inspector: {inspection.committeeLead.split(",")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {decided ? (
                      <>
                        <span className="badge border-slate-300 bg-white text-slate-700">
                          <CheckCircle2 size={9} /> Closed
                        </span>
                        <div className="mt-1 text-[11px] text-slate-500">Decision recorded</div>
                      </>
                    ) : (
                      <>
                        <SlaBadge status={sla} days={days} />
                        <div className="mt-1 text-[11px] text-slate-500">
                          {sla === "BREACHED"
                            ? "Past deadline — escalated"
                            : sla === "WARNING"
                              ? "Deadline approaching"
                              : "Inside deadline"}
                        </div>
                      </>
                    )}
                  </div>
                  <ArrowRight
                    size={16}
                    className="hidden text-slate-300 transition group-hover:text-navy-700 lg:block"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
