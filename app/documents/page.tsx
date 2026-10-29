import Link from "next/link";
import { ArrowUpRight, Building2, CalendarClock, CheckCircle2, FileCheck2, FileClock, FileWarning, Filter, Search, ShieldCheck, X } from "lucide-react";
import { renewDocumentAction } from "@/app/actions";
import { fmtDate, fmtDateTime, isoDay, truncateHash } from "@/lib/format";
import { getDocuments, getEvidenceReuse } from "@/lib/queries";
import { getSession } from "@/lib/session";
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DOC_STATUS_META,
  REGION_META,
  can,
  type DocType,
  type Region,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocStatusBadge } from "@/components/ui/Badges";
import { CaseActionForm } from "@/components/case/CaseActionForm";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string; doc?: string; region?: string; renew?: string };

const STATUS_WEIGHT: Record<string, number> = {
  EXPIRED: 0,
  PENDING_RENEWAL: 1,
  EXPIRING_SOON: 2,
  VALID: 3,
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const documents = await getDocuments(session);
  const reuse = await getEvidenceReuse();

  const query = (params.q ?? "").trim().toLowerCase();
  const status = params.status ?? "ALL";
  const docFilter = params.doc ?? "ALL";
  const region = params.region ?? "ALL";

  const scoped = documents.filter((document) => {
    if (status !== "ALL" && document.status !== status) return false;
    if (docFilter !== "ALL" && document.docType !== docFilter) return false;
    if (region !== "ALL" && document.institution.region !== region) return false;
    if (query) {
      const haystack = [
        document.institution.name,
        document.institution.code,
        document.institution.city,
        document.documentRef,
        DOC_TYPE_LABELS[document.docType as DocType] ?? document.docType,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...scoped].sort((a, b) => {
    const weight = (value: string) => STATUS_WEIGHT[value] ?? 4;
    if (weight(a.status) !== weight(b.status)) return weight(a.status) - weight(b.status);
    return a.expiryDate.getTime() - b.expiryDate.getTime();
  });

  const counts = {
    valid: documents.filter((document) => document.status === "VALID").length,
    expiring: documents.filter((document) => document.status === "EXPIRING_SOON").length,
    expired: documents.filter((document) => document.status === "EXPIRED").length,
    pending: documents.filter((document) => document.status === "PENDING_RENEWAL").length,
  };
  const attention = documents.filter((document) => document.status !== "VALID");

  const visibleReuse =
    session.role === "INSTITUTION_ADMIN"
      ? reuse.filter((entry) =>
          entry.institutions.some((institution) => institution.id === session.tenant?.id),
        )
      : reuse;

  const selected = params.renew ? documents.find((document) => document.id === params.renew) ?? null : null;
  const canRenew = can(session.role, "RENEW_DOCUMENT");
  const selectedYears = selected?.docType === "LEASE_DEED" ? 10 : selected?.docType === "BUILDING_PLAN" ? 5 : 1;
  const renewalDate = selected
    ? isoDay(new Date(Date.now() + selectedYears * 365.25 * 86_400_000))
    : isoDay(new Date(Date.now() + 365 * 86_400_000));

  const hasFilters = query.length > 0 || status !== "ALL" || docFilter !== "ALL" || region !== "ALL";
  const statusOptions: Array<{ value: string; label: string }> = [
    { value: "ALL", label: "All statuses" },
    ...Object.entries(DOC_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Documents & renewals"
        title="Papers that expire — and papers that get copied"
        description="Every college must keep four documents alive: the land lease, the fire safety certificate, the sanctioned building plan and an undertaking. If one lapses, approval is blocked automatically. If a file is an exact copy of another college's, it is flagged."
        meta={
          <>
            <span className="badge border-navy-300 bg-navy-50 text-navy-900">{documents.length} documents</span>
            <span className="text-xs text-emerald-700">{counts.valid} valid</span>
            <span className={`text-xs ${counts.expiring > 0 ? "text-amber-700" : "text-slate-600"}`}>
              {counts.expiring} expiring
            </span>
            <span className={`text-xs ${counts.expired > 0 ? "font-semibold text-red-700" : "text-slate-600"}`}>
              {counts.expired} expired
            </span>
            {visibleReuse.length > 0 && (
              <span className="text-xs font-semibold text-red-700">
                {visibleReuse.length} copied file{visibleReuse.length === 1 ? "" : "s"}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Link href="/applications" className="btn btn-outline">
              {session.role === "INSTITUTION_ADMIN" ? (
                <>
                  <FileCheck2 size={13} /> My applications
                </>
              ) : (
                <>
                  <Building2 size={13} /> All applications
                </>
              )}
            </Link>
            <Link href="/audit" className="btn btn-outline">
              <ShieldCheck size={13} /> Audit log
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Valid documents"
          value={counts.valid}
          unit="documents"
          tone="emerald"
          icon={<CheckCircle2 size={15} />}
          detail={`${Math.round((counts.valid / Math.max(1, documents.length)) * 100)}% of everything on file`}
        />
        <MetricCard
          label="Expiring soon"
          value={counts.expiring}
          unit="documents"
          tone="amber"
          icon={<FileClock size={15} />}
          detail="Less than 120 days left"
        />
        <MetricCard
          label="Expired"
          value={counts.expired}
          unit="documents"
          tone="red"
          icon={<FileWarning size={15} />}
          detail="The rule check fails on these automatically"
        />
        <MetricCard
          label="Renewal pending"
          value={counts.pending}
          unit="documents"
          tone="slate"
          icon={<CalendarClock size={15} />}
          detail="New copy submitted, not yet accepted"
        />
      </div>

      {selected && (
        <section className="panel mb-4 border-l-2 border-l-brass-500">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Renew this document</div>
              <h2 className="panel-title mt-0.5">
                {DOC_TYPE_LABELS[selected.docType as DocType] ?? selected.docType} · {selected.institution.name}
              </h2>
            </div>
            <Link href="/documents" className="btn btn-ghost btn-xs">
              <X size={11} /> Close
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <DocStatusBadge status={selected.status} />
                <span className="badge border-slate-300 bg-white text-slate-700">
                  {REGION_META[selected.institution.region as Region]?.code ?? selected.institution.region} ·{" "}
                  {selected.institution.city}
                </span>
                <span className="font-mono text-2xs text-slate-500">{selected.documentRef}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <div>
                  <dt className="label">Expires on</dt>
                  <dd className="mt-0.5 font-mono text-sm text-navy-900">{fmtDate(selected.expiryDate)}</dd>
                </div>
                <div>
                  <dt className="label">Last checked</dt>
                  <dd className="mt-0.5 font-mono text-sm text-navy-900">{fmtDateTime(selected.lastVerifiedAt)}</dd>
                </div>
                <div>
                  <dt className="label">Held by</dt>
                  <dd className="mt-0.5 text-sm text-navy-900">{selected.institution.code}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                {selected.notes ??
                  "A renewal replaces the old dates and re-runs the rule check on every open application from this college."}
              </p>
              {canRenew ? (
                <div className="mt-4">
                  <CaseActionForm
                    action={renewDocumentAction}
                    hidden={{ documentId: selected.id }}
                    description={`Enter the new expiry and the reference printed on the fresh ${(
                      DOC_TYPE_LABELS[selected.docType as DocType] ?? selected.docType
                    ).toLowerCase()}. A ${selectedYears}-year term is suggested.`}
                    fields={[
                      {
                        name: "expiryDate",
                        label: "New expiry date",
                        type: "date",
                        required: true,
                        defaultValue: renewalDate,
                        hint: "Must be in the future.",
                      },
                      {
                        name: "documentRef",
                        label: "Reference on the new document",
                        type: "text",
                        defaultValue: selected.documentRef,
                        hint: "Registration, licence or sanction number.",
                      },
                    ]}
                    submitLabel="Save renewal"
                    pendingLabel="Saving…"
                    variant="emerald"
                    submitIcon={<FileCheck2 size={13} />}
                  />
                </div>
              ) : (
                <div className="mt-4 border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  Only the college can renew its own documents. Officers can see the expiry and open the affected
                  application.
                </div>
              )}
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3">
              <div className="eyebrow">All documents held by {selected.institution.code}</div>
              <div className="mt-2 space-y-2">
                {documents
                  .filter((document) => document.institutionId === selected.institutionId)
                  .map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-navy-900">
                          {DOC_TYPE_LABELS[document.docType as DocType] ?? document.docType}
                        </div>
                        <div className="font-mono text-2xs text-slate-400">{fmtDate(document.expiryDate)}</div>
                      </div>
                      <DocStatusBadge status={document.status} />
                    </div>
                  ))}
              </div>
              <Link
                href={`/applications?q=${encodeURIComponent(selected.institution.code)}`}
                className="btn btn-outline btn-xs mt-3 w-full"
              >
                Open applications <ArrowUpRight size={11} />
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="panel mb-4">
        <form
          method="get"
          action="/documents"
          className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-2 lg:grid-cols-12"
        >
          <div className="lg:col-span-4">
            <label htmlFor="q" className="field-label">
              Search
            </label>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="College, code or reference"
                className="input pl-7"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="status" className="field-label">
              Status
            </label>
            <select id="status" name="status" defaultValue={status} className="select">
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="doc" className="field-label">
              Document
            </label>
            <select id="doc" name="doc" defaultValue={docFilter} className="select">
              <option value="ALL">All documents</option>
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOC_TYPE_LABELS[type]}
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
              {(Object.keys(REGION_META) as Region[]).map((value) => (
                <option key={value} value={value}>
                  {REGION_META[value].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-1.5 lg:col-span-2">
            <button type="submit" className="btn btn-primary btn-xs w-full">
              <Filter size={11} /> Apply
            </button>
            {hasFilters && (
              <Link href="/documents" className="btn btn-ghost btn-xs" aria-label="Clear filters">
                <X size={11} />
              </Link>
            )}
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Expired first</div>
              <h2 className="panel-title mt-0.5">Document register</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">
              {sorted.length} of {documents.length}
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No documents match"
                description="Clear the filters to see the full register."
                icon={<FileCheck2 size={18} />}
              >
                <Link href="/documents" className="btn btn-outline btn-xs">
                  Reset filters
                </Link>
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>College</th>
                    <th className="w-[130px]">Expires</th>
                    <th className="w-[130px]">Status</th>
                    <th className="w-[80px]" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((document) => {
                    const meta = REGION_META[document.institution.region as Region];
                    return (
                      <tr
                        key={document.id}
                        className={document.status === "EXPIRED" ? "bg-red-50/30" : undefined}
                      >
                        <td>
                          <div className="text-xs font-semibold text-navy-950">
                            {DOC_TYPE_LABELS[document.docType as DocType] ?? document.docType}
                          </div>
                          <div className="mt-0.5 font-mono text-2xs text-slate-500">{document.documentRef}</div>
                        </td>
                        <td>
                          <div className="max-w-[230px] truncate text-xs font-medium text-navy-900">
                            {document.institution.name}
                          </div>
                          <div className="mt-0.5 font-mono text-2xs text-slate-500">
                            {meta?.code ?? document.institution.region.slice(0, 2)} · {document.institution.code}{" "}
                            · {document.institution.city}
                          </div>
                        </td>
                        <td>
                          <div className="font-mono text-xs text-slate-700">{fmtDate(document.expiryDate)}</div>
                          <div className="mt-0.5 font-mono text-2xs text-slate-400">
                            checked {fmtDate(document.lastVerifiedAt)}
                          </div>
                        </td>
                        <td>
                          <DocStatusBadge status={document.status} />
                        </td>
                        <td>
                          <Link
                            href={`/documents?renew=${document.id}${status !== "ALL" ? `&status=${status}` : ""}`}
                            className="inline-flex items-center gap-0.5 font-mono text-2xs font-semibold uppercase tracking-label text-navy-800 hover:underline"
                          >
                            {canRenew ? "Renew" : "Open"} <ArrowUpRight size={10} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Copy detection</div>
                <h2 className="panel-title mt-0.5">Same file, two colleges</h2>
              </div>
              <span className="font-mono text-xs font-semibold text-red-700">{visibleReuse.length}</span>
            </div>
            {visibleReuse.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No copied files found"
                  description="Every uploaded file is different from every other college's."
                  icon={<CheckCircle2 size={18} />}
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleReuse.map((entry) => (
                  <li key={entry.sha256} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-navy-950">
                          {entry.files[0]?.fileName ?? "Uploaded file"}
                        </div>
                        <div className="mt-0.5 text-2xs text-slate-500">
                          {entry.institutions.map((institution) => institution.name).join(" · ")}
                        </div>
                      </div>
                      <span className="badge border-red-300 bg-red-50 text-red-900">Exact copy</span>
                    </div>
                    <div className="mt-1.5 font-mono text-2xs text-slate-400">
                      file code {truncateHash(entry.sha256, 12, 6)}
                    </div>
                    <p className="mt-1.5 text-2xs leading-relaxed text-slate-500">
                      Both uploads are the same file, byte for byte. One of these colleges did not submit its own
                      document.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Needs attention</div>
                <h2 className="panel-title mt-0.5">Expiring & expired</h2>
              </div>
              <span className="font-mono text-xs font-semibold text-red-700">{attention.length}</span>
            </div>
            {attention.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Everything is valid"
                  description="No document is inside the renewal window."
                  icon={<CheckCircle2 size={18} />}
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {attention
                  .slice()
                  .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
                  .slice(0, 6)
                  .map((document) => (
                    <li key={document.id} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-navy-900">
                            {DOC_TYPE_LABELS[document.docType as DocType] ?? document.docType}
                          </div>
                          <div className="truncate text-2xs text-slate-500">{document.institution.name}</div>
                        </div>
                        <DocStatusBadge status={document.status} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-2xs uppercase tracking-label text-slate-400">
                        <span>Expires {fmtDate(document.expiryDate)}</span>
                        <Link href={`/documents?renew=${document.id}`} className="hover:text-navy-800">
                          {canRenew ? "Renew →" : "Open →"}
                        </Link>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">The rule, in plain words</div>
                <h2 className="panel-title mt-0.5">How a renewal works</h2>
              </div>
              <ShieldCheck size={16} className="text-slate-400" />
            </div>
            <ol className="space-y-2 p-4 text-xs leading-relaxed text-slate-600">
              <li>
                <span className="font-semibold text-navy-900">1.</span> The college enters the new expiry and the
                reference printed on the fresh document.
              </li>
              <li>
                <span className="font-semibold text-navy-900">2.</span> The register updates at the same moment the
                change is written to the audit log.
              </li>
              <li>
                <span className="font-semibold text-navy-900">3.</span> Every open application from that college is
                re-checked against the new date.
              </li>
              <li>
                <span className="font-semibold text-navy-900">4.</span> Nothing is edited silently — a correction is
                a new entry, never an overwrite.
              </li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
