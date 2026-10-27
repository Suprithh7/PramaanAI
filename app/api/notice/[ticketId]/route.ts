import { NextResponse } from "next/server";
import { aphInputFor, evaluateAphRules } from "@/lib/aph";
import { fmtDate, truncateHash } from "@/lib/format";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  APPLICATION_TYPE_LABELS,
  REGION_META,
  type ApplicationType,
  type Region,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const session = await getSession();
  const { ticketId } = await params;

  const ticket = await prisma.deficiencyTicket.findUnique({
    where: { id: ticketId },
    include: {
      application: {
        include: {
          institution: { include: { documents: true } },
          filingDeclaration: true,
          ruleChecks: true,
          auditLogs: {
            where: { action: "DEFICIENCY_ISSUED" },
            orderBy: { sequence: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!ticket) {
    return new NextResponse("Deficiency notice not found.", { status: 404 });
  }
  if (
    session.role === "INSTITUTION_ADMIN" &&
    session.tenant?.id !== ticket.application.institutionId
  ) {
    return new NextResponse("Tenant scope mismatch.", { status: 403 });
  }

  const app = ticket.application;
  const institution = app.institution;
  const live = evaluateAphRules(aphInputFor(app));
  const flagged = live.filter((rule) => rule.status !== "PASSED");
  const persisted = app.ruleChecks.filter((rule) => rule.status !== "PASSED");

  const rules =
    flagged.length > 0
      ? flagged.map((rule) => ({
          code: rule.ruleCode,
          name: rule.ruleName,
          required: rule.requiredValue,
          submitted: rule.submittedValue,
          remarks: rule.remarks,
        }))
      : persisted.map((rule) => ({
          code: rule.ruleCode,
          name: rule.ruleName,
          required: rule.requiredValue,
          submitted: rule.submittedValue,
          remarks: rule.officerRemarks ?? "Deficiency recorded at scrutiny.",
        }));

  const region = REGION_META[institution.region as Region];
  const overdue = ticket.complianceDeadline.getTime() < Date.now();
  const issueHash = app.auditLogs[0]?.hashChecksum ?? null;

  const ruleRows =
    rules.length > 0
      ? rules
          .map(
            (rule) => `<tr>
              <td><strong>${escapeHtml(rule.code)}</strong><br/>${escapeHtml(rule.name)}</td>
              <td>${escapeHtml(rule.required)}</td>
              <td>${escapeHtml(rule.submitted)}</td>
              <td>${escapeHtml(rule.remarks)}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="4">${escapeHtml(ticket.deficiencyDetails)}</td></tr>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(ticket.noticeNo ?? "Deficiency Notice")} · ${escapeHtml(institution.code)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #152435; font-family: Georgia, "Times New Roman", serif; font-size: 11px; line-height: 1.5; }
  .tricolor { display: flex; height: 4px; }
  .tricolor span { flex: 1; }
  .saffron { background: #f97316; } .white { background: #fff; } .green { background: #15803d; }
  header { display: flex; justify-content: space-between; gap: 18px; border-bottom: 2px solid #0e2033; padding-bottom: 10px; margin-top: 16px; }
  .government { font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
  h1 { font-size: 19px; margin: 2px 0 0; letter-spacing: 0.01em; }
  .region { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; margin-top: 2px; }
  .meta { text-align: right; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
  .notice-title { text-align: center; font-size: 17px; text-transform: uppercase; letter-spacing: 0.1em; margin: 22px 0 2px; }
  .rule { width: 96px; height: 1px; background: #b98a2b; margin: 0 auto 20px; }
  .row { display: flex; justify-content: space-between; gap: 20px; }
  .label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; color: #94a3b8; }
  .notice-no { font-family: "Courier New", monospace; font-size: 13px; font-weight: 700; }
  .to { margin-bottom: 14px; }
  .to strong { display: block; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9px; }
  th { background: #f1f5f9; text-align: left; text-transform: uppercase; letter-spacing: 0.08em; font-size: 8px; }
  th, td { border: 1px solid #64748b; padding: 6px; vertical-align: top; }
  .deadline { border: 1px solid #94a3b8; background: #f8fafc; padding: 10px; margin-top: 14px; }
  .deadline strong { font-family: "Courier New", monospace; font-size: 13px; }
  .overdue { color: #b91c1c; font-weight: 700; }
  ol { padding-left: 18px; margin: 6px 0 0; }
  li { margin-bottom: 4px; }
  .signature { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 38px; gap: 30px; }
  .sign-line { width: 190px; border-top: 1px solid #64748b; text-align: center; padding-top: 4px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
  footer { border-top: 1px solid #cbd5e1; margin-top: 28px; padding-top: 8px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; display: flex; justify-content: space-between; gap: 16px; }
  .mono { font-family: "Courier New", monospace; text-transform: none; letter-spacing: 0; }
</style>
</head>
<body>
  <div class="tricolor"><span class="saffron"></span><span class="white"></span><span class="green"></span></div>
  <header>
    <div>
      <div class="government">Government of India · Ministry of Education</div>
      <h1>All India Council for Technical Education</h1>
      <div class="region">${escapeHtml(region?.label ?? institution.region)} Regional Office · ${escapeHtml(region?.hq ?? "")}</div>
    </div>
    <div class="meta">
      <div>Approval Process Handbook 2026–27</div>
      <div>Statutory scrutiny · APH matrix</div>
      <div class="mono">Ref ${escapeHtml(app.referenceNo)}</div>
    </div>
  </header>

  <div class="row" style="margin-top:18px">
    <div>
      <div class="label">Notice number</div>
      <div class="notice-no">${escapeHtml(ticket.noticeNo ?? "Pending numbering")}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Date of issue</div>
      <div class="mono">${escapeHtml(fmtDate(ticket.createdAt))}</div>
    </div>
  </div>

  <div class="notice-title">Formal Deficiency Notice</div>
  <div class="rule"></div>

  <div class="to">
    <div class="label">To</div>
    <strong>The Registrar / Head of Institution</strong>
    <div>${escapeHtml(institution.name)}</div>
    <div>${escapeHtml(institution.city)}, ${escapeHtml(institution.state)}</div>
    <div class="mono">Institution code ${escapeHtml(institution.code)}</div>
  </div>

  <p><strong>Subject:</strong> Scrutiny of application ${escapeHtml(app.referenceNo)} for ${escapeHtml(
    APPLICATION_TYPE_LABELS[app.applicationType as ApplicationType]?.toLowerCase() ?? "approval",
  )} under the ${escapeHtml(app.programName)} programme.</p>

  <p>The above application has been examined against the automated Approval Process Handbook (APH) rule matrix and the
  statutory documents on record. The competent authority is satisfied that the following deficiencies require correction
  before the application can proceed along the ${escapeHtml(app.processingPath.replaceAll("_", " ").toLowerCase())} processing path.</p>

  <table>
    <thead><tr><th>Rule</th><th>Requirement</th><th>Finding</th><th>Correction required</th></tr></thead>
    <tbody>${ruleRows}</tbody>
  </table>

  <div class="deadline">
    <div class="label">Compliance deadline</div>
    <div class="row" style="margin-top:3px">
      <strong>${escapeHtml(fmtDate(ticket.complianceDeadline))}</strong>
      <span class="mono ${overdue ? "overdue" : ""}">${overdue ? "DEADLINE EXCEEDED" : "APH EVIDENCE WINDOW"}</span>
    </div>
    <p style="margin:6px 0 0">All corrective evidence must be uploaded through the PRAMAAN portal on or before this date.
    The application remains in DEFICIENCY_REVERTED status until a valid resubmission is received and accepted on re-scrutiny.</p>
  </div>

  <div style="margin-top:14px">
    <div class="label">Instructions to the institution</div>
    <ol>
      <li>File a point-wise reply with indexed evidence against each deficiency listed above.</li>
      <li>Where architectural or statutory metrics have been revised, submit the sanctioned plan, revised area statement and
      structural certificate as applicable.</li>
      <li>Resubmission returns the case to RE_SCRUTINY. The APH matrix is re-evaluated in full; any rule still failing will
      require a fresh notice.</li>
      <li>Failure to respond within the evidence window may result in rejection and referral to the Bureau escalation register.</li>
    </ol>
  </div>

  <p>This notice is issued under the Approval Process Handbook 2026–27 and is recorded in the append-only PRAMAAN audit ledger.
  The institution's statutory clock remains subject to national SLA monitoring.</p>

  <div class="signature">
    <div>
      <div class="label">Issued by</div>
      <div><strong>${escapeHtml(ticket.raisedBy)}</strong></div>
      <div>${escapeHtml(region?.label ?? institution.region)} Regional Office</div>
      <div class="mono">LEDGER ${escapeHtml(issueHash ? truncateHash(issueHash, 14, 10) : "PENDING")}</div>
    </div>
    <div class="sign-line">Authorised Signatory · AICTE</div>
  </div>

  <footer>
    <span>System-generated from PRAMAAN · verification via immutable audit ledger</span>
    <span class="mono">TICKET ${escapeHtml(ticket.id.slice(-10).toUpperCase())} · ${escapeHtml(fmtDate(new Date()))}</span>
  </footer>
</body>
</html>`;

  const filename = `${(ticket.noticeNo ?? `deficiency-${ticket.id}`).replace(/[^a-zA-Z0-9._-]+/g, "-")}.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
