import { aphSummary, type AphInput, type AphRuleResult } from "./aph";
import { generateGeminiFilingBrief } from "./gemini";
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
  engine: "LLM" | "GROUNDED";
  model: string | null;
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

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const LLM_TIMEOUT_MS = 12_000;

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
 * matrix, so the brief is accurate even when no model endpoint is configured.
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
      ? `Scrutiny-ready: all ${summary.total} APH rules clear on the declared figures`
      : riskLevel === "ATTENTION"
        ? `${summary.flagged} of ${summary.total} APH rules need correction before clearance`
        : `Filing is not scrutiny-ready: ${summary.flagged} of ${summary.total} APH rules flagged`;

  const profile = `${context.institutionName} declares ${inr(context.studentIntake)} students, ${inr(context.facultyCount)} full-time faculty and ${inr(context.builtUpAreaSqM)} sqm of built-up area for ${context.programName} (${typeLabel(context.applicationType)}). The APH engine cleared ${summary.passed} of ${summary.total} rules at filing, with a faculty ratio of ${
    ratio > 0 ? `1:${ratio.toFixed(2)}` : "not computable"
  } and ${areaPerStudent.toFixed(2)} sqm per student.`;

  const outcome =
    riskLevel === "CLEAR"
      ? "No deficiency is projected, so the case can pass to desk scrutiny without a notice."
      : `Correct the flagged ${flagged.length === 1 ? "rule" : "rules"} (${flagged
          .map((rule) => rule.ruleCode)
          .join(", ")}) before the statutory clock forces a formal deficiency.`;

  return {
    headline,
    summary: `${profile} ${outcome}`,
    riskLevel,
    readinessScore: summary.score,
    findings: flagged.map((rule) => ({
      ruleCode: rule.ruleCode,
      title: rule.ruleName,
      detail: `Observed ${rule.submittedValue}; the threshold is ${rule.requiredValue}.`,
    })),
    strengths: passed.map(
      (rule) => `${rule.ruleCode} ${rule.ruleName} — ${rule.submittedValue}`,
    ),
    actions:
      flagged.length > 0
        ? flagged.map((rule) => `${rule.ruleCode}: ${rule.remarks}`)
        : ["Proceed to desk scrutiny; the 10-day statutory clock governs clearance."],
    generatedAt: new Date().toISOString(),
  };
}

function aiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: process.env.AI_MODEL ?? DEFAULT_MODEL,
  };
}

function llmFacts(context: FilingBriefContext) {
  const summary = aphSummary(context.rules);
  return {
    referenceNo: context.referenceNo,
    institution: context.institutionName,
    programme: context.programName,
    applicationType: typeLabel(context.applicationType),
    declared: {
      students: context.studentIntake,
      fullTimeFaculty: context.facultyCount,
      builtUpAreaSqM: context.builtUpAreaSqM,
      campusLandAcres: context.totalLandAcres,
    },
    derived: {
      facultyStudentRatio:
        context.facultyCount > 0
          ? `1:${(context.studentIntake / context.facultyCount).toFixed(2)}`
          : "not computable",
      builtUpAreaPerStudent:
        context.studentIntake > 0
          ? `${(context.builtUpAreaSqM / context.studentIntake).toFixed(2)} sqm`
          : "not computable",
    },
    score: summary.score,
    passed: summary.passed,
    flagged: summary.flagged,
    rules: context.rules.map((rule) => ({
      code: rule.ruleCode,
      name: rule.ruleName,
      threshold: rule.requiredValue,
      observed: rule.submittedValue,
      status: rule.status,
      guidance: rule.remarks,
    })),
  };
}

type LlmDraft = {
  headline: unknown;
  summary: unknown;
  findings: unknown;
  strengths: unknown;
  actions: unknown;
};

function asStringList(value: unknown, limit: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
  if (strings.length !== value.length) return null;
  return strings.slice(0, limit);
}

/**
 * Accepts model narrative only when it stays inside the evaluated matrix:
 * every finding must cite a flagged rule, and every flagged rule must appear.
 */
function acceptDraft(draft: LlmDraft, context: FilingBriefContext): FilingBriefPayload | null {
  const flagged = context.rules.filter((rule) => rule.status !== "PASSED");
  const summary = aphSummary(context.rules);
  if (typeof draft.headline !== "string" || draft.headline.trim().length < 8) return null;
  if (typeof draft.summary !== "string" || draft.summary.trim().length < 40) return null;
  if (!Array.isArray(draft.findings)) return null;

  const findings: FilingBriefPayload["findings"] = [];
  for (const item of draft.findings) {
    if (!item || typeof item !== "object") return null;
    const { ruleCode, title, detail } = item as Record<string, unknown>;
    if (typeof ruleCode !== "string" || typeof detail !== "string") return null;
    const rule = flagged.find((candidate) => candidate.ruleCode === ruleCode);
    if (!rule) return null;
    findings.push({
      ruleCode: rule.ruleCode,
      title: typeof title === "string" && title.trim() ? title.trim() : rule.ruleName,
      detail: detail.trim(),
    });
  }
  if (findings.length !== flagged.length) return null;

  const strengths = asStringList(draft.strengths, 12);
  const actions = asStringList(draft.actions, 12);
  if (!strengths || !actions) return null;
  if (strengths.length !== summary.passed) return null;
  if (flagged.length > 0 && actions.length === 0) return null;

  return {
    headline: draft.headline.trim().slice(0, 180),
    summary: draft.summary.trim().slice(0, 1200),
    riskLevel: riskFor(summary.flagged, summary.score),
    readinessScore: summary.score,
    findings,
    strengths,
    actions,
    generatedAt: new Date().toISOString(),
  };
}

function stripFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

async function tryLlmBrief(
  context: FilingBriefContext,
  config: { apiKey: string; baseUrl: string; model: string },
): Promise<FilingBriefPayload | null> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write the statutory scrutiny brief for PRAMAAN, AICTE's Approval Process Handbook system. " +
            "Use ONLY the FACTS JSON. Never invent figures, dates, rules, documents or outcomes. " +
            "Return one JSON object with exactly these keys: " +
            '{"headline": string (max 140 chars), "summary": string (2-3 sentences, max 90 words), ' +
            '"findings": [{"ruleCode": string, "title": string, "detail": string}] (one per flagged rule, empty if none), ' +
            '"strengths": string[] (one per passed rule), "actions": string[] (concrete corrective steps)}. ' +
            "Cite the exact observed and threshold values in findings. Indian English, no markdown, no extra keys.",
        },
        { role: "user", content: `FACTS\n${JSON.stringify(llmFacts(context))}` },
      ],
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(content));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  return acceptDraft(parsed as LlmDraft, context);
}

/**
 * Generates the filing brief. Uses Google Gemini 3 Flash first;
 * falls back to configured OpenAI endpoint, then deterministic grounded composer.
 */
export async function generateFilingBrief(context: FilingBriefContext): Promise<FilingBriefResult> {
  try {
    const geminiResult = await generateGeminiFilingBrief(context);
    if (geminiResult) {
      return { payload: geminiResult.payload, engine: "LLM", model: geminiResult.model };
    }
  } catch {
    // fall through
  }

  const config = aiConfig();
  if (config) {
    try {
      const payload = await tryLlmBrief(context, config);
      if (payload) return { payload, engine: "LLM", model: config.model };
    } catch {
      // Network, timeout or malformed output: fall through to the grounded composer.
    }
  }
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
