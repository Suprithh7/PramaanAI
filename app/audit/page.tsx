import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Filter,
  Fingerprint,
  Lock,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Unlock,
  X,
} from "lucide-react";
import { attestLedgerAction, repairLedgerAction, simulateTamperAction } from "@/app/actions";
import { prisma } from "@/lib/db";
import { verifyAuditLedger } from "@/lib/audit";
import { fmtDateTime, fmtNumber, shortRef, truncateHash } from "@/lib/format";
import { readLedgerBackup } from "@/lib/ledger-demo";
import { getSession } from "@/lib/session";
import { AUDIT_ACTION_LABELS, ROLE_META, ROLES, auditActionLabel, isRole } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
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
  const demoActive = Boolean(await readLedgerBackup());
  const actionValues = Array.from(new Set(logs.map((log) => log.action))).sort((a, b) =>
    auditActionLabel(a).localeCompare(auditActionLabel(b)),
  );

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
        eyebrow="Audit trail"
        title="Every action is written in stone"
        description="This is the receipt book for the whole system. Each entry carries a security code built from its own contents and the entry before it, so changing one line breaks every line that follows. The database itself refuses edits and deletes."
        meta={
          <>
            <span
              className={`badge ${
                verification.valid
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              {verification.valid ? <ShieldCheck size={11} /> : <ShieldX size={11} />}
              {verification.valid ? "Record intact" : "Record altered"}
            </span>
            <span className="text-xs text-slate-600">{fmtNumber(verification.entries)} entries recorded</span>
            <span className="text-xs text-slate-600">
              {verification.triggers.length} tamper guard{verification.triggers.length === 1 ? "" : "s"} active
            </span>
          </>
        }
        actions={
          <>
            <Link href="/" className="btn btn-outline">
              <Activity size={13} /> Dashboard
            </Link>
            {session.role === "BUREAU_OFFICER" || session.role === "COMPLIANCE_HEAD" ? (
              <ActionButton
                action={attestLedgerAction}
                fields={{}}
                label="Verify and sign off"
                pendingLabel="Checking…"
                variant="primary"
                size="sm"
                icon={<Fingerprint size={13} />}
              />
            ) : null}
          </>
        }
      />

      <div
        className={`mb-4 border p-4 ${
          verification.valid ? "border-emerald-300 bg-emerald-50/60" : "border-red-300 bg-red-50/70"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            {verification.valid ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : (
              <ShieldX size={18} className="mt-0.5 shrink-0 text-red-700" />
            )}
            <div>
              <div
                className={`text-sm font-semibold ${verification.valid ? "text-emerald-900" : "text-red-900"}`}
              >
                {verification.valid
                  ? `All ${fmtNumber(verification.entries)} entries check out.`
                  : `Someone changed entry #${verification.brokenAtSequence}.`}
              </div>
              <div
                className={`mt-1 text-xs leading-relaxed ${verification.valid ? "text-emerald-800" : "text-red-800"}`}
              >
                {verification.valid
                  ? "Every entry matches its own contents and the entry before it. Nothing can be silently altered or removed."
                  : `${verification.reason ?? "The security code no longer matches."} The record cannot be trusted until this is explained.`}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 border border-slate-300 bg-white px-2 py-1">
            <span className="font-mono text-2xs text-slate-500">NEWEST</span>
            <span className="font-mono text-2xs font-semibold text-navy-900">
              {verification.headHash ? truncateHash(verification.headHash, 14, 10) : "GENESIS"}
            </span>
            {verification.headHash && <CopyButton value={verification.headHash} label="" />}
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Entries recorded"
          value={fmtNumber(verification.entries)}
          tone="navy"
          icon={<Database size={15} />}
          detail="Appended since the first entry"
        />
        <MetricCard
          label="You can see"
          value={fmtNumber(logs.length)}
          unit="entries"
          tone="brass"
          icon={<Fingerprint size={15} />}
          detail={
            session.role === "INSTITUTION_ADMIN"
              ? "Only this college's history"
              : "The full national history"
          }
        />
        <MetricCard
          label="Integrity"
          value={verification.valid ? "INTACT" : "BROKEN"}
          tone={verification.valid ? "emerald" : "red"}
          icon={verification.valid ? <CheckCircle2 size={15} /> : <ShieldX size={15} />}
          detail={verification.valid ? "Re-checked on this page load" : `Broken at #${verification.brokenAtSequence}`}
        />
        <MetricCard
          label="Tamper guards"
          value={verification.triggers.length}
          unit="guards"
          tone="slate"
          icon={<Lock size={15} />}
          detail="Database blocks edits and deletes"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="panel">
            <form
              method="get"
              action="/audit"
              className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-2 lg:grid-cols-12"
            >
              <div className="lg:col-span-6">
                <label htmlFor="q" className="field-label">
                  Search
                </label>
                <div className="relative">
                  <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="q"
                    name="q"
                    defaultValue={params.q ?? ""}
                    placeholder="Who, case reference, what happened…"
                    className="input pl-7"
                  />
                </div>
              </div>
              <div className="lg:col-span-3">
                <label htmlFor="action" className="field-label">
                  What happened
                </label>
                <select id="action" name="action" defaultValue={action} className="select">
                  <option value="ALL">Everything</option>
                  {actionValues.map((value) => (
                    <option key={value} value={value}>
                      {AUDIT_ACTION_LABELS[value] ?? value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label htmlFor="role" className="field-label">
                  Who
                </label>
                <select id="role" name="role" defaultValue={roleFilter} className="select">
                  <option value="ALL">Anyone</option>
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {ROLE_META[value].label}
                    </option>
                  ))}
                  <option value="SYSTEM">Automatic check</option>
                </select>
              </div>
              <div className="flex items-end gap-1.5 lg:col-span-1">
                <button type="submit" className="btn btn-primary btn-xs w-full">
                  <Filter size={11} />
                </button>
                {hasFilters && (
                  <Link href="/audit" className="btn btn-ghost btn-xs" aria-label="Clear filters">
                    <X size={11} />
                  </Link>
                )}
              </div>
            </form>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">Newest first</div>
                <h2 className="panel-title mt-0.5">What happened, and when</h2>
              </div>
              <div className="text-right text-2xs text-slate-500">
                <div className="font-mono text-xs font-semibold text-navy-900">{filtered.length} matched</div>
                <div>
                  Page {page} of {totalPages}
                </div>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing matches"
                  description="Clear the search or filters to see the full history."
                  icon={<Fingerprint size={18} />}
                >
                  <Link href="/audit" className="btn btn-outline btn-xs">
                    Clear filters
                  </Link>
                </EmptyState>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[920px]">
                  <thead>
                    <tr>
                      <th className="w-[120px]">When</th>
                      <th className="w-[190px]">What happened</th>
                      <th className="w-[150px]">Who</th>
                      <th className="w-[160px]">Case</th>
                      <th>Detail</th>
                      <th className="w-[130px]">Security code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((log) => {
                      const subject = log.application?.institution ?? log.institution;
                      return (
                        <tr key={log.id}>
                          <td>
                            <div className="font-mono text-2xs font-semibold text-navy-900">
                              #{String(log.sequence).padStart(4, "0")}
                            </div>
                            <div className="mt-0.5 font-mono text-2xs leading-tight text-slate-400">
                              {fmtDateTime(log.timestamp)}
                            </div>
                          </td>
                          <td>
                            <div className="text-xs font-semibold text-navy-950">{auditActionLabel(log.action)}</div>
                            {log.previousState && (
                              <div className="mt-0.5 font-mono text-2xs text-slate-400">
                                {log.previousState} → {log.newState}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="text-xs text-slate-700">{log.performedBy}</div>
                            <div className="mt-0.5 text-2xs uppercase tracking-label text-slate-400">
                              {isRole(log.role) ? ROLE_META[log.role].label : "Automatic check"}
                            </div>
                          </td>
                          <td>
                            {log.application ? (
                              <>
                                <Link
                                  href={`/applications/${log.application.id}?tab=history`}
                                  className="font-mono text-2xs font-semibold text-navy-800 underline decoration-slate-300 underline-offset-2 hover:decoration-navy-700"
                                >
                                  {shortRef(log.application.referenceNo)}
                                </Link>
                                <div className="mt-0.5 max-w-[150px] truncate text-2xs text-slate-600">
                                  {subject?.name ?? "Application"}
                                </div>
                              </>
                            ) : subject ? (
                              <>
                                <div className="text-xs text-slate-700">{subject.name}</div>
                                <div className="mt-0.5 font-mono text-2xs text-slate-400">{subject.code}</div>
                              </>
                            ) : (
                              <span className="text-2xs uppercase tracking-label text-slate-400">
                                Every case
                              </span>
                            )}
                          </td>
                          <td className="text-xs leading-relaxed text-slate-600">{log.detail ?? "—"}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              <span className="hash" title={log.hashChecksum}>
                                {truncateHash(log.hashChecksum, 10, 6)}
                              </span>
                              <CopyButton value={log.hashChecksum} label="" />
                            </div>
                            {log.previousHash && (
                              <div className="mt-0.5 font-mono text-2xs text-slate-400">
                                was {truncateHash(log.previousHash, 6, 4)}
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
              <span className="text-2xs text-slate-500">
                {visible.length} of {filtered.length} shown · {fmtNumber(verification.entries)} in the full record
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href={pageHref(Math.max(1, page - 1))}
                  aria-disabled={page === 1}
                  className={`btn btn-outline btn-xs ${page === 1 ? "pointer-events-none opacity-40" : ""}`}
                >
                  <ArrowLeft size={11} /> Prev
                </Link>
                <span className="px-1 font-mono text-2xs text-slate-500">
                  {page}/{totalPages}
                </span>
                <Link
                  href={pageHref(Math.min(totalPages, page + 1))}
                  aria-disabled={page === totalPages}
                  className={`btn btn-outline btn-xs ${page === totalPages ? "pointer-events-none opacity-40" : ""}`}
                >
                  Next <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className={`panel border-l-2 ${verification.valid ? "border-l-brass-500" : "border-l-red-500"}`}>
            <div className="panel-header">
              <div>
                <div className="eyebrow">Live demo · two clicks</div>
                <h2 className="panel-title mt-0.5">Break the record, then repair it</h2>
              </div>
              <Lock size={16} className="text-slate-400" />
            </div>
            <div className="space-y-3 p-4">
              <p className="text-xs leading-relaxed text-slate-600">
                The first button edits the newest entry straight in the database — exactly what an attacker with
                server access would do, bypassing the application completely. The page reloads and the banner above
                names the entry that changed. The second button puts the original text back.
              </p>
              <div className="flex flex-wrap items-start gap-2">
                {demoActive ? (
                  <ActionButton
                    action={repairLedgerAction}
                    fields={{}}
                    label="Repair the record"
                    pendingLabel="Repairing…"
                    variant="emerald"
                    icon={<RotateCcw size={12} />}
                  />
                ) : (
                  <ActionButton
                    action={simulateTamperAction}
                    fields={{}}
                    label="Alter the newest entry"
                    pendingLabel="Altering…"
                    variant="danger"
                    icon={<Unlock size={12} />}
                    disabled={!verification.valid}
                    disabledReason="The record already shows a break."
                  />
                )}
                {demoActive && verification.valid && (
                  <span className="text-xs text-emerald-800">Restored — the record verifies again.</span>
                )}
              </div>
              {!verification.valid && (
                <div className="border border-red-300 bg-red-50 p-2.5 text-xs leading-relaxed text-red-900">
                  Entry #{verification.brokenAtSequence} no longer matches its security code. The change happened
                  outside the application, yet the record still points straight at it.
                </div>
              )}
              <p className="text-2xs leading-relaxed text-slate-400">
                The demo acts on the same database this prototype runs on. Both steps leave the record exactly as it
                was.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="eyebrow">How the seal works</div>
                <h2 className="panel-title mt-0.5">Why one edit cannot hide</h2>
              </div>
              <ShieldCheck size={16} className="text-slate-400" />
            </div>
            <ul className="space-y-2 p-4 text-xs leading-relaxed text-slate-600">
              <li className="flex gap-2">
                <span className="font-semibold text-navy-900">1.</span> Every entry stores a security code built from
                its own contents and the code of the entry before it.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-navy-900">2.</span> Change one word in an entry and its code no
                longer matches — every entry after it breaks too.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-navy-900">3.</span> Entry numbers must run 1, 2, 3 … with no gaps,
                so a deleted entry is just as visible as an edited one.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-navy-900">4.</span> The database refuses edits and deletes
                outright, so even another program cannot quietly change history.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
