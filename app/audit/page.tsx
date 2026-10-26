import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Filter,
  Fingerprint,
  Link2,
  Lock,
  Search,
  ShieldCheck,
  ShieldX,
  X,
} from "lucide-react";
import { attestLedgerAction } from "@/app/actions";
import { prisma } from "@/lib/db";
import { verifyAuditLedger } from "@/lib/audit";
import { fmtDateTime, fmtNumber, shortRef, truncateHash } from "@/lib/format";
import { getSession } from "@/lib/session";
import {
  AUDIT_ACTION_LABELS,
  ROLE_META,
  ROLES,
  auditActionLabel,
  isRole,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState, MiniBar } from "@/components/ui/EmptyState";
import { ActionButton } from "@/components/ui/ActionFeedback";
import { CopyButton } from "@/components/ui/CopyButton";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; action?: string; role?: string; page?: string };

const PAGE_SIZE = 30;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const action = params.action ?? "ALL";
  const roleFilter = params.role ?? "ALL";
  const requestedPage = Math.max(1, Number(params.page) || 1);

  const scope = session.role === "INSTITUTION_ADMIN" ? { institutionId: session.tenant?.id ?? "__no_tenant__" } : {};

  const logs = await prisma.auditLog.findMany({
    where: scope,
    orderBy: { sequence: "desc" },
    take: 1000,
    include: {
      application: {
        select: {
          id: true,
          referenceNo: true,
          institution: { select: { name: true, code: true } },
        },
      },
      institution: { select: { name: true, code: true } },
    },
  });

  const filtered = logs.filter((log) => {
    if (action !== "ALL" && log.action !== action) return false;
    if (roleFilter !== "ALL" && log.role !== roleFilter) return false;
    if (query) {
      const haystack = [
        log.performedBy,
        log.role,
        log.action,
        log.detail ?? "",
        log.hashChecksum,
        log.application?.referenceNo ?? "",
        log.application?.institution.name ?? "",
        log.institution?.name ?? "",
        log.institution?.code ?? "",
        String(log.sequence),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const verification = await verifyAuditLedger();
  const actionValues = Array.from(new Set(logs.map((log) => log.action))).sort((a, b) =>
    auditActionLabel(a).localeCompare(auditActionLabel(b)),
  );
  const actionCounts = actionValues
    .map((value) => ({ value, count: logs.filter((log) => log.action === value).length }))
    .sort((a, b) => b.count - a.count);
  const roleCounts: Array<{ value: string; count: number }> = [
    ...ROLES.map((value) => ({
      value,
      count: logs.filter((log) => log.role === value).length,
    })),
    { value: "SYSTEM", count: logs.filter((log) => log.role === "SYSTEM").length },
  ];
  const maxAction = actionCounts[0]?.count ?? 1;
  const institutionalEvents = logs.filter((log) => log.applicationId || log.institutionId).length;
  const systemEvents = logs.filter((log) => log.role === "SYSTEM").length;

  const filterEntries = [
    query ? ["q", query] : null,
    action !== "ALL" ? ["action", action] : null,
    roleFilter !== "ALL" ? ["role", roleFilter] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const pageHref = (target: number) => {
    const search = new URLSearchParams(filterEntries);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/audit${suffix ? `?${suffix}` : ""}`;
  };

  const hasFilters = filterEntries.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Assurance · append-only evidence"
        title="Immutable audit ledger"
        description="Every approval decision, deficiency notice, inspection report and renewal is appended as a SHA-256 hash-linked event. SQLite triggers block UPDATE and DELETE; the chain is re-verified on every page load."
        meta={
          <>
            <span
              className={`badge ${
                verification.valid
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              {verification.valid ? <ShieldCheck size={9} /> : <ShieldX size={9} />}
              {verification.valid ? "Chain verified" : "Chain fault"}
            </span>
            <span className="text-[10px] text-slate-600">{fmtNumber(verification.entries)} global entries</span>
            <span className="text-[10px] text-slate-600">{institutionalEvents} institutional events in scope</span>
            <span className="text-[10px] text-slate-600">{systemEvents} automation events</span>
            <span className="text-[10px] uppercase tracking-label text-slate-400">
              {verification.triggers.length} tamper-prevention trigger{verification.triggers.length === 1 ? "" : "s"}
            </span>
          </>
        }
        actions={
          <>
            <Link href="/" className="btn btn-outline">
              <Activity size={11} /> Command centre
            </Link>
            {session.role === "BUREAU_OFFICER" || session.role === "COMPLIANCE_HEAD" ? (
              <ActionButton
                action={attestLedgerAction}
                fields={{}}
                label="Attest ledger"
                pendingLabel="Hashing…"
                variant="primary"
                size="sm"
                icon={<Fingerprint size={11} />}
              />
            ) : null}
          </>
        }
      />

      <div className={`mb-4 border p-3 ${verification.valid ? "border-emerald-300 bg-emerald-50/60" : "border-red-300 bg-red-50/70"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            {verification.valid ? (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : (
              <ShieldX size={15} className="mt-0.5 shrink-0 text-red-700" />
            )}
            <div>
              <div className={`text-[11px] font-semibold ${verification.valid ? "text-emerald-900" : "text-red-900"}`}>
                {verification.valid
                  ? `Hash chain intact across ${fmtNumber(verification.entries)} entries.`
                  : `Chain integrity fault at entry #${verification.brokenAtSequence}.`}
              </div>
              <div className={`mt-0.5 text-[9px] leading-relaxed ${verification.valid ? "text-emerald-800" : "text-red-800"}`}>
                {verification.valid
                  ? `Every previousHash matches its predecessor and every checksum recomputes. ${verification.triggers.join(", ") || "SQLite triggers"} reject mutation of AuditLog rows.`
                  : verification.reason}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 border border-slate-300 bg-white px-2 py-1">
            <span className="font-mono text-[9px] text-slate-500">HEAD</span>
            <span className="font-mono text-[9px] font-semibold text-navy-900">
              {verification.headHash ? truncateHash(verification.headHash, 14, 10) : "GENESIS"}
            </span>
            {verification.headHash && <CopyButton value={verification.headHash} label="" />}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          label="Global chain length"
          value={fmtNumber(verification.entries)}
          unit="entries"
          tone="navy"
          icon={<Database size={13} />}
          detail={verification.headHash ? `Head ${truncateHash(verification.headHash, 8, 6)}` : "No events appended"}
        />
        <MetricCard
          label="Latest sequence"
          value={verification.entries > 0 ? `#${String(verification.entries).padStart(4, "0")}` : "—"}
          tone="brass"
          icon={<Link2 size={13} />}
          detail={`Append-only · ${verification.triggers.length} trigger(s) armed`}
        />
        <MetricCard
          label="Scoped events"
          value={fmtNumber(logs.length)}
          unit="rows"
          tone="emerald"
          icon={<ShieldCheck size={13} />}
          detail={session.role === "INSTITUTION_ADMIN" ? "Tenant-scoped institutional evidence" : "National ledger view"}
        />
        <MetricCard
          label="Verification"
          value={verification.valid ? "PASS" : "FAULT"}
          tone={verification.valid ? "emerald" : "red"}
          icon={verification.valid ? <CheckCircle2 size={13} /> : <ShieldX size={13} />}
          detail={verification.valid ? "Recomputed on this request" : `Broken at #${verification.brokenAtSequence}`}
        />
      </div>

      <div className="panel mb-4">
        <form method="get" action="/audit" className="grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <label htmlFor="q" className="field-label">Search evidence</label>
            <div className="relative">
              <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="q"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Actor, case reference, detail, hash…"
                className="input pl-7"
              />
            </div>
          </div>
          <div className="lg:col-span-3">
            <label htmlFor="action" className="field-label">Event type</label>
            <select id="action" name="action" defaultValue={action} className="select">
              <option value="ALL">All events</option>
              {actionValues.map((value) => (
                <option key={value} value={value}>{AUDIT_ACTION_LABELS[value] ?? value.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="role" className="field-label">Actor role</label>
            <select id="role" name="role" defaultValue={roleFilter} className="select">
              <option value="ALL">All roles</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>{ROLE_META[value].label}</option>
              ))}
              <option value="SYSTEM">System automation</option>
            </select>
          </div>
          <div className="flex items-end gap-1.5 lg:col-span-2">
            <button type="submit" className="btn btn-primary btn-xs w-full">
              <Filter size={10} /> Apply
            </button>
            {hasFilters && (
              <Link href="/audit" className="btn btn-ghost btn-xs" aria-label="Clear filters">
                <X size={11} />
              </Link>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Sequence order · newest first</div>
              <h2 className="panel-title mt-0.5">Cryptographic event stream</h2>
            </div>
            <div className="text-right text-[9px] text-slate-500">
              <div className="font-mono text-[11px] font-semibold text-navy-900">
                {filtered.length} matched
              </div>
              <div>
                Page {page} of {totalPages}
              </div>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No ledger events match"
                description="Clear the search or event filters to inspect the full evidence trail."
                icon={<Fingerprint size={16} />}
              >
                <Link href="/audit" className="btn btn-outline btn-xs">Reset filters</Link>
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[940px]">
                <thead>
                  <tr>
                    <th className="w-[92px]">Seq / time</th>
                    <th className="w-[168px]">Event</th>
                    <th className="w-[148px]">Actor</th>
                    <th className="w-[160px]">Subject</th>
                    <th className="w-[116px]">Transition</th>
                    <th>Detail</th>
                    <th className="w-[136px]">SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((log) => {
                    const subject = log.application?.institution ?? log.institution;
                    return (
                      <tr key={log.id}>
                        <td>
                          <div className="font-mono text-[9px] font-semibold text-navy-900">
                            #{String(log.sequence).padStart(4, "0")}
                          </div>
                          <div className="mt-0.5 font-mono text-[8px] leading-tight text-slate-400">
                            {fmtDateTime(log.timestamp)}
                          </div>
                        </td>
                        <td>
                          <div className="text-[10px] font-semibold text-navy-950">{auditActionLabel(log.action)}</div>
                          <div className="mt-0.5 font-mono text-[8px] uppercase tracking-label text-slate-400">
                            {log.action}
                          </div>
                        </td>
                        <td>
                          <div className="text-[10px] text-slate-700">{log.performedBy}</div>
                          <div className="mt-0.5 text-[8px] uppercase tracking-label text-slate-400">
                            {isRole(log.role) ? ROLE_META[log.role].label : "System automation"}
                          </div>
                        </td>
                        <td>
                          {log.application ? (
                            <>
                              <Link
                                href={`/applications/${log.application.id}?tab=ledger`}
                                className="font-mono text-[8px] font-semibold text-navy-800 underline decoration-slate-300 underline-offset-2 hover:decoration-navy-700"
                              >
                                {shortRef(log.application.referenceNo)}
                              </Link>
                              <div className="mt-0.5 max-w-[150px] truncate text-[9px] text-slate-600">
                                {subject?.name ?? "Application"}
                              </div>
                            </>
                          ) : subject ? (
                            <>
                              <div className="text-[9px] text-slate-700">{subject.name}</div>
                              <div className="mt-0.5 font-mono text-[8px] text-slate-400">{subject.code}</div>
                            </>
                          ) : (
                            <span className="text-[9px] uppercase tracking-label text-slate-400">Platform-wide</span>
                          )}
                        </td>
                        <td className="font-mono text-[8px] text-slate-600">
                          {log.previousState ?? "—"} → {log.newState ?? "—"}
                        </td>
                        <td className="text-[9px] leading-relaxed text-slate-600">{log.detail ?? "—"}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <span className="hash" title={log.hashChecksum}>
                              {truncateHash(log.hashChecksum, 10, 6)}
                            </span>
                            <CopyButton value={log.hashChecksum} label="" />
                          </div>
                          {log.previousHash && (
                            <div className="mt-0.5 font-mono text-[7px] text-slate-400">
                              prev {truncateHash(log.previousHash, 6, 4)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-3 py-2">
            <span className="text-[9px] text-slate-500">
              Showing {visible.length} of {filtered.length} scoped events · {fmtNumber(verification.entries)} in the global chain.
            </span>
            <div className="flex items-center gap-1">
              <Link
                href={pageHref(Math.max(1, page - 1))}
                aria-disabled={page === 1}
                className={`btn btn-outline btn-xs ${page === 1 ? "pointer-events-none opacity-40" : ""}`}
              >
                <ArrowLeft size={10} /> Prev
              </Link>
              <span className="px-1 font-mono text-[9px] text-slate-500">
                {page}/{totalPages}
              </span>
              <Link
                href={pageHref(Math.min(totalPages, page + 1))}
                aria-disabled={page === totalPages}
                className={`btn btn-outline btn-xs ${page === totalPages ? "pointer-events-none opacity-40" : ""}`}
              >
                Next <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Chain construction</div>
                <h2 className="panel-title mt-0.5">Why this is tamper-evident</h2>
              </div>
              <Lock size={14} className="text-slate-400" />
            </div>
            <ol className="space-y-2 p-4 text-[9px] leading-relaxed text-slate-600">
              <li><span className="font-semibold text-navy-900">1.</span> Each event hashes its canonical fields, the previous checksum and an IST timestamp with SHA-256.</li>
              <li><span className="font-semibold text-navy-900">2.</span> The checksum becomes the previousHash of the next event, forming an unbroken global chain.</li>
              <li><span className="font-semibold text-navy-900">3.</span> Sequence numbers must remain contiguous; a gap fails verification immediately.</li>
              <li><span className="font-semibold text-navy-900">4.</span> SQLite triggers reject UPDATE and DELETE on the AuditLog table, independent of application code.</li>
            </ol>
            </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Event composition</div>
                <h2 className="panel-title mt-0.5">Action mix</h2>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{logs.length}</span>
            </div>
            <div className="space-y-2 p-4">
              {actionCounts.slice(0, 7).map((row) => (
                <div key={row.value}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[9px]">
                    <span className="truncate text-slate-600">{auditActionLabel(row.value)}</span>
                    <span className="font-mono text-navy-900">{row.count}</span>
                  </div>
                  <MiniBar value={row.count} max={maxAction} tone="navy" height="h-1" />
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Actor composition</div>
                <h2 className="panel-title mt-0.5">Authority mix</h2>
              </div>
              <ShieldCheck size={14} className="text-slate-400" />
            </div>
            <div className="divide-y divide-slate-100">
              {roleCounts
                .filter((row) => row.count > 0)
                .map((row) => (
                  <div key={row.value} className="flex items-center justify-between gap-2 px-4 py-1.5">
                    <span className="text-[9px] text-slate-600">
                      {isRole(row.value) ? ROLE_META[row.value].label : "System automation"}
                    </span>
                    <span className="font-mono text-[10px] text-navy-900">{row.count}</span>
                  </div>
                ))}
            </div>
            <div className="border-t border-slate-200 px-4 py-2 text-[8px] uppercase tracking-label text-slate-400">
              Head {verification.entries > 0 ? `#${String(verification.entries).padStart(4, "0")}` : "genesis"} ·{" "}
              {verification.triggers.length} triggers
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
