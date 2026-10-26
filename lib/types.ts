export const ROLES = [
  "INSTITUTION_ADMIN",
  "REGIONAL_OFFICER",
  "EVC_MEMBER",
  "COMPLIANCE_HEAD",
  "BUREAU_OFFICER",
] as const;

export type Role = (typeof ROLES)[number];

export type RoleMeta = {
  label: string;
  short: string;
  scope: string;
  summary: string;
  landing: string;
  icon: "building" | "map" | "clipboard" | "shield" | "landmark";
};

export const ROLE_META: Record<Role, RoleMeta> = {
  INSTITUTION_ADMIN: {
    label: "Institution Admin",
    short: "Institution",
    scope: "Institutional tenant",
    summary: "Prepare filings, clear deficiencies and maintain statutory evidence.",
    landing: "/applications",
    icon: "building",
  },
  REGIONAL_OFFICER: {
    label: "Regional Officer",
    short: "Regional",
    scope: "Regional office",
    summary: "Run APH scrutiny, issue formal deficiencies and schedule EVC visits.",
    landing: "/scrutiny",
    icon: "map",
  },
  EVC_MEMBER: {
    label: "EVC Member",
    short: "EVC",
    scope: "Expert visit committee",
    summary: "Conduct geofenced inspections and file the site verification report.",
    landing: "/evc",
    icon: "clipboard",
  },
  COMPLIANCE_HEAD: {
    label: "Compliance Head",
    short: "Compliance",
    scope: "National compliance",
    summary: "Monitor national SLA posture, document compliance and ledger integrity.",
    landing: "/",
    icon: "shield",
  },
  BUREAU_OFFICER: {
    label: "Bureau Officer",
    short: "Bureau",
    scope: "AICTE Bureau",
    summary: "Own escalations, regional penalties and final council decisions.",
    landing: "/escalations",
    icon: "landmark",
  },
};

export const ROLE_ORDER: Role[] = [
  "INSTITUTION_ADMIN",
  "REGIONAL_OFFICER",
  "EVC_MEMBER",
  "COMPLIANCE_HEAD",
  "BUREAU_OFFICER",
];

export function isRole(value: string | undefined | null): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}

export const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_META: Record<
  Region,
  { label: string; code: string; hq: string; accent: string }
> = {
  NORTH: { label: "Northern Region", code: "NR", hq: "New Delhi", accent: "#345374" },
  SOUTH: { label: "Southern Region", code: "SR", hq: "Bengaluru", accent: "#0f766e" },
  EAST: { label: "Eastern Region", code: "ER", hq: "Kolkata", accent: "#9a3412" },
  WEST: { label: "Western Region", code: "WR", hq: "Mumbai", accent: "#6d28d9" },
  CENTRAL: { label: "Central Region", code: "CR", hq: "Bhopal", accent: "#a16207" },
};

export function regionLabel(region: string): string {
  return REGION_META[region as Region]?.label ?? region;
}

export const APPLICATION_TYPES = [
  "NEW_INSTITUTE",
  "EOA_EXTENSION",
  "INTAKE_EXPANSION",
] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  NEW_INSTITUTE: "New Institute",
  EOA_EXTENSION: "EOA Extension",
  INTAKE_EXPANSION: "Intake Expansion",
};

export const PROCESSING_PATHS = [
  "SCRUTINY_ONLY",
  "SCRUTINY_EVC",
  "EVC_SAC_SHC",
  "EVC_ONLY",
] as const;
export type ProcessingPath = (typeof PROCESSING_PATHS)[number];

export const PROCESSING_PATH_META: Record<
  ProcessingPath,
  { label: string; route: string; description: string }
> = {
  SCRUTINY_ONLY: {
    label: "Scrutiny Only",
    route: "Scrutiny → Approval",
    description: "Desk scrutiny clears the case without an expert visit.",
  },
  SCRUTINY_EVC: {
    label: "Scrutiny + EVC",
    route: "Scrutiny → EVC → Approval",
    description: "Desk scrutiny followed by an Expert Visit Committee inspection.",
  },
  EVC_SAC_SHC: {
    label: "EVC + SAC + SHC",
    route: "Scrutiny → EVC → SAC → SHC → Approval",
    description: "Full route with Standing Appellate Committee and SHC review.",
  },
  EVC_ONLY: {
    label: "EVC Only",
    route: "EVC → Approval",
    description: "Direct expert inspection route for eligible extensions.",
  },
};

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_SCRUTINY",
  "DEFICIENCY_REVERTED",
  "RE_SCRUTINY",
  "SCRUTINY_CLEARED",
  "EVC_SCHEDULED",
  "EVC_COMPLETED",
  "SAC_REVIEW",
  "SHC_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_META: Record<ApplicationStatus, { label: string; tone: string; dot: string }> = {
  SUBMITTED: {
    label: "Submitted",
    tone: "border-sky-300 bg-sky-50 text-sky-900",
    dot: "bg-sky-600",
  },
  UNDER_SCRUTINY: {
    label: "Under Scrutiny",
    tone: "border-navy-300 bg-navy-50 text-navy-900",
    dot: "bg-navy-700",
  },
  DEFICIENCY_REVERTED: {
    label: "Deficiency Reverted",
    tone: "border-red-300 bg-red-50 text-red-900",
    dot: "bg-red-600",
  },
  RE_SCRUTINY: {
    label: "Re-Scrutiny Pending",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
  SCRUTINY_CLEARED: {
    label: "Scrutiny Cleared",
    tone: "border-teal-300 bg-teal-50 text-teal-900",
    dot: "bg-teal-600",
  },
  EVC_SCHEDULED: {
    label: "EVC Scheduled",
    tone: "border-indigo-300 bg-indigo-50 text-indigo-900",
    dot: "bg-indigo-600",
  },
  EVC_COMPLETED: {
    label: "EVC Completed",
    tone: "border-cyan-300 bg-cyan-50 text-cyan-900",
    dot: "bg-cyan-600",
  },
  SAC_REVIEW: {
    label: "SAC Review",
    tone: "border-violet-300 bg-violet-50 text-violet-900",
    dot: "bg-violet-600",
  },
  SHC_REVIEW: {
    label: "SHC Review",
    tone: "border-purple-300 bg-purple-50 text-purple-900",
    dot: "bg-purple-600",
  },
  APPROVED: {
    label: "Approved",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
    dot: "bg-emerald-600",
  },
  REJECTED: {
    label: "Rejected",
    tone: "border-slate-400 bg-slate-100 text-slate-800",
    dot: "bg-slate-600",
  },
};

export function statusMeta(status: string) {
  return (
    STATUS_META[status as ApplicationStatus] ?? {
      label: status.replaceAll("_", " "),
      tone: "border-slate-300 bg-slate-50 text-slate-700",
      dot: "bg-slate-500",
    }
  );
}

export const SLA_STATUSES = ["ON_TRACK", "WARNING", "BREACHED"] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

export const SLA_META: Record<SlaStatus, { label: string; tone: string; bar: string; dot: string }> = {
  ON_TRACK: {
    label: "On Track",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
    bar: "bg-emerald-600",
    dot: "bg-emerald-600",
  },
  WARNING: {
    label: "Approaching Limit",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  BREACHED: {
    label: "SLA Breached",
    tone: "border-red-300 bg-red-50 text-red-900",
    bar: "bg-red-600",
    dot: "bg-red-600",
  },
};

export function slaMeta(status: string) {
  return SLA_META[status as SlaStatus] ?? SLA_META.ON_TRACK;
}

export const DOC_TYPES = [
  "LEASE_DEED",
  "FIRE_SAFETY",
  "BUILDING_PLAN",
  "UNDERTAKING",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  LEASE_DEED: "Land Lease Deed",
  FIRE_SAFETY: "Fire Safety Certificate",
  BUILDING_PLAN: "Approved Building Plan",
  UNDERTAKING: "Statutory Undertaking",
};

export const DOC_STATUSES = ["VALID", "EXPIRING_SOON", "EXPIRED", "PENDING_RENEWAL"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_STATUS_META: Record<DocStatus, { label: string; tone: string }> = {
  VALID: {
    label: "Valid",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  EXPIRING_SOON: {
    label: "Expiring Soon",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
  },
  EXPIRED: {
    label: "Expired",
    tone: "border-red-300 bg-red-50 text-red-900",
  },
  PENDING_RENEWAL: {
    label: "Pending Renewal",
    tone: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

export function docMeta(status: string) {
  return DOC_STATUS_META[status as DocStatus] ?? DOC_STATUS_META.PENDING_RENEWAL;
}

export const RULE_STATUSES = ["PASSED", "DEFICIENCY_FLAGGED"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const DEFICIENCY_STATUSES = ["OPEN", "RESUBMITTED", "RESOLVED"] as const;
export type DeficiencyStatus = (typeof DEFICIENCY_STATUSES)[number];

export const DEFICIENCY_STATUS_META: Record<
  DeficiencyStatus,
  { label: string; tone: string }
> = {
  OPEN: { label: "Action Required", tone: "border-red-300 bg-red-50 text-red-900" },
  RESUBMITTED: { label: "Resubmitted", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  RESOLVED: { label: "Resolved", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
};

export const EVC_REPORT_STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "Report Pending", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  COMPLETED: { label: "Report Filed", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  OVERDUE: { label: "Report Overdue", tone: "border-red-300 bg-red-50 text-red-900" },
};

export const ESCALATION_STATUS_META: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Open", tone: "border-red-300 bg-red-50 text-red-900" },
  ACKNOWLEDGED: { label: "Acknowledged", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  RESOLVED: { label: "Resolved", tone: "border-emerald-300 bg-emerald-50 text-emerald-900" },
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  APPLICATION_SUBMITTED: "Application submitted",
  SCRUTINY_COMMENCED: "Scrutiny commenced",
  APH_EVALUATION_RUN: "APH rule evaluation executed",
  DEFICIENCY_ISSUED: "Formal deficiency notice issued",
  DEFICIENCY_RESUBMITTED: "Deficiency evidence resubmitted",
  DEFICIENCY_RESOLVED: "Deficiency accepted and resolved",
  SCRUTINY_CLEARED: "Scrutiny cleared",
  EVC_SCHEDULED: "EVC inspection scheduled",
  SITE_REPORT_SUBMITTED: "EVC site report filed",
  APPLICATION_APPROVED: "Application approved",
  APPLICATION_REJECTED: "Application rejected",
  SLA_ESCALATION_RAISED: "SLA escalation auto-raised",
  ESCALATION_ACKNOWLEDGED: "Escalation acknowledged",
  DOCUMENT_RENEWED: "Compliance document renewed",
  SLA_SWEEP_EXECUTED: "National SLA sweep executed",
  LEDGER_VERIFIED: "Audit ledger verified",
  APPLICATION_RESUBMITTED: "Application resubmitted",
  IDENTITY_CONTEXT_SWITCHED: "Impersonation context switched",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replaceAll("_", " ").toLowerCase();
}

export const CAPABILITIES = [
  "RUN_APH",
  "RAISE_DEFICIENCY",
  "RESUBMIT_DEFICIENCY",
  "ACCEPT_RESUBMISSION",
  "SCHEDULE_EVC",
  "SUBMIT_SITE_REPORT",
  "RENEW_DOCUMENT",
  "RUN_SLA_SWEEP",
  "ACK_ESCALATION",
  "DECIDE_APPLICATION",
  "ATTEST_LEDGER",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const CAPABILITY_MATRIX: Record<Capability, Role[]> = {
  RUN_APH: ["REGIONAL_OFFICER", "BUREAU_OFFICER"],
  RAISE_DEFICIENCY: ["REGIONAL_OFFICER"],
  RESUBMIT_DEFICIENCY: ["INSTITUTION_ADMIN"],
  ACCEPT_RESUBMISSION: ["REGIONAL_OFFICER"],
  SCHEDULE_EVC: ["REGIONAL_OFFICER", "BUREAU_OFFICER"],
  SUBMIT_SITE_REPORT: ["EVC_MEMBER"],
  RENEW_DOCUMENT: ["INSTITUTION_ADMIN"],
  RUN_SLA_SWEEP: ["REGIONAL_OFFICER", "BUREAU_OFFICER", "COMPLIANCE_HEAD"],
  ACK_ESCALATION: ["BUREAU_OFFICER", "COMPLIANCE_HEAD"],
  DECIDE_APPLICATION: ["BUREAU_OFFICER"],
  ATTEST_LEDGER: ["BUREAU_OFFICER", "COMPLIANCE_HEAD"],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITY_MATRIX[capability].includes(role);
}

export function capabilityRoles(capability: Capability): Role[] {
  return CAPABILITY_MATRIX[capability];
}

export const TERMINAL_STATUSES: string[] = ["APPROVED", "REJECTED"];
export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const ACTIVE_STATUSES: string[] = APPLICATION_STATUSES.filter(
  (status) => !isTerminal(status),
);

export type ActionResult = { ok: boolean; message: string };
