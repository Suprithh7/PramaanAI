import { aphSummary, type AphInput, type AphRuleResult } from "./aph";
import { APPLICATION_TYPE_LABELS, type ApplicationType } from "./types";

export type BriefRisk = "CLEAR" | "ATTENTION" | "MATERIAL";

export type FilingBriefPayload = {
  headline: string;
  summary: string;
  riskLevel: BriefRisk;
  readinessScore: number;
  findings: Array<{ ruleCode: string; title: string; detail: string }>;
  strengths: string[];
  actions: string[];
  generatedAt: string;
};

export type FilingBriefResult = {
  payload: FilingBriefPayload;
  engine: "GROUNDED";
  model: null;
};

export type FilingBriefContext = {
  referenceNo: string;
  institutionName: string;
  programName: string;
  applicationType: string;
  studentIntake: number;
  facultyCount: number;
  builtUpAreaSqM: number;
  totalLandAcres: number;
  rules: AphRuleResult[];
};

export function buildBriefContext(
  app: {
    referenceNo: string;
    programName: string;
    applicationType: string;
    institution: { name: string };
  },
  input: AphInput,
  rules: AphRuleResult[],
): FilingBriefContext {
  return {
    referenceNo: app.referenceNo,
    institutionName: app.institution.name,
    programName: app.programName,
    applicationType: app.applicationType,
    studentIntake: input.institution.studentIntake,
    facultyCount: input.institution.facultyCount,
    builtUpAreaSqM: input.institution.builtUpAreaSqM,
    totalLandAcres: input.institution.totalLandAcres,
    rules,
  };
}

function typeLabel(value: string): string {
  return APPLICATION_TYPE_LABELS[value as ApplicationType] ?? value.replaceAll("_", " ");
}

function riskFor(flagged: number, score: number): BriefRisk {
  if (flagged === 0) return "CLEAR";
  return score >= 70 ? "ATTENTION" : "MATERIAL";
}

function inr(value: number): string {
  return value.toLocaleString("en-IN");
}

/**
 * Deterministic composer. Every sentence is derived from the evaluated rule
 * matrix, so the brief is reproducible and needs no external service.
 */
export function composeGroundedBrief(context: FilingBriefContext): FilingBriefPayload {
  const summary = aphSummary(context.rules);
  const flagged = context.rules.filter((rule) => rule.status !== "PASSED");
  const passed = context.rules.filter((rule) => rule.status === "PASSED");
  const riskLevel = riskFor(summary.flagged, summary.score);
  const ratio = context.facultyCount > 0 ? context.studentIntake / context.facultyCount : 0;
  const areaPerStudent =
    context.studentIntake > 0 ? context.builtUpAreaSqM / context.studentIntake : 0;

  const headline =
    riskLevel === "CLEAR"
      ? `Ready for review: all ${summary.total} rules pass on the declared figures`
      : riskLevel === "ATTENTION"
        ? `${summary.flagged} of ${summary.total} rules need a correction before approval`
        : `Not ready for review: ${summary.flagged} of ${summary.total} rules fail`;

  const profile = `${context.institutionName} declares ${inr(context.studentIntake)} students, ${inr(context.facultyCount)} full-time faculty and ${inr(context.builtUpAreaSqM)} sqm of built-up area for ${context.programName} (${typeLabel(context.applicationType)}). ${summary.passed} of ${summary.total} rules pass, with a faculty ratio of ${
    ratio > 0 ? `1:${ratio.toFixed(2)}` : "not computable"
  } and ${areaPerStudent.toFixed(2)} sqm per student.`;

  const outcome =
    riskLevel === "CLEAR"
      ? "No deficiency is expected, so the file can move to officer review without a notice."
      : `Fix the failing ${flagged.length === 1 ? "rule" : "rules"} (${flagged
          .map((rule) => rule.ruleCode)
          .join(", ")}) before the deadline forces a formal deficiency notice.`;

  return {
    headline,
    summary: `${profile} ${outcome}`,
    riskLevel,
    readinessScore: summary.score,
    findings: flagged.map((rule) => ({
      ruleCode: rule.ruleCode,
      title: rule.ruleName,
      detail: `Declared ${rule.submittedValue}; the rule requires ${rule.requiredValue}.`,
    })),
    strengths: passed.map(
      (rule) => `${rule.ruleCode} ${rule.ruleName} — ${rule.submittedValue}`,
    ),
    actions:
      flagged.length > 0
        ? flagged.map((rule) => `${rule.ruleCode}: ${rule.remarks}`)
        : ["Send the file to officer review. The 10-day review clock now starts."],
    generatedAt: new Date().toISOString(),
  };
}

export async function generateFilingBrief(
  context: FilingBriefContext,
): Promise<FilingBriefResult> {
  return { payload: composeGroundedBrief(context), engine: "GROUNDED", model: null };
}

export function parseFilingBrief(raw: string): FilingBriefPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<FilingBriefPayload>;
    if (typeof parsed.headline !== "string" || typeof parsed.summary !== "string") return null;
    if (!Array.isArray(parsed.findings) || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.actions)) {
      return null;
    }
    return {
      headline: parsed.headline,
      summary: parsed.summary,
      riskLevel:
        parsed.riskLevel === "CLEAR" || parsed.riskLevel === "ATTENTION" || parsed.riskLevel === "MATERIAL"
          ? parsed.riskLevel
          : "ATTENTION",
      readinessScore: typeof parsed.readinessScore === "number" ? parsed.readinessScore : 0,
      findings: parsed.findings.filter(
        (item): item is FilingBriefPayload["findings"][number] =>
          !!item &&
          typeof item.ruleCode === "string" &&
          typeof item.title === "string" &&
          typeof item.detail === "string",
      ),
      strengths: parsed.strengths.filter((item): item is string => typeof item === "string"),
      actions: parsed.actions.filter((item): item is string => typeof item === "string"),
      generatedAt:
        typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
