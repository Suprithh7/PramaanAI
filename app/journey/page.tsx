import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, GitCommitHorizontal, Route, ShieldCheck } from "lucide-react";
import { getLedgerIntegritySummary } from "@/lib/audit";
import { getCase } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { CaseJourney } from "@/components/journey/CaseJourney";

export const dynamic = "force-dynamic";

/**
 * Picks the case that can carry the fullest demonstration — the one with the
 * deepest recorded history, preferring files that reached a terminal outcome
 * through a completed geofenced inspection. Selected by data, never hardcoded.
 */
async function flagshipCaseId() {
  const apps = await prisma.application.findMany({
    select: {
      id: true,
      status: true,
      auditLogs: { select: { sequence: true } },
      deficiencies: { select: { status: true } },
      inspections: { select: { siteReportStatus: true } },
    },
  });

  const score = (app: (typeof apps)[number]) =>
    app.auditLogs.length +
    app.deficiencies.filter((ticket) => ticket.status === "RESOLVED").length * 4 +
    app.inspections.filter((visit) => visit.siteReportStatus === "COMPLETED").length * 4 +
    (app.status === "APPROVED" ? 6 : 0);

  const ranked = [...apps].sort((a, b) => score(b) - score(a));
  return ranked[0]?.id ?? null;
}

export default async function CaseJourneyPage() {
  const id = await flagshipCaseId();
  if (!id) notFound();

  const [app, ledger] = await Promise.all([getCase(id), getLedgerIntegritySummary()]);
  if (!app) notFound();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Demonstration" }, { label: "Case journey" }]}
        eyebrow="Demonstration · one file, start to finish"
        title="How a filing is actually cleared"
        description={`Follow ${app.referenceNo} — ${app.institution.name}, ${app.institution.city} — through scrutiny, a formal deficiency, a geofenced site visit and a council order. Every panel below is the stored record, not a mock-up.`}
        meta={
          <>
            <span className="badge border-brass-300 bg-brass-50 text-brass-900">
              <Route size={9} /> End-to-end walkthrough
            </span>
            <span className="text-[10px] text-slate-600">{app.institution.code}</span>
            <span
              className={`flex items-center gap-1 text-[10px] ${
                ledger.valid ? "text-emerald-800" : "text-red-800"
              }`}
            >
              <ShieldCheck size={10} /> Ledger {ledger.valid ? "verified" : "fault"} ·{" "}
              {ledger.entries} entries
            </span>
          </>
        }
        actions={
          <>
            <Link href={`/applications/${app.id}`} className="btn btn-primary">
              Live case file <ArrowUpRight size={11} />
            </Link>
            <Link href="/audit" className="btn btn-outline">
              <GitCommitHorizontal size={11} /> Audit ledger
            </Link>
          </>
        }
      />

      <CaseJourney
        app={app}
        ledger={{ valid: ledger.valid, entries: ledger.entries, headHash: ledger.headHash }}
      />
    </>
  );
}