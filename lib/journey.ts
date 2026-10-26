export type JourneyNorm = {
  /** Why this step exists — the statutory or operational reason. */
  why: string;
  /** The platform guarantee this step demonstrates, as a short label. */
  guarantee: string;
};

/**
 * The reason each recorded transition exists. This is editorial explanation, not
 * data: every figure shown on the journey page still comes from the database.
 */
export const JOURNEY_NORMS: Record<string, JourneyNorm> = {
  APPLICATION_SUBMITTED: {
    why: "Every filing enters the register with the applicant's identity bound to the event, so no case exists without a named submitter.",
    guarantee: "Provenance",
  },
  APH_EVALUATION_RUN: {
    why: "The APH norm set is machine-checked against the declared institution record — faculty ratio, built-up area, lease tenure, fire safety, building plan and undertaking — so no two officers read the handbook differently.",
    guarantee: "Deterministic rule engine",
  },
  DEFICIENCY_ISSUED: {
    why: "A deficiency letter must name the exact rule, the remedy and the compliance window. A bare rejection is not a notice an institution can act on.",
    guarantee: "Reasoned notice",
  },
  DEFICIENCY_RESUBMITTED: {
    why: "The institution answers with evidence and the statutory clock keeps running while it does, so delay is visible rather than absorbed.",
    guarantee: "Two-way loop",
  },
  DEFICIENCY_RESOLVED: {
    why: "Only the regional officer can close a deficiency, and only after re-running the matrix against the new evidence.",
    guarantee: "Single accountable actor",
  },
  EVC_SCHEDULED: {
    why: "Committee members drawn from the applicant's own region or its affiliating university are rejected outright, instead of being screened from memory.",
    guarantee: "Conflict-of-interest screen",
  },
  SITE_REPORT_SUBMITTED: {
    why: "A site report is accepted only from inside the 750 m campus geofence, proved by Haversine distance from the coordinates the field device logged. A report cannot be filed from a desk.",
    guarantee: "Physical evidence",
  },
  APPLICATION_APPROVED: {
    why: "A final approval must record the deciding authority, the order number and the reason, so the outcome is defensible years later.",
    guarantee: "Reasoned order",
  },
  APPLICATION_REJECTED: {
    why: "A rejection carries the same reasoning standard as an approval: the authority, the order and the ground.",
    guarantee: "Reasoned order",
  },
  SLA_ESCALATION_RAISED: {
    why: "Crossing the 10-day statutory limit escalates the file to the Bureau automatically, with penalty points against the region and no human in the trigger path.",
    guarantee: "Objective clock",
  },
};

export const JOURNEY_NORM_FALLBACK: JourneyNorm = {
  why: "Every state change is bound to the actor identity and appended to the hash chain, so the sequence survives any later disagreement.",
  guarantee: "Auditability",
};

export function journeyNorm(action: string): JourneyNorm {
  return JOURNEY_NORMS[action] ?? JOURNEY_NORM_FALLBACK;
}

export const JOURNEY_ROLE_TONE: Record<string, string> = {
  INSTITUTION_ADMIN: "border-sky-300 bg-sky-50 text-sky-900",
  REGIONAL_OFFICER: "border-navy-300 bg-navy-50 text-navy-900",
  EVC_MEMBER: "border-indigo-300 bg-indigo-50 text-indigo-900",
  COMPLIANCE_HEAD: "border-emerald-300 bg-emerald-50 text-emerald-900",
  BUREAU_OFFICER: "border-violet-300 bg-violet-50 text-violet-900",
  SYSTEM: "border-slate-300 bg-slate-100 text-slate-700",
};

/** Case-workspace tab that holds the evidence for a given transition. */
const ACTION_TABS: Record<string, string> = {
  APH_EVALUATION_RUN: "aph",
  DEFICIENCY_ISSUED: "deficiency",
  DEFICIENCY_RESUBMITTED: "deficiency",
  DEFICIENCY_RESOLVED: "deficiency",
  EVC_SCHEDULED: "evc",
  SITE_REPORT_SUBMITTED: "evc",
  APPLICATION_APPROVED: "case",
  APPLICATION_REJECTED: "case",
};

export function journeyTabFor(action: string): string | null {
  return ACTION_TABS[action] ?? null;
}