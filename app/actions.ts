"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generateFilingBrief, buildBriefContext } from "@/lib/ai";
import {
  aphInputFor,
  aphSummary,
  declarationToAphInput,
  evaluateAphRules,
  type AphDeclaration,
  type AphRuleResult,
} from "@/lib/aph";
import { recordAudit, verifyAuditLedger } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { MAX_EVIDENCE_BYTES, isPdf, processEvidencePdf, readEvidenceFile, rehashStored, saveEvidenceFile } from "@/lib/evidence";
import {
  analyzeDocumentWithGemini,
  generateAicteDeficiencyNotice,
  generateAicteRemediationRoadmap,
  evaluateEvcInspectionWithGemini,
} from "@/lib/gemini";
import { extractText, getDocumentProxy } from "unpdf";
import { EVIDENCE_TYPE_LABELS, isEvidenceType, type ExtractedField } from "@/lib/evidence-types";
import { checkConflict, findEvcMember, geofenceResult, GEOFENCE_RADIUS_M } from "@/lib/evc";
import { canDecide, canRaiseDeficiency, canRunAph, statusAfterSiteReport } from "@/lib/fsm";
import { fmtDate, istYear } from "@/lib/format";
import { getSession, ROLE_COOKIE, TENANT_COOKIE } from "@/lib/session";
import { SLA_POLICY, liveDaysInStage, slaForDays } from "@/lib/sla";
import {
  APPLICATION_TYPE_LABELS,
  APPLICATION_TYPES,
  PROCESSING_PATH_META,
  REGION_META,
  ROLE_META,
  can,
  isRole,
  type ActionResult,
  type ApplicationType,
  type Capability,
  type ProcessingPath,
  type Region,
} from "@/lib/types";

const fail = (message: string): ActionResult => ({ ok: false, message });
const ok = (message: string): ActionResult => ({ ok: true, message });

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function refresh() {
  revalidatePath("/", "layout");
}

function tenantError(
  session: Awaited<ReturnType<typeof getSession>>,
  institutionId: string,
): string | null {
  if (session.role !== "INSTITUTION_ADMIN") return null;
  if (!session.tenant || session.tenant.id !== institutionId) {
    return "Tenant scope mismatch. Switch the institution context before acting on this filing.";
  }
  return null;
}

function requireCapability(
  session: Awaited<ReturnType<typeof getSession>>,
  capability: Capability,
): ActionResult | null {
  if (!can(session.role, capability)) {
    const allowed = ROLE_META[session.role].label;
    return fail(
      `Action not permitted for ${allowed}. Required identity: an authorised role for ${capability.replaceAll("_", " ").toLowerCase()}.`,
    );
  }
  return null;
}

function dateFromInput(value: string, endOfDay: boolean): Date | null {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59+05:30" : "T10:30:00+05:30";
  const parsed = new Date(`${value}${suffix}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function persistRules(
  tx: Prisma.TransactionClient,
  applicationId: string,
  results: AphRuleResult[],
) {
  for (const rule of results) {
    await tx.scrutinyRuleCheck.upsert({
      where: {
        applicationId_ruleCode: { applicationId, ruleCode: rule.ruleCode },
      },
      create: {
        applicationId,
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        requiredValue: rule.requiredValue,
        submittedValue: rule.submittedValue,
        status: rule.status,
        officerRemarks: rule.remarks,
        evaluatedAt: new Date(),
      },
      update: {
        ruleName: rule.ruleName,
        requiredValue: rule.requiredValue,
        submittedValue: rule.submittedValue,
        status: rule.status,
        officerRemarks: rule.remarks,
        evaluatedAt: new Date(),
      },
    });
  }
}

export async function switchRoleAction(role: string) {
  if (!isRole(role)) return;
  const current = await getSession();
  if (current.role !== role) {
    await recordAudit({
      performedBy: current.user.name,
      role: current.role,
      action: "IDENTITY_CONTEXT_SWITCHED",
      previousState: current.role,
      newState: role,
      detail: `Demo impersonation switched from ${ROLE_META[current.role].label} to ${ROLE_META[role].label}.`,
    });
  }
  const jar = await cookies();
  jar.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  refresh();
  redirect(ROLE_META[role].landing);
}

export async function switchTenantAction(tenantId: string) {
  const session = await getSession();
  if (session.role !== "INSTITUTION_ADMIN") return;
  const institution = await prisma.institution.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!institution) return;
  const jar = await cookies();
  jar.set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  refresh();
}

const PATH_BY_APPLICATION_TYPE: Record<ApplicationType, ProcessingPath> = {
  NEW_INSTITUTE: "SCRUTINY_EVC",
  INTAKE_EXPANSION: "SCRUTINY_EVC",
  EOA_EXTENSION: "SCRUTINY_ONLY",
};

function isApplicationType(value: string): value is ApplicationType {
  return (APPLICATION_TYPES as readonly string[]).includes(value);
}

async function allocateReferenceNo(region: string): Promise<string> {
  const code = REGION_META[region as Region]?.code ?? "NR";
  const prefix = `AICTE/APH/${istYear()}/${code}/`;
  const existing = await prisma.application.findMany({
    where: { referenceNo: { startsWith: prefix } },
    select: { referenceNo: true },
  });
  const highest = existing.reduce((max, row) => {
    const sequence = Number.parseInt(row.referenceNo.slice(prefix.length), 10);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

export async function fileApplicationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "FILE_APPLICATION");
  if (denied) return denied;
  if (!session.tenant) {
    return fail("Select an institution context before filing an application.");
  }

  const programName = field(formData, "programName");
  const applicationType = field(formData, "applicationType");
  const coveringNote = field(formData, "remarks");
  const intakeInput = field(formData, "studentIntake");
  const facultyInput = field(formData, "facultyCount");
  const builtUpInput = field(formData, "builtUpAreaSqM");
  const landInput = field(formData, "totalLandAcres");

  if (programName.length < 3 || programName.length > 120) {
    return fail("Enter a programme name between 3 and 120 characters.");
  }
  if (!isApplicationType(applicationType)) {
    return fail("Choose a valid application type.");
  }
  if (coveringNote.length > 500) {
    return fail("The covering note must be at most 500 characters.");
  }

  const studentIntake = Number(intakeInput);
  if (!Number.isInteger(studentIntake) || studentIntake < 1 || studentIntake > 100_000) {
    return fail("Declared student strength must be a whole number between 1 and 100,000.");
  }
  const facultyCount = Number(facultyInput);
  if (!Number.isInteger(facultyCount) || facultyCount < 1 || facultyCount > 20_000) {
    return fail("Declared full-time faculty must be a whole number between 1 and 20,000.");
  }
  const builtUpAreaSqM = Number(builtUpInput);
  if (!Number.isInteger(builtUpAreaSqM) || builtUpAreaSqM < 1_000 || builtUpAreaSqM > 2_000_000) {
    return fail("Declared built-up area must be between 1,000 and 2,000,000 sqm.");
  }
  const totalLandAcres = Number(landInput);
  if (!Number.isFinite(totalLandAcres) || totalLandAcres < 0.1 || totalLandAcres > 10_000) {
    return fail("Declared campus land must be between 0.1 and 10,000 acres.");
  }

  const dateInputs: Array<[key: keyof AphDeclaration, label: string]> = [
    ["leaseExpiry", "Lease expiry"],
    ["fireExpiry", "Fire safety certificate expiry"],
    ["buildingExpiry", "Building plan validity"],
    ["undertakingSignedOn", "Undertaking signed date"],
  ];
  const dates: Partial<Record<keyof AphDeclaration, Date>> = {};
  for (const [key, label] of dateInputs) {
    const parsed = dateFromInput(field(formData, key), true);
    if (!parsed) return fail(`${label} must be a valid date.`);
    const year = parsed.getFullYear();
    if (year < 2000 || year > 2100) return fail(`${label} must fall between 2000 and 2100.`);
    dates[key] = parsed;
  }
  if (dates.undertakingSignedOn!.getTime() > Date.now() + 86_400_000) {
    return fail("The statutory undertaking cannot be dated in the future.");
  }

  const institution = await prisma.institution.findUnique({
    where: { id: session.tenant.id },
    select: { id: true, region: true, name: true },
  });
  if (!institution) return fail("Institution record not found.");

  const declaration: AphDeclaration = {
    studentIntake,
    facultyCount,
    builtUpAreaSqM,
    totalLandAcres,
    leaseExpiry: dates.leaseExpiry!,
    fireExpiry: dates.fireExpiry!,
    buildingExpiry: dates.buildingExpiry!,
    undertakingSignedOn: dates.undertakingSignedOn!,
  };
  const aphInput = declarationToAphInput(applicationType, declaration, institution.name);
  const results = evaluateAphRules(aphInput);
  const summary = aphSummary(results);
  const flaggedCodes = results
    .filter((rule) => rule.status !== "PASSED")
    .map((rule) => rule.ruleCode);

  const referenceNo = await allocateReferenceNo(institution.region);
  const processingPath = PATH_BY_APPLICATION_TYPE[applicationType];

  const application = await prisma.$transaction(async (tx) => {
    const created = await tx.application.create({
      data: {
        referenceNo,
        institutionId: institution.id,
        applicationType,
        programName,
        intakeRequested: studentIntake,
        status: "SUBMITTED",
        processingPath,
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        remarks:
          coveringNote ||
          `Filed through the institution portal for ${APPLICATION_TYPE_LABELS[applicationType]}. Awaiting scrutiny commencement.`,
        filingDeclaration: {
          create: {
            studentIntake,
            facultyCount,
            builtUpAreaSqM,
            totalLandAcres,
            leaseExpiry: declaration.leaseExpiry as Date,
            fireExpiry: declaration.fireExpiry as Date,
            buildingExpiry: declaration.buildingExpiry as Date,
            undertakingSignedOn: declaration.undertakingSignedOn as Date,
          },
        },
      },
    });
    await persistRules(tx, created.id, results);
    await recordAudit(
      {
        applicationId: created.id,
        institutionId: institution.id,
        performedBy: session.user.name,
        role: session.role,
        action: "APPLICATION_FILED",
        previousState: null,
        newState: "SUBMITTED",
        detail: `${APPLICATION_TYPE_LABELS[applicationType]} · ${programName} · ${studentIntake.toLocaleString("en-IN")} students, ${facultyCount.toLocaleString("en-IN")} faculty, ${builtUpAreaSqM.toLocaleString("en-IN")} sqm declared · ${PROCESSING_PATH_META[processingPath].label} route · ${summary.total} APH rules evaluated at filing: ${summary.passed} passed, ${summary.flagged} flagged${flaggedCodes.length > 0 ? ` (${flaggedCodes.join(", ")})` : ""}.`,
      },
      tx,
    );
    return created;
  });

  const brief = await generateFilingBrief(
    buildBriefContext({ ...application, institution }, aphInput, results),
  );
  await prisma.$transaction(async (tx) => {
    await tx.filingBrief.create({
      data: {
        applicationId: application.id,
        engine: brief.engine,
        model: brief.model,
        payload: JSON.stringify(brief.payload),
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: institution.id,
        performedBy: session.user.name,
        role: session.role,
        action: "FILING_BRIEF_GENERATED",
        previousState: "SUBMITTED",
        newState: "SUBMITTED",
        detail: `${brief.engine === "LLM" ? `${brief.model} model` : "Grounded rule engine"} produced the ${brief.payload.riskLevel.toLowerCase()} filing brief at ${brief.payload.readinessScore}% readiness (${brief.payload.findings.length} finding(s)).`,
      },
      tx,
    );
  });

  refresh();
  redirect(`/applications/${application.id}?tab=aph`);
}

export async function regenerateFilingBriefAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const permitted = can(session.role, "RUN_APH") || can(session.role, "FILE_APPLICATION");
  if (!permitted) {
    return fail(
      `Action not permitted for ${ROLE_META[session.role].label}. Required identity: an authorised scrutiny or filing role.`,
    );
  }

  const applicationId = field(formData, "applicationId");
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      institution: { include: { documents: true } },
      filingDeclaration: true,
    },
  });
  if (!application) return fail("Application not found.");
  const scope = tenantError(session, application.institutionId);
  if (scope) return fail(scope);

  const aphInput = aphInputFor(application);
  const results = evaluateAphRules(aphInput);
  const brief = await generateFilingBrief(buildBriefContext(application, aphInput, results));

  await prisma.$transaction(async (tx) => {
    await tx.filingBrief.upsert({
      where: { applicationId: application.id },
      create: {
        applicationId: application.id,
        engine: brief.engine,
        model: brief.model,
        payload: JSON.stringify(brief.payload),
      },
      update: {
        engine: brief.engine,
        model: brief.model,
        payload: JSON.stringify(brief.payload),
        generatedAt: new Date(),
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "FILING_BRIEF_GENERATED",
        previousState: application.status,
        newState: application.status,
        detail: `Brief regenerated from the live APH matrix by ${brief.engine === "LLM" ? `${brief.model} model` : "the grounded rule engine"}: ${brief.payload.riskLevel.toLowerCase()} risk, ${brief.payload.readinessScore}% readiness, ${brief.payload.findings.length} finding(s).`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    `Brief regenerated from the live APH matrix: ${brief.payload.riskLevel.toLowerCase()} risk at ${brief.payload.readinessScore}% readiness.`,
  );
}

export async function commenceScrutinyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RUN_APH");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) return fail("Application not found.");
  if (application.status !== "SUBMITTED") {
    return fail("Scrutiny can only commence on a freshly submitted application.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "UNDER_SCRUTINY",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        assignedOfficerId: session.user.id,
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "SCRUTINY_COMMENCED",
        previousState: application.status,
        newState: "UNDER_SCRUTINY",
        detail: "Desk scrutiny commenced. Statutory SLA clock started.",
      },
      tx,
    );
  });

  refresh();
  return ok("Scrutiny commenced. The 10-day statutory clock is now running.");
}

export async function runAphAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RUN_APH");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      institution: { include: { documents: true } },
      filingDeclaration: true,
    },
  });
  if (!application) return fail("Application not found.");
  if (!canRunAph(application.status)) return fail("This application is closed.");

  const results = evaluateAphRules(aphInputFor(application));
  const summary = aphSummary(results);
  const failed = results.filter((rule) => rule.status !== "PASSED");

  await prisma.$transaction(async (tx) => {
    await persistRules(tx, application.id, results);
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "APH_EVALUATION_RUN",
        previousState: application.status,
        newState: application.status,
        detail: `${summary.total} APH rules evaluated: ${summary.passed} passed, ${summary.flagged} flagged${
          failed.length > 0 ? ` (${failed.map((rule) => rule.ruleCode).join(", ")})` : ""
        }.`,
      },
      tx,
    );
  });

  refresh();
  return summary.flagged === 0
    ? ok(`All ${summary.total} APH rules passed. The case is ready for scrutiny clearance.`)
    : fail(
        `${summary.flagged} APH rule${summary.flagged === 1 ? "" : "s"} flagged: ${failed
          .map((rule) => rule.ruleCode)
          .join(", ")}. Raise a formal deficiency or seek corrected evidence.`,
      );
}

export async function clearScrutinyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RUN_APH");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      institution: { include: { documents: true } },
      filingDeclaration: true,
    },
  });
  if (!application) return fail("Application not found.");
  if (application.status !== "UNDER_SCRUTINY") {
    return fail("Only cases under active scrutiny can be cleared.");
  }

  const results = evaluateAphRules(aphInputFor(application));
  const summary = aphSummary(results);
  if (summary.flagged > 0) {
    return fail(
      `Clearance blocked: ${summary.flagged} APH rule${summary.flagged === 1 ? "" : "s"} remain non-compliant. Issue a formal deficiency first.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await persistRules(tx, application.id, results);
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "SCRUTINY_CLEARED",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "SCRUTINY_CLEARED",
        previousState: application.status,
        newState: "SCRUTINY_CLEARED",
        detail: `All ${summary.total} APH rules passed on re-evaluation. Case cleared for the next stage.`,
      },
      tx,
    );
  });

  refresh();
  return ok("Scrutiny cleared. The case is ready for its next workflow stage.");
}

export async function raiseDeficiencyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RAISE_DEFICIENCY");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const details = field(formData, "details");
  const deadlineInput = field(formData, "deadline");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      institution: { include: { documents: true } },
      filingDeclaration: true,
      deficiencies: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!application) return fail("Application not found.");
  if (!canRaiseDeficiency(application.status)) {
    return fail("A formal deficiency can only be raised during scrutiny or re-scrutiny.");
  }
  if (application.deficiencies.some((ticket) => ticket.status === "OPEN")) {
    return fail("An open deficiency notice already exists for this application.");
  }

  const deadline = dateFromInput(deadlineInput, true);
  if (!deadline || deadline.getTime() <= Date.now()) {
    return fail("The compliance deadline must be a future date.");
  }
  if (details.length < 30) {
    return fail("The deficiency statement must be at least 30 characters for a formal notice.");
  }

  const live = evaluateAphRules(aphInputFor(application));
  const failedCodes = live
    .filter((rule) => rule.status !== "PASSED")
    .map((rule) => rule.ruleCode);

  const count = application.deficiencies.length;
  const letter = String.fromCharCode(65 + count);
  const noticeNo = `APH/DFC/${application.referenceNo.split("/").slice(2).join("/")}-${letter}`;

  await prisma.$transaction(async (tx) => {
    await tx.deficiencyTicket.create({
      data: {
        noticeNo,
        applicationId: application.id,
        raisedBy: `${session.user.name} — ${session.user.designation ?? ROLE_META[session.role].label}`,
        deficiencyDetails: details,
        complianceDeadline: deadline,
        status: "OPEN",
      },
    });
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "DEFICIENCY_REVERTED",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        remarks: `Formal deficiency ${noticeNo} issued. Evidence due ${fmtDate(deadline)}.`,
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "DEFICIENCY_ISSUED",
        previousState: application.status,
        newState: "DEFICIENCY_REVERTED",
        detail: `${noticeNo} issued. ${failedCodes.length > 0 ? `Flagged rules: ${failedCodes.join(", ")}. ` : ""}Evidence due ${fmtDate(deadline)}.`,
      },
      tx,
    );
  });

  refresh();
  return ok(`Formal deficiency ${noticeNo} issued. The institution has until ${fmtDate(deadline)} to respond.`);
}

export async function resubmitDeficiencyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RESUBMIT_DEFICIENCY");
  if (denied) return denied;

  const ticketId = field(formData, "ticketId");
  const evidenceUrl = field(formData, "evidenceUrl");
  const note = field(formData, "note");
  const builtUpRaw = field(formData, "revisedBuiltUpAreaSqM");
  const facultyRaw = field(formData, "revisedFacultyCount");

  if (!evidenceUrl) return fail("Provide an evidence reference or document URL.");
  if (evidenceUrl.length > 500) return fail("Evidence reference is too long.");

  const ticket = await prisma.deficiencyTicket.findUnique({
    where: { id: ticketId },
    include: {
      application: {
        include: { institution: true, filingDeclaration: true },
      },
    },
  });
  if (!ticket) return fail("Deficiency ticket not found.");
  const scope = tenantError(session, ticket.application.institutionId);
  if (scope) return fail(scope);
  if (ticket.status !== "OPEN") return fail("Only an open notice can receive a resubmission.");
  if (ticket.application.status !== "DEFICIENCY_REVERTED") {
    return fail("The application is not in a deficiency-reverted state.");
  }

  let revisedBuiltUp: number | null = null;
  let revisedFaculty: number | null = null;
  if (builtUpRaw) {
    revisedBuiltUp = Number(builtUpRaw);
    if (!Number.isFinite(revisedBuiltUp) || revisedBuiltUp < 1000 || revisedBuiltUp > 2_000_000) {
      return fail("Revised built-up area must be a realistic value between 1,000 and 2,000,000 sqm.");
    }
  }
  if (facultyRaw) {
    revisedFaculty = Number(facultyRaw);
    if (!Number.isInteger(revisedFaculty) || revisedFaculty < 1 || revisedFaculty > 20_000) {
      return fail("Revised faculty count must be a whole number between 1 and 20,000.");
    }
  }

  const declaration = ticket.application.filingDeclaration;
  const currentBuiltUp = declaration?.builtUpAreaSqM ?? ticket.application.institution.builtUpAreaSqM;
  const currentFaculty = declaration?.facultyCount ?? ticket.application.institution.facultyCount;
  const institutionUpdates: Prisma.InstitutionUpdateInput = {};
  const declarationUpdates: Prisma.FilingDeclarationUpdateInput = {};
  const changes: string[] = [];
  if (revisedBuiltUp && revisedBuiltUp !== currentBuiltUp) {
    const nextBuiltUp = Math.round(revisedBuiltUp);
    if (declaration) declarationUpdates.builtUpAreaSqM = nextBuiltUp;
    else institutionUpdates.builtUpAreaSqM = nextBuiltUp;
    changes.push(
      `built-up area ${currentBuiltUp.toLocaleString("en-IN")} → ${nextBuiltUp.toLocaleString("en-IN")} sqm`,
    );
  }
  if (revisedFaculty && revisedFaculty !== currentFaculty) {
    if (declaration) declarationUpdates.facultyCount = revisedFaculty;
    else institutionUpdates.facultyCount = revisedFaculty;
    changes.push(`faculty ${currentFaculty} → ${revisedFaculty}`);
  }
  const profileLabel = declaration ? "Filed declaration" : "Statutory profile";

  await prisma.$transaction(async (tx) => {
    if (Object.keys(institutionUpdates).length > 0) {
      await tx.institution.update({
        where: { id: ticket.application.institutionId },
        data: institutionUpdates,
      });
    }
    if (Object.keys(declarationUpdates).length > 0) {
      await tx.filingDeclaration.update({
        where: { applicationId: ticket.applicationId },
        data: declarationUpdates,
      });
    }
    await tx.deficiencyTicket.update({
      where: { id: ticket.id },
      data: {
        status: "RESUBMITTED",
        resubmittedDocUrl: evidenceUrl,
        resubmittedAt: new Date(),
      },
    });
    await tx.application.update({
      where: { id: ticket.applicationId },
      data: {
        status: "RE_SCRUTINY",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        remarks: `Evidence resubmitted against ${ticket.noticeNo ?? "deficiency notice"}. Awaiting re-scrutiny.`,
      },
    });
    await recordAudit(
      {
        applicationId: ticket.applicationId,
        institutionId: ticket.application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "DEFICIENCY_RESUBMITTED",
        previousState: "DEFICIENCY_REVERTED",
        newState: "RE_SCRUTINY",
        detail: `Evidence filed against ${ticket.noticeNo ?? "notice"}: ${evidenceUrl}.${changes.length > 0 ? ` ${profileLabel} corrected: ${changes.join("; ")}.` : ""}${note ? ` Note: ${note}` : ""}`,
      },
      tx,
    );
  });

  refresh();
  return ok("Evidence submitted. The application has returned to re-scrutiny.");
}

export async function acceptResubmissionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "ACCEPT_RESUBMISSION");
  if (denied) return denied;

  const ticketId = field(formData, "ticketId");
  const ticket = await prisma.deficiencyTicket.findUnique({
    where: { id: ticketId },
    include: {
      application: {
        include: {
          institution: { include: { documents: true } },
          filingDeclaration: true,
        },
      },
    },
  });
  if (!ticket) return fail("Deficiency ticket not found.");
  if (ticket.status !== "RESUBMITTED") {
    return fail("This notice has no pending resubmission to accept.");
  }
  if (ticket.application.status !== "RE_SCRUTINY") {
    return fail("The application is not in re-scrutiny.");
  }

  const results = evaluateAphRules(aphInputFor(ticket.application));
  const summary = aphSummary(results);
  if (summary.flagged > 0) {
    const codes = results
      .filter((rule) => rule.status !== "PASSED")
      .map((rule) => rule.ruleCode)
      .join(", ");
    return fail(
      `Re-scrutiny failed: ${summary.flagged} rule${summary.flagged === 1 ? "" : "s"} still flagged (${codes}). Review the evidence or issue a fresh notice.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await persistRules(tx, ticket.applicationId, results);
    await tx.deficiencyTicket.update({
      where: { id: ticket.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    await tx.application.update({
      where: { id: ticket.applicationId },
      data: {
        status: "SCRUTINY_CLEARED",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        remarks: `Deficiency ${ticket.noticeNo ?? ""} resolved. Case cleared after re-scrutiny.`.trim(),
      },
    });
    await recordAudit(
      {
        applicationId: ticket.applicationId,
        institutionId: ticket.application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "DEFICIENCY_RESOLVED",
        previousState: "RE_SCRUTINY",
        newState: "SCRUTINY_CLEARED",
        detail: `Resubmission accepted against ${ticket.noticeNo ?? "notice"}. All ${summary.total} APH rules passed on re-evaluation.`,
      },
      tx,
    );
  });

  refresh();
  return ok("Resubmission accepted. All APH rules pass; the case is cleared for its next stage.");
}

export async function scheduleEvcAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "SCHEDULE_EVC");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const memberId = field(formData, "memberId");
  const dateInput = field(formData, "scheduledDate");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { institution: true, inspections: true },
  });
  if (!application) return fail("Application not found.");
  if (application.status !== "SCRUTINY_CLEARED") {
    return fail("The case must clear scrutiny before an Expert Visit Committee can be constituted.");
  }
  if (application.inspections.length > 0) {
    return fail("An inspection record is already on file for this application.");
  }

  const member = findEvcMember(memberId);
  if (!member) return fail("Select a valid EVC member from the approved roster.");
  const scheduledDate = dateFromInput(dateInput, false);
  if (!scheduledDate || scheduledDate.getTime() <= Date.now()) {
    return fail("The inspection date must be in the future.");
  }

  const conflict = checkConflict(member, application.institution);
  if (!conflict.passed) {
    return fail(`Conflict of interest: ${conflict.reasons.join(" ")} Select a disinterested member.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.eVCInspection.create({
      data: {
        applicationId: application.id,
        scheduledDate,
        committeeLead: member.name,
        committeeRegion: member.region,
        committeeAffiliation: member.affiliation,
        conflictCheckPassed: true,
        conflictNotes: `No overlap with applicant region (${application.institution.region}) or affiliating university (${application.institution.affiliatingUniversity}).`,
        siteReportStatus: "PENDING",
        geofenceVerified: false,
      },
    });
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "EVC_SCHEDULED",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        remarks: `EVC constituted under ${member.name}. Visit scheduled ${fmtDate(scheduledDate)}.`,
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "EVC_SCHEDULED",
        previousState: "SCRUTINY_CLEARED",
        newState: "EVC_SCHEDULED",
        detail: `EVC constituted under ${member.name} (${member.region}). Conflict check cleared. Visit scheduled ${fmtDate(scheduledDate)}.`,
      },
      tx,
    );
  });

  refresh();
  return ok(`EVC constituted under ${member.name}. Conflict check passed; geofenced visit scheduled for ${fmtDate(scheduledDate)}.`);
}

export async function submitSiteReportAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "SUBMIT_SITE_REPORT");
  if (denied) return denied;

  const inspectionId = field(formData, "inspectionId");
  const summary = field(formData, "reportSummary");
  const recommendation = field(formData, "recommendation");
  const latRaw = field(formData, "deviceLatitude");
  const lngRaw = field(formData, "deviceLongitude");

  const inspection = await prisma.eVCInspection.findUnique({
    where: { id: inspectionId },
    include: {
      application: { include: { institution: true } },
    },
  });
  if (!inspection) return fail("Inspection record not found.");
  if (inspection.application.status !== "EVC_SCHEDULED") {
    return fail("This case is not awaiting a site report.");
  }
  if (inspection.siteReportStatus === "COMPLETED") {
    return fail("A site report has already been filed for this inspection.");
  }
  if (summary.length < 20) return fail("The site report summary must be at least 20 characters.");
  if (!["RECOMMENDED", "CONDITIONAL", "NOT_RECOMMENDED"].includes(recommendation)) {
    return fail("Select a valid committee recommendation.");
  }

  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return fail("Device latitude is invalid.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return fail("Device longitude is invalid.");
  }

  const geo = geofenceResult(
    {
      latitude: inspection.application.institution.latitude,
      longitude: inspection.application.institution.longitude,
    },
    { latitude, longitude },
  );
  if (!geo.verified) {
    return fail(
      `Geofence verification failed: field device is ${geo.distanceM.toLocaleString("en-IN")} m from the campus (limit ${GEOFENCE_RADIUS_M} m). A site report cannot be filed remotely.`,
    );
  }

  const nextStatus = statusAfterSiteReport(inspection.application.processingPath);
  const coordinates = `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;

  await prisma.$transaction(async (tx) => {
    await tx.eVCInspection.update({
      where: { id: inspection.id },
      data: {
        siteReportStatus: "COMPLETED",
        geofenceVerified: true,
        geofenceCoordinates: coordinates,
        geofenceDistanceM: geo.distanceM,
        reportSummary: summary,
        recommendation,
        reportSubmittedAt: new Date(),
      },
    });
    await tx.application.update({
      where: { id: inspection.applicationId },
      data: {
        status: nextStatus,
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        remarks: `EVC report filed by ${inspection.committeeLead}. Recommendation: ${recommendation.replaceAll("_", " ")}.`,
      },
    });
    await recordAudit(
      {
        applicationId: inspection.applicationId,
        institutionId: inspection.application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "SITE_REPORT_SUBMITTED",
        previousState: "EVC_SCHEDULED",
        newState: nextStatus,
        detail: `Site report filed with recommendation ${recommendation.replaceAll("_", " ")}. Geofence verified at ${geo.distanceM} m from campus (${coordinates}).`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    `Site report filed. Geofence verified at ${geo.distanceM} m. Case advanced to ${nextStatus.replaceAll("_", " ")}.`,
  );
}

export async function renewDocumentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RENEW_DOCUMENT");
  if (denied) return denied;

  const documentId = field(formData, "documentId");
  const expiryInput = field(formData, "expiryDate");
  const reference = field(formData, "documentRef");

  const document = await prisma.complianceDocument.findUnique({
    where: { id: documentId },
    include: { institution: true },
  });
  if (!document) return fail("Compliance document not found.");
  const scope = tenantError(session, document.institutionId);
  if (scope) return fail(scope);

  const expiry = dateFromInput(expiryInput, true);
  if (!expiry || expiry.getTime() <= Date.now()) {
    return fail("The renewed document must carry a future expiry date.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.complianceDocument.update({
      where: { id: document.id },
      data: {
        expiryDate: expiry,
        status: "VALID",
        documentRef: reference || document.documentRef,
        lastVerifiedAt: new Date(),
        notes: `Renewed by institution on ${fmtDate(new Date())}; certificate on file.`,
      },
    });
    await recordAudit(
      {
        applicationId: null,
        institutionId: document.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "DOCUMENT_RENEWED",
        previousState: document.status,
        newState: "VALID",
        detail: `${document.docType.replaceAll("_", " ")} renewed. Expiry ${fmtDate(document.expiryDate)} → ${fmtDate(expiry)}. Reference: ${reference || document.documentRef}.`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    `${document.docType.replaceAll("_", " ")} renewed and marked valid until ${fmtDate(expiry)}.`,
  );
}

export async function runSlaSweepAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "RUN_SLA_SWEEP");
  if (denied) return denied;

  const apps = await prisma.application.findMany({
    where: { status: { notIn: ["APPROVED", "REJECTED"] } },
    include: {
      institution: { select: { region: true, name: true } },
      escalations: { select: { status: true } },
    },
  });

  let raised = 0;
  let overdueReports = 0;
  let advancedToBreach = 0;

  await prisma.$transaction(async (tx) => {
    const now = new Date();

    for (const app of apps) {
      const days = liveDaysInStage(app.stageEnteredAt, now);
      const slaStatus = slaForDays(days);
      if (slaStatus === "BREACHED" && app.slaStatus !== "BREACHED") advancedToBreach += 1;

      await tx.application.update({
        where: { id: app.id },
        data: { daysInCurrentStage: days, slaStatus },
      });

      const hasActiveEscalation = app.escalations.some(
        (ticket) => ticket.status === "OPEN" || ticket.status === "ACKNOWLEDGED",
      );

      if (slaStatus === "BREACHED" && !hasActiveEscalation) {
        const regionCode = REGION_META[app.institution.region as Region]?.code ?? app.institution.region.slice(0, 2);
        const referenceTail = app.referenceNo.split("/").pop() ?? app.id.slice(-4);
        const escalationNo = `ESC-${now.getFullYear()}-${regionCode}-${referenceTail}-R${app.escalations.length + 1}`;
        await tx.escalationTicket.create({
          data: {
            escalationNo,
            applicationId: app.id,
            region: app.institution.region,
            trigger: "STATUTORY_DEADLINE_BREACH",
            daysInStage: days,
            penaltyPoints: SLA_POLICY.penaltyPoints,
            status: "OPEN",
            assignedTo: "Member Secretary, AICTE",
          },
        });
        raised += 1;
        await recordAudit(
          {
            applicationId: app.id,
            institutionId: null,
            performedBy: "SLA Automation Engine",
            role: "SYSTEM",
            action: "SLA_ESCALATION_RAISED",
            previousState: app.status,
            newState: app.status,
            detail: `${days} days in stage exceeded the ${SLA_POLICY.deadlineDays}-day limit. Escalation ${escalationNo} raised; ${SLA_POLICY.penaltyPoints} penalty points against ${app.institution.region} region.`,
          },
          tx,
        );
      }
    }

    const overdue = await tx.eVCInspection.updateMany({
      where: {
        siteReportStatus: "PENDING",
        scheduledDate: { lt: now },
        application: { status: "EVC_SCHEDULED" },
      },
      data: { siteReportStatus: "OVERDUE" },
    });
    overdueReports = overdue.count;

    await recordAudit(
      {
        performedBy: session.user.name,
        role: session.role,
        action: "SLA_SWEEP_EXECUTED",
        previousState: null,
        newState: null,
        detail: `National SLA sweep: ${apps.length} active cases recomputed, ${raised} new escalation(s), ${overdueReports} inspection report(s) marked overdue, ${advancedToBreach} case(s) newly breached.`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    `SLA sweep complete across ${apps.length} active cases. ${raised} new escalation${raised === 1 ? "" : "s"}, ${overdueReports} report${overdueReports === 1 ? "" : "s"} marked overdue.`,
  );
}

export async function acknowledgeEscalationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "ACK_ESCALATION");
  if (denied) return denied;

  const escalationId = field(formData, "escalationId");
  const escalation = await prisma.escalationTicket.findUnique({
    where: { id: escalationId },
    include: { application: true },
  });
  if (!escalation) return fail("Escalation ticket not found.");
  if (escalation.status !== "OPEN") return fail("Only an open escalation can be acknowledged.");

  await prisma.$transaction(async (tx) => {
    await tx.escalationTicket.update({
      where: { id: escalation.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        assignedTo: `${session.user.name} — ${ROLE_META[session.role].label}`,
      },
    });
    await recordAudit(
      {
        applicationId: escalation.applicationId,
        institutionId: null,
        performedBy: session.user.name,
        role: session.role,
        action: "ESCALATION_ACKNOWLEDGED",
        previousState: escalation.application.status,
        newState: escalation.application.status,
        detail: `${escalation.escalationNo} acknowledged. ${escalation.penaltyPoints} penalty points remain recorded against ${escalation.region} region.`,
      },
      tx,
    );
  });

  refresh();
  return ok(`${escalation.escalationNo} acknowledged. Regional penalty remains on the national register.`);
}

export async function routeToShcAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "DECIDE_APPLICATION");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) return fail("Application not found.");
  if (application.status !== "SAC_REVIEW") {
    return fail("Only a case under SAC review can be escalated to the SHC.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "SHC_REVIEW",
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "APPLICATION_RESUBMITTED",
        previousState: "SAC_REVIEW",
        newState: "SHC_REVIEW",
        detail: "Case routed to the Standing Hearing Committee for final review.",
      },
      tx,
    );
  });

  refresh();
  return ok("Case routed to the Standing Hearing Committee.");
}

export async function decideApplicationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "DECIDE_APPLICATION");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const decision = field(formData, "decision");
  const note = field(formData, "note");
  const suppliedOrderNo = field(formData, "orderNo");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { institution: true },
  });
  if (!application) return fail("Application not found.");
  if (!canDecide(application.status)) {
    return fail("This case has not reached a stage where a final decision can be recorded.");
  }
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return fail("Select a valid final decision.");
  }
  if (decision === "REJECTED" && note.length < 20) {
    return fail("A rejection must record a reasoned order of at least 20 characters.");
  }

  const regionCode = REGION_META[application.institution.region as Region]?.code ?? "NA";
  const orderNo =
    decision === "APPROVED"
      ? suppliedOrderNo ||
        `AICTE/EOA/${new Date().getFullYear()}/${regionCode}/${application.referenceNo.split("/").pop()}`
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: decision,
        stageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        slaStatus: "ON_TRACK",
        decisionAt: new Date(),
        approvalOrderNo: orderNo,
        remarks:
          note ||
          (decision === "APPROVED"
            ? `Approved by the Bureau. Order ${orderNo} issued.`
            : "Application rejected by the competent authority."),
      },
    });
    await recordAudit(
      {
        applicationId: application.id,
        institutionId: application.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: decision === "APPROVED" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
        previousState: application.status,
        newState: decision,
        detail:
          decision === "APPROVED"
            ? `Final approval recorded. Letter of Approval ${orderNo} issued. ${note}`.trim()
            : `Application rejected. Reasoned order: ${note}`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    decision === "APPROVED"
      ? `Application approved. Order ${orderNo} recorded in the case file.`
      : "Application rejected with a reasoned order on file.",
  );
}

export async function attestLedgerAction(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "ATTEST_LEDGER");
  if (denied) return denied;

  const verification = await verifyAuditLedger();
  if (!verification.valid) {
    return fail(
      `Ledger integrity failure at entry #${verification.brokenAtSequence}. ${verification.reason ?? ""} Attestation refused.`,
    );
  }

  await recordAudit({
    performedBy: session.user.name,
    role: session.role,
    action: "LEDGER_VERIFIED",
    previousState: null,
    newState: null,
    detail: `Ledger integrity attested across ${verification.entries} entries. Verified head ${verification.headHash}. Database guards: ${verification.triggers.join(", ") || "none"}.`,
  });

  refresh();
  return ok(
    `Ledger verified and attested: ${verification.entries} entries, hash chain intact. Attestation appended to the ledger.`,
  );
}

export async function uploadEvidenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "UPLOAD_EVIDENCE");
  if (denied) return denied;

  const applicationId = field(formData, "applicationId");
  const declaredType = field(formData, "docType") || "AUTO";
  const entry = formData.get("file");

  if (!entry || typeof entry === "string" || typeof entry.arrayBuffer !== "function") {
    return fail("Choose a PDF annexure to upload.");
  }
  const upload = entry as File;
  if (upload.size === 0) return fail("The selected file is empty.");
  if (upload.size > MAX_EVIDENCE_BYTES) {
    return fail(`Evidence files must be at most ${Math.round(MAX_EVIDENCE_BYTES / (1024 * 1024))} MB.`);
  }
  if (!/\.pdf$/i.test(upload.name) && upload.type !== "application/pdf") {
    return fail("Only PDF annexures are accepted.");
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, institutionId: true, referenceNo: true },
  });
  if (!app) return fail("Application not found.");
  const scope = tenantError(session, app.institutionId);
  if (scope) return fail(scope);

  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (!isPdf(bytes)) return fail("The file is not a readable PDF (missing %PDF header).");

  const processed = await processEvidencePdf(bytes);
  const resolvedType =
    declaredType !== "AUTO" && isEvidenceType(declaredType) ? declaredType : processed.detectedType;

  const id = randomUUID();
  const storagePath = await saveEvidenceFile(id, bytes);

  const previous = await prisma.evidenceFile.findFirst({
    where: { institutionId: app.institutionId, docType: resolvedType },
    orderBy: { createdAt: "desc" },
  });
  const referenceMatch = previous ? previous.sha256 === processed.sha256 : null;
  const reuseCount = await prisma.evidenceFile.count({
    where: { sha256: processed.sha256, institutionId: { not: app.institutionId } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.evidenceFile.create({
      data: {
        id,
        applicationId: app.id,
        institutionId: app.institutionId,
        docType: resolvedType,
        detectedType: processed.detectedType,
        typeConfidence: processed.typeConfidence,
        fileName: upload.name.slice(0, 200),
        mimeType: upload.type || "application/pdf",
        sizeBytes: upload.size,
        sha256: processed.sha256,
        storagePath,
        textChars: processed.textChars,
        hasTextLayer: processed.hasTextLayer,
        extracted: processed.extractedJson,
        integrity: "UNVERIFIED",
        referenceMatch,
        referenceOfId: previous?.id ?? null,
        uploadedBy: session.user.name,
        uploadedRole: session.role,
      },
    });
    await recordAudit(
      {
        applicationId: app.id,
        institutionId: app.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "EVIDENCE_UPLOADED",
        previousState: previous ? `${previous.sha256.slice(0, 12)}…` : null,
        newState: `${processed.sha256.slice(0, 12)}…`,
        detail: `${EVIDENCE_TYPE_LABELS[resolvedType]} uploaded for ${app.referenceNo}. SHA-256 ${processed.sha256.slice(0, 16)}… · classifier ${processed.detectedType} at ${Math.round(processed.typeConfidence * 100)}% · ${processed.fields.length} field(s) extracted${referenceMatch === false ? " · DIGEST MISMATCH against previous version" : referenceMatch === true ? " · identical digest to previous version" : ""}${reuseCount > 0 ? ` · digest already filed by ${reuseCount} other institution(s)` : ""}.`,
      },
      tx,
    );
  });

  refresh();
  const reuseNote =
    reuseCount > 0
      ? ` The same digest is already on the national register under ${reuseCount} other institution${reuseCount === 1 ? "" : "s"}.`
      : "";
  if (!processed.hasTextLayer) {
    return ok(
      `${upload.name} stored and hashed. No text layer detected — confirm the document type manually.${reuseNote}`,
    );
  }
  return ok(
    `${upload.name} → ${EVIDENCE_TYPE_LABELS[resolvedType]} · ${processed.fields.length} fields extracted · digest ${processed.sha256.slice(0, 12)}….${reuseNote}`,
  );
}

export async function verifyEvidenceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "VERIFY_EVIDENCE");
  if (denied) return denied;

  const evidenceId = field(formData, "evidenceId");
  const record = await prisma.evidenceFile.findUnique({ where: { id: evidenceId } });
  if (!record) return fail("Evidence record not found.");
  const scope = tenantError(session, record.institutionId);
  if (scope) return fail(scope);

  let actual: string;
  try {
    actual = await rehashStored(record.storagePath);
  } catch {
    return fail("The stored file could not be read from the evidence store.");
  }

  const match = actual === record.sha256;
  const integrity = match ? "VERIFIED" : "TAMPERED";

  await prisma.$transaction(async (tx) => {
    await tx.evidenceFile.update({
      where: { id: record.id },
      data: { integrity, verifyCount: { increment: 1 }, lastVerifiedAt: new Date() },
    });
    await recordAudit(
      {
        applicationId: record.applicationId,
        institutionId: record.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "EVIDENCE_VERIFIED",
        previousState: record.integrity,
        newState: integrity,
        detail: match
          ? `Digest recheck passed for ${record.fileName}: recomputed SHA-256 equals the stored reference (${record.sha256.slice(0, 16)}…).`
          : `Digest mismatch for ${record.fileName}. Stored ${record.sha256.slice(0, 16)}… but the stored file now reads ${actual.slice(0, 16)}….`,
      },
      tx,
    );
  });

  refresh();
  return match
    ? ok(`Digest matched — ${record.fileName} is intact (${record.sha256.slice(0, 12)}…).`)
    : fail(`Digest mismatch — ${record.fileName} has changed since it was stored.`);
}

export async function confirmEvidenceTypeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "VERIFY_EVIDENCE");
  if (denied) return denied;

  const evidenceId = field(formData, "evidenceId");
  const docType = field(formData, "docType");
  if (!isEvidenceType(docType) || docType === "OTHER") {
    return fail("Choose the statutory document type you verified.");
  }

  const record = await prisma.evidenceFile.findUnique({ where: { id: evidenceId } });
  if (!record) return fail("Evidence record not found.");
  const scope = tenantError(session, record.institutionId);
  if (scope) return fail(scope);

  const previousType = record.docType;
  await prisma.$transaction(async (tx) => {
    await tx.evidenceFile.update({
      where: { id: record.id },
      data: { docType, reviewedBy: session.user.name, reviewedAt: new Date() },
    });
    await recordAudit(
      {
        applicationId: record.applicationId,
        institutionId: record.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "EVIDENCE_TYPE_CONFIRMED",
        previousState: previousType,
        newState: docType,
        detail: `${record.fileName} reviewed by ${session.user.name} and confirmed as ${EVIDENCE_TYPE_LABELS[docType]}. Classifier proposed ${record.detectedType} at ${Math.round(record.typeConfidence * 100)}%${record.hasTextLayer ? "" : " on a scanned annexure with no text layer"}.`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    `${record.fileName} reviewed and filed as ${EVIDENCE_TYPE_LABELS[docType]}. The confirmation is on the ledger.`,
  );
}

export async function applyExtractionAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "APPLY_EXTRACTION");
  if (denied) return denied;

  const evidenceId = field(formData, "evidenceId");
  const record = await prisma.evidenceFile.findUnique({ where: { id: evidenceId } });
  if (!record) return fail("Evidence record not found.");
  const scope = tenantError(session, record.institutionId);
  if (scope) return fail(scope);
  if (!record.hasTextLayer) {
    return fail("No text layer in this annexure — nothing to apply. Enter values manually.");
  }

  let fields: ExtractedField[] = [];
  try {
    const parsed = JSON.parse(record.extracted) as { fields?: ExtractedField[] };
    fields = Array.isArray(parsed.fields) ? parsed.fields : [];
  } catch {
    fields = [];
  }

  const updates: Prisma.InstitutionUpdateInput = {};
  const applied: string[] = [];
  for (const field of fields) {
    const numeric = Number(field.value.replace(/,/g, "").trim());
    if (!Number.isFinite(numeric)) continue;
    switch (field.key) {
      case "builtUpAreaSqM":
        if (numeric >= 1000 && numeric <= 2_000_000) {
          updates.builtUpAreaSqM = Math.round(numeric);
          applied.push(`built-up ${Math.round(numeric).toLocaleString("en-IN")} sq m`);
        }
        break;
      case "facultyCount":
        if (numeric >= 1 && numeric <= 20_000) {
          updates.facultyCount = Math.round(numeric);
          applied.push(`faculty ${Math.round(numeric)}`);
        }
        break;
      case "intake":
        if (numeric >= 1 && numeric <= 100_000) {
          updates.studentIntake = Math.round(numeric);
          applied.push(`intake ${Math.round(numeric)}`);
        }
        break;
      case "landAcres":
        if (numeric >= 0.1 && numeric <= 10_000) {
          updates.totalLandAcres = numeric;
          applied.push(`land ${numeric.toFixed(2)} acres`);
        }
        break;
      default:
        break;
    }
  }

  if (Object.keys(updates).length === 0) {
    return fail("No applicable numeric fields were extracted from this annexure.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.institution.update({ where: { id: record.institutionId }, data: updates });
    await recordAudit(
      {
        applicationId: record.applicationId,
        institutionId: record.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "PROFILE_UPDATED_FROM_EVIDENCE",
        previousState: null,
        newState: null,
        detail: `Institution profile corrected from ${record.fileName}: ${applied.join("; ")}. Digest ${record.sha256.slice(0, 16)}….`,
      },
      tx,
    );
  });

  refresh();
  return ok(`Profile updated from ${record.fileName}: ${applied.join(", ")}.`);
}


export async function runGeminiEvidenceAuditAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const denied = requireCapability(session, "VERIFY_EVIDENCE");
  if (denied) return denied;

  const evidenceId = field(formData, "evidenceId");
  const record = await prisma.evidenceFile.findUnique({
    where: { id: evidenceId },
    include: { institution: true, application: true },
  });
  if (!record) return fail("Evidence record not found.");
  const scope = tenantError(session, record.institutionId);
  if (scope) return fail(scope);

  let rawText = "";
  try {
    const bytes = await readEvidenceFile(record.storagePath);
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = (await extractText(pdf, { mergePages: true })) as { text: string | string[] };
    rawText = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
  } catch (err) {
    return fail(`Could not extract text layer for forensic AI analysis: ${err instanceof Error ? err.message : "PDF error"}`);
  }

  const analysis = await analyzeDocumentWithGemini({
    fileName: record.fileName,
    docType: record.docType,
    rawText: rawText || record.fileName,
    institutionName: record.institution.name,
  });

  if (!analysis) {
    return fail("Gemini Forensic Engine timeout or parse error. Please retry.");
  }

  let existingExtracted: Record<string, unknown> = {};
  try {
    existingExtracted = JSON.parse(record.extracted);
  } catch {
    existingExtracted = {};
  }

  const updatedExtracted = {
    ...existingExtracted,
    geminiAudit: analysis,
    auditedAt: new Date().toISOString(),
  };

  const newIntegrity =
    analysis.forensicAudit.integrityRating === "VERIFIED"
      ? "VERIFIED"
      : analysis.forensicAudit.integrityRating === "TAMPER_SUSPECTED"
        ? "TAMPERED"
        : record.integrity;

  await prisma.$transaction(async (tx) => {
    await tx.evidenceFile.update({
      where: { id: record.id },
      data: {
        extracted: JSON.stringify(updatedExtracted),
        integrity: newIntegrity,
        reviewedBy: `Gemini Forensic AI (supervised by ${session.user.name})`,
        reviewedAt: new Date(),
      },
    });

    await recordAudit(
      {
        applicationId: record.applicationId,
        institutionId: record.institutionId,
        performedBy: session.user.name,
        role: session.role,
        action: "AI_FORENSIC_SCRUTINY_EXECUTED",
        previousState: record.integrity,
        newState: newIntegrity,
        detail: `Gemini 3 Flash forensic audit for ${record.fileName}: Authenticity Score ${analysis.forensicAudit.authenticityScore}/100 · Rating: ${analysis.forensicAudit.integrityRating} · Seal: ${analysis.forensicAudit.sealDetected ? "YES" : "NO"} · Signature: ${analysis.forensicAudit.signatureDetected ? "YES" : "NO"} · Flags: ${analysis.forensicAudit.tamperFlags.join(", ") || "None"} · Summary: ${analysis.forensicAudit.officialSummary.slice(0, 200)}`,
      },
      tx,
    );
  });

  refresh();
  return ok(
    `Gemini Forensic Scrutiny complete: Authenticity ${analysis.forensicAudit.authenticityScore}% (${analysis.forensicAudit.integrityRating}). ${analysis.forensicAudit.officialSummary}`,
  );
}

export async function draftAiDeficiencyAction(
  applicationId: string,
): Promise<{ ok: boolean; noticeText?: string; clausesCited?: string[]; error?: string }> {
  const session = await getSession();
  if (!can(session.role, "RAISE_DEFICIENCY")) {
    return { ok: false, error: "Unauthorized: only Regional and Bureau Officers can draft deficiency notices." };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      institution: { include: { documents: true } },
      filingDeclaration: true,
    },
  });
  if (!app) return { ok: false, error: "Application not found." };

  const aphInput = aphInputFor(app);
  const liveRules = evaluateAphRules(aphInput);
  const flagged = liveRules.filter((r) => r.status !== "PASSED");

  if (flagged.length === 0) {
    return {
      ok: false,
      error: "All live APH rules are currently satisfied. No deficiency notice is required.",
    };
  }

  const declaration = app.filingDeclaration;
  const admissions = declaration?.studentIntake ?? app.institution.studentIntake;
  const facultyCount = declaration?.facultyCount ?? app.institution.facultyCount;

  const result = await generateAicteDeficiencyNotice({
    referenceNo: app.referenceNo,
    institutionName: app.institution.name,
    programName: app.programName,
    flaggedRules: flagged,
    admissions,
    facultyCount,
  });

  if (!result) {
    return { ok: false, error: "Gemini failed to generate draft notice." };
  }

  return {
    ok: true,
    noticeText: result.noticeText,
    clausesCited: result.clausesCited,
  };
}

export async function generateAiRemediationAction(
  applicationId: string,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      institution: { include: { documents: true } },
      filingDeclaration: true,
    },
  });
  if (!app) return { ok: false, error: "Application not found." };

  const aphInput = aphInputFor(app);
  const liveRules = evaluateAphRules(aphInput);
  const flagged = liveRules.filter((r) => r.status !== "PASSED");

  const declaration = app.filingDeclaration;
  const admissions = declaration?.studentIntake ?? app.institution.studentIntake;
  const facultyCount = declaration?.facultyCount ?? app.institution.facultyCount;
  const builtUpArea = declaration?.builtUpAreaSqM ?? app.institution.builtUpAreaSqM;

  const result = await generateAicteRemediationRoadmap({
    referenceNo: app.referenceNo,
    institutionName: app.institution.name,
    programName: app.programName,
    flaggedRules: flagged,
    admissions,
    facultyCount,
    builtUpArea,
  });

  if (!result) {
    return { ok: false, error: "Gemini failed to generate remediation roadmap." };
  }

  return { ok: true, data: result };
}

export async function evaluateAiInspectionAction(
  inspectionId: string,
  siteObservations: string,
): Promise<{ ok: boolean; evaluation?: unknown; error?: string }> {
  const inspection = await prisma.eVCInspection.findUnique({
    where: { id: inspectionId },
    include: {
      application: { include: { institution: true, filingDeclaration: true } },
    },
  });
  if (!inspection) return { ok: false, error: "Inspection record not found." };

  const declaration = inspection.application.filingDeclaration;
  const intake = declaration?.studentIntake ?? inspection.application.institution.studentIntake;
  const faculty = declaration?.facultyCount ?? inspection.application.institution.facultyCount;
  const builtUp = declaration?.builtUpAreaSqM ?? inspection.application.institution.builtUpAreaSqM;

  const evaluation = await evaluateEvcInspectionWithGemini({
    committeeLead: inspection.committeeLead,
    institutionName: inspection.application.institution.name,
    declaredIntake: intake,
    declaredFaculty: faculty,
    declaredBuiltUpSqM: builtUp,
    geofenceDistanceM: inspection.geofenceDistanceM ?? 0,
    siteObservations,
  });

  if (!evaluation) {
    return { ok: false, error: "Gemini failed to evaluate site observations." };
  }

  return { ok: true, evaluation };
}
