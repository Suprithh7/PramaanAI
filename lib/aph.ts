import { fmtDate } from "./format";
import type { ApplicationType, DocType, RuleStatus } from "./types";

export type AphRuleResult = {
  ruleCode: string;
  ruleName: string;
  requirement: string;
  requiredValue: string;
  submittedValue: string;
  status: RuleStatus;
  remarks: string;
  source: string;
};

export type AphInstitution = {
  name: string;
  totalLandAcres: number;
  builtUpAreaSqM: number;
  facultyCount: number;
  studentIntake: number;
};

export type AphDocument = {
  docType: DocType | string;
  status: string;
  expiryDate: Date | string;
  documentRef?: string | null;
  notes?: string | null;
};

export type AphInput = {
  applicationType: ApplicationType | string;
  institution: AphInstitution;
  documents: AphDocument[];
  now?: Date;
};

const DAY_MS = 86_400_000;

function docOf(documents: AphDocument[], type: DocType): AphDocument | undefined {
  return documents.find((doc) => doc.docType === type);
}

function expiry(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function remainingYears(expiryDate: Date, now: Date): number {
  return (expiryDate.getTime() - now.getTime()) / (365.25 * DAY_MS);
}

function docIsLive(doc: AphDocument, now: Date): boolean {
  const dateOk = expiry(doc.expiryDate).getTime() > now.getTime();
  if (!dateOk) return false;
  return doc.status === "VALID" || doc.status === "EXPIRING_SOON";
}

function docLabel(doc: AphDocument): string {
  return `${doc.status.replaceAll("_", " ")} · ${fmtDate(doc.expiryDate)}`;
}

/**
 * Automated APH validation engine. Deterministic and side-effect free so the
 * same evaluation powers the UI, persisted checks and the formal notice.
 */
export function evaluateAphRules(input: AphInput): AphRuleResult[] {
  const now = input.now ?? new Date();
  const { institution, documents, applicationType } = input;
  const results: AphRuleResult[] = [];

  const faculty = institution.facultyCount;
  const intake = institution.studentIntake;
  const ratio = faculty > 0 ? intake / faculty : Number.POSITIVE_INFINITY;
  results.push({
    ruleCode: "APH-101",
    ruleName: "Faculty–Student Ratio",
    requirement:
      "Adequate full-time faculty for the sanctioned intake, not exceeding 1:15 across the institution.",
    requiredValue: "≤ 1:15.00",
    submittedValue: faculty > 0 ? `1:${ratio.toFixed(2)} (${intake} students / ${faculty} faculty)` : "No faculty on record",
    status: faculty > 0 && ratio <= 15 ? "PASSED" : "DEFICIENCY_FLAGGED",
    remarks:
      faculty > 0 && ratio <= 15
        ? `Ratio is within the APH ceiling with a headroom of ${(15 * faculty - intake).toFixed(0)} students.`
        : "Appoint additional full-time faculty or reduce the requested intake before re-scrutiny.",
    source: "Institution Faculty Register",
  });

  const areaPerStudent = intake > 0 ? institution.builtUpAreaSqM / intake : 0;
  results.push({
    ruleCode: "APH-102",
    ruleName: "Built-up Area per Student",
    requirement:
      "Instructional and supporting built-up area of at least 10.00 sqm per admitted student.",
    requiredValue: "≥ 10.00 sqm / student",
    submittedValue: `${areaPerStudent.toFixed(2)} sqm / student (${institution.builtUpAreaSqM.toLocaleString("en-IN")} sqm / ${intake.toLocaleString("en-IN")} students)`,
    status: intake > 0 && areaPerStudent >= 10 ? "PASSED" : "DEFICIENCY_FLAGGED",
    remarks:
      intake > 0 && areaPerStudent >= 10
        ? "Built-up area statement is consistent with the sanctioned plan."
        : "Submit a revised architectural area statement or sanctioned additional built-up area.",
    source: "Architectural Area Statement",
  });

  const lease = docOf(documents, "LEASE_DEED");
  const leaseYears = lease ? remainingYears(expiry(lease.expiryDate), now) : 0;
  results.push({
    ruleCode: "APH-103",
    ruleName: "Land Lease Tenure",
    requirement:
      "The institution must hold unencumbered land with a lease tenure of at least 30 unexpired years.",
    requiredValue: "≥ 30 years remaining",
    submittedValue: lease ? `${Math.max(0, leaseYears).toFixed(1)} years remaining · expires ${fmtDate(lease.expiryDate)}` : "Lease deed not on record",
    status: lease && leaseYears >= 30 && docIsLive(lease, now) ? "PASSED" : "DEFICIENCY_FLAGGED",
    remarks:
      lease && leaseYears >= 30 && docIsLive(lease, now)
        ? "Registered lease deed satisfies the 30-year unexpired tenure requirement."
        : "Execute a registered lease extension or produce a fresh 30-year lease deed.",
    source: "Registered Lease Deed",
  });

  const fire = docOf(documents, "FIRE_SAFETY");
  const fireOk = fire ? docIsLive(fire, now) : false;
  results.push({
    ruleCode: "APH-104",
    ruleName: "Fire Safety Certificate",
    requirement:
      "A valid fire safety certificate issued by the competent authority must be in force on the date of scrutiny.",
    requiredValue: "Valid certificate on record",
    submittedValue: fire ? docLabel(fire) : "Certificate not on record",
    status: fireOk ? "PASSED" : "DEFICIENCY_FLAGGED",
    remarks: fireOk
      ? fire?.status === "EXPIRING_SOON"
        ? `Certificate is valid but renewal is due by ${fmtDate(fire.expiryDate)}.`
        : "Fire safety clearance is current and verified against the issuing authority."
      : "Produce a current fire safety certificate from the State Fire Department.",
    source: "State Fire Department",
  });

  const building = docOf(documents, "BUILDING_PLAN");
  const buildingOk = building ? docIsLive(building, now) : false;
  results.push({
    ruleCode: "APH-105",
    ruleName: "Approved Building Plan",
    requirement:
      "Building plan sanctioned by the competent planning authority, covering the proposed programme and intake.",
    requiredValue: "Sanctioned plan on record",
    submittedValue: building ? `${building.status.replaceAll("_", " ")} · ${fmtDate(building.expiryDate)}` : "Plan not on record",
    status: buildingOk ? "PASSED" : "DEFICIENCY_FLAGGED",
    remarks: buildingOk
      ? "Sanctioned plan covers the buildings declared in the application."
      : "Submit the sanctioned plan revision covering the proposed built-up area.",
    source: "Town Planning Authority",
  });

  const undertaking = docOf(documents, "UNDERTAKING");
  const undertakingOk = undertaking
    ? undertaking.status !== "EXPIRED" && undertaking.status !== "PENDING_RENEWAL"
    : false;
  results.push({
    ruleCode: "APH-106",
    ruleName: "Statutory Undertaking",
    requirement:
      "A signed undertaking from the head of the institution affirming compliance with APH norms and AICTE regulations.",
    requiredValue: "Signed undertaking on record",
    submittedValue: undertaking ? docLabel(undertaking) : "Undertaking not on record",
    status: undertakingOk ? "PASSED" : "DEFICIENCY_FLAGGED",
    remarks: undertakingOk
      ? "Undertaking is signed by the authorised signatory and registered against the institution."
      : "Upload the undertaking signed by the Registrar or head of institution.",
    source: "Institutional Record",
  });

  if (applicationType === "NEW_INSTITUTE") {
    const landOk = institution.totalLandAcres >= 10;
    results.push({
      ruleCode: "APH-107",
      ruleName: "Minimum Land Requirement",
      requirement:
        "New institutes must possess a contiguous land parcel of at least 10.00 acres for the proposed campus.",
      requiredValue: "≥ 10.00 acres",
      submittedValue: `${institution.totalLandAcres.toFixed(2)} acres`,
      status: landOk ? "PASSED" : "DEFICIENCY_FLAGGED",
      remarks: landOk
        ? "Land parcel meets the minimum contiguous area for a new institute."
        : "Produce a sale deed or lease for additional contiguous land.",
      source: "Land Record / Sale Deed",
    });
  }

  return results;
}

export function aphSummary(results: AphRuleResult[]) {
  const passed = results.filter((rule) => rule.status === "PASSED").length;
  const flagged = results.filter((rule) => rule.status === "DEFICIENCY_FLAGGED").length;
  return {
    passed,
    flagged,
    total: results.length,
    score: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
  };
}
