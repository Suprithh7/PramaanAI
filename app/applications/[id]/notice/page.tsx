import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { Emblem } from "@/components/Emblem";
import { PrintButton } from "@/components/case/PrintButton";
import { evaluateAphRules } from "@/lib/aph";
import { fmtDate, truncateHash } from "@/lib/format";
import { getCase } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { REGION_META, type ApplicationType, type Region } from "@/lib/types";
import { APPLICATION_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

type NoticeRule = {
  code: string;
  name: string;
  required: string;
  submitted: string;
  remarks: string;
};

export default async function DeficiencyNoticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ticket?: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const { ticket: ticketId } = await searchParams;
  const app = await getCase(id);

  if (!app) notFound();
  if (session.role === "INSTITUTION_ADMIN" && session.tenant?.id !== app.institutionId) notFound();

  const ticket =
    (ticketId ? app.deficiencies.find((item) => item.id === ticketId) : null) ??
    app.deficiencies.find((item) => item.status === "OPEN") ??
    app.deficiencies[0];

  if (!ticket) notFound();

  const liveRules = evaluateAphRules({
    applicationType: app.applicationType,
    institution: app.institution,
    documents: app.institution.documents,
  });
  const liveFlagged = liveRules.filter((rule) => rule.status !== "PASSED");
  const persistedFlagged = app.ruleChecks.filter((rule) => rule.status !== "PASSED");

  const rules: NoticeRule[] =
    liveFlagged.length > 0
      ? liveFlagged.map((rule) => ({
          code: rule.ruleCode,
          name: rule.ruleName,
          required: rule.requiredValue,
          submitted: rule.submittedValue,
          remarks: rule.remarks,
        }))
      : persistedFlagged.map((rule) => ({
          code: rule.ruleCode,
          name: rule.ruleName,
          required: rule.requiredValue,
          submitted: rule.submittedValue,
          remarks: rule.officerRemarks ?? "Deficiency recorded at scrutiny.",
        }));

  const regionMeta = REGION_META[app.institution.region as Region];
  const issueEvent = app.auditLogs.find((log) => log.action === "DEFICIENCY_ISSUED");
  const overdue = ticket.complianceDeadline.getTime() < Date.now();

  return (
    <div className="print-reset mx-auto max-w-[860px]">
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/applications/${app.id}?tab=deficiency`} className="btn btn-outline btn-xs">
          <ArrowLeft size={10} /> Back to case
        </Link>
        <div className="flex items-center gap-2">
          <a href={`/api/notice/${ticket.id}`} className="btn btn-outline btn-xs">
            <Download size={10} /> Download HTML
          </a>
          <PrintButton />
        </div>
      </div>

      <article className="print-sheet border border-slate-300 bg-white px-8 py-8 shadow-panel sm:px-12 sm:py-10">
        <div className="flex h-1 w-full">
          <span className="flex-1 bg-[#f97316]" />
          <span className="flex-1 bg-white" />
          <span className="flex-1 bg-[#15803d]" />
        </div>

        <header className="mt-5 flex items-start justify-between gap-4 border-b-2 border-navy-900 pb-4">
          <div className="flex items-start gap-3">
            <Emblem />
            <div>
              <div className="text-[8px] font-semibold uppercase tracking-wider2 text-slate-500">
                Government of India · Ministry of Education
              </div>
              <div className="mt-0.5 font-serif text-[17px] font-semibold leading-tight text-navy-950">
                All India Council for Technical Education
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-label text-slate-600">
                {regionMeta?.label ?? app.institution.region} Regional Office · {regionMeta?.hq ?? ""}
              </div>
            </div>
          </div>
          <div className="text-right text-[8px] uppercase tracking-label text-slate-500">
            <div>Approval Process Handbook 2026–27</div>
            <div className="mt-0.5">Statutory scrutiny · APH matrix</div>
            <div className="mt-0.5 font-mono normal-case tracking-normal text-slate-600">
              Ref {app.referenceNo}
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3 text-[10px]">
          <div>
            <div className="text-[8px] uppercase tracking-label text-slate-400">Notice number</div>
            <div className="mt-0.5 font-mono text-[12px] font-semibold text-navy-950">
              {ticket.noticeNo ?? "Pending numbering"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-label text-slate-400">Date of issue</div>
            <div className="mt-0.5 font-mono text-[11px] text-navy-950">{fmtDate(ticket.createdAt)}</div>
          </div>
        </div>

        <h1 className="mt-5 text-center font-serif text-[19px] font-semibold uppercase tracking-[0.08em] text-navy-950">
          Formal Deficiency Notice
        </h1>
        <div className="mx-auto mt-1 h-px w-24 bg-brass-500" />

        <section className="mt-5 text-[11px] leading-relaxed text-slate-800">
          <div className="mb-3">
            <div className="text-[8px] font-semibold uppercase tracking-label text-slate-400">To</div>
            <div className="mt-1 font-semibold text-navy-950">The Registrar / Head of Institution</div>
            <div>{app.institution.name}</div>
            <div>
              {app.institution.city}, {app.institution.state}
            </div>
            <div className="font-mono text-[9px] text-slate-500">Institution code {app.institution.code}</div>
          </div>

          <p>
            <span className="font-semibold">Subject:</span> Scrutiny of application {app.referenceNo} for{" "}
            {APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType]?.toLowerCase() ?? "approval"} under the{" "}
            {app.programName} programme.
          </p>

          <p className="mt-3">
            The above application has been examined against the automated Approval Process Handbook (APH) rule matrix and the
            statutory documents on record. The competent authority is satisfied that the following deficiencies require
            correction before the application can proceed along the{" "}
            {app.processingPath.replaceAll("_", " ").toLowerCase()} processing path.
          </p>

          {rules.length > 0 ? (
            <table className="mt-4 w-full border-collapse border border-slate-400 text-[9px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1.5 text-left uppercase tracking-label">Rule</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-left uppercase tracking-label">Requirement</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-left uppercase tracking-label">Finding</th>
                  <th className="border border-slate-400 px-2 py-1.5 text-left uppercase tracking-label">Correction required</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.code}>
                    <td className="border border-slate-400 px-2 py-1.5 align-top">
                      <div className="font-mono font-semibold">{rule.code}</div>
                      <div>{rule.name}</div>
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 align-top">{rule.required}</td>
                    <td className="border border-slate-400 px-2 py-1.5 align-top">{rule.submitted}</td>
                    <td className="border border-slate-400 px-2 py-1.5 align-top">{rule.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 border border-slate-300 bg-slate-50 p-3">
              {ticket.deficiencyDetails}
            </p>
          )}

          <div className="mt-4 border border-navy-300 bg-navy-50/60 p-3">
            <div className="text-[8px] font-semibold uppercase tracking-label text-navy-700">
              Compliance deadline
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[12px] font-semibold text-navy-950">
                {fmtDate(ticket.complianceDeadline)}
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-label ${overdue ? "text-red-700" : "text-navy-700"}`}>
                {overdue ? "Deadline exceeded" : "Within APH evidence window"}
              </span>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-600">
              All corrective evidence must be uploaded through the PRAMAAN portal on or before this date. The application will
              remain in DEFICIENCY_REVERTED status until a valid resubmission is received and accepted on re-scrutiny.
            </p>
          </div>

          <div className="mt-4">
            <div className="text-[8px] font-semibold uppercase tracking-label text-slate-400">
              Instructions to the institution
            </div>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[10px]">
              <li>File a point-wise reply with indexed evidence against each deficiency listed above.</li>
              <li>
                Where architectural or statutory metrics have been revised, submit the sanctioned plan, revised area
                statement and structural certificate as applicable.
              </li>
              <li>
                Resubmission returns the case to RE_SCRUTINY. The APH matrix is re-evaluated in full; any rule still failing
                will require a fresh notice.
              </li>
              <li>
                Failure to respond within the evidence window may result in rejection and referral to the Bureau escalation
                register.
              </li>
            </ol>
          </div>

          <p className="mt-4 text-[10px]">
            This notice is issued under the Approval Process Handbook 2026–27 and is recorded in the append-only PRAMAAN audit
            ledger. The institution's statutory clock remains subject to national SLA monitoring.
          </p>

          <div className="mt-8 flex items-end justify-between gap-6">
            <div className="text-[9px] leading-relaxed text-slate-500">
              <div>Issued by</div>
              <div className="font-semibold text-navy-950">{ticket.raisedBy}</div>
              <div>{regionMeta?.label ?? app.institution.region} Regional Office</div>
              <div className="mt-2 font-mono text-[8px] uppercase tracking-label text-slate-400">
                LEDGER {issueEvent ? truncateHash(issueEvent.hashChecksum, 14, 10) : "PENDING"}
              </div>
            </div>
            <div className="text-center">
              <div className="h-10 w-48 border-b border-slate-400" />
              <div className="mt-1 text-[8px] uppercase tracking-label text-slate-500">
                Authorised Signatory · AICTE
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-3 text-[8px] uppercase tracking-label text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <ShieldCheck size={9} /> System-generated from PRAMAAN · verification via audit ledger
            </span>
            <span className="font-mono normal-case tracking-normal">
              TICKET {ticket.id.slice(-10).toUpperCase()} · {fmtDate(new Date())}
            </span>
          </div>
        </footer>
      </article>
    </div>
  );
}
