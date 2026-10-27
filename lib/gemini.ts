import type { FilingBriefContext, FilingBriefPayload } from "./ai";
import { aphSummary } from "./aph";
import { APPLICATION_TYPE_LABELS, type ApplicationType } from "./types";

const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.8-flash",
] as const;

export function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ??
    process.env.AI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "AIzaSyAaq6jGXbeN18DT0yS8zQTXrPNlVKw8mg4"
  );
}

export type GeminiRequestOptions = {
  prompt: string;
  systemPrompt?: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
  timeoutMs?: number;
};

/**
 * Universal Gemini API caller with automatic fallback across models.
 */
export async function invokeGemini(options: GeminiRequestOptions): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const timeoutMs = options.timeoutMs ?? 18_000;
  const temperature = options.temperature ?? 0.2;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const contents: Array<{ role?: string; parts: Array<{ text: string }> }> = [];

      const body: Record<string, unknown> = {
        contents: [
          {
            parts: [{ text: options.prompt }],
          },
        ],
        generationConfig: {
          temperature,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        },
      };

      if (options.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: options.systemPrompt }],
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof candidateText === "string" && candidateText.trim().length > 0) {
        return candidateText.trim();
      }
    } catch {
      // Continue to next fallback model
    }
  }

  return null;
}

export function cleanJsonFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

/**
 * Generates an executive statutory filing brief for AICTE approval scrutiny.
 */
export async function generateGeminiFilingBrief(
  context: FilingBriefContext,
): Promise<{ payload: FilingBriefPayload; model: string } | null> {
  const summary = aphSummary(context.rules);
  const flagged = context.rules.filter((r) => r.status !== "PASSED");
  const passed = context.rules.filter((r) => r.status === "PASSED");

  const ratio = context.facultyCount > 0 ? (context.studentIntake / context.facultyCount).toFixed(2) : "N/A";
  const areaPerStudent = context.studentIntake > 0 ? (context.builtUpAreaSqM / context.studentIntake).toFixed(2) : "N/A";

  const systemPrompt = `You are the Chief Scrutiny Legal Officer for AICTE (All India Council for Technical Education) under the Approval Process Handbook (APH 2026-27).
Write an authoritative, legally grounded scrutiny brief based STRICTLY on the facts.
Never hallucinate dates, rules, or figures. Cite exact observed and threshold values.
Language: Formal Indian English (Government of India standard).

Respond ONLY with valid JSON having this exact schema:
{
  "headline": string (max 140 chars, executive finding),
  "summary": string (2-3 sentences summarizing institutional capacity, compliance posture, and scrutiny recommendation),
  "riskLevel": "CLEAR" | "ATTENTION" | "MATERIAL",
  "readinessScore": number (0-100),
  "findings": [
    {
      "ruleCode": string (e.g. APH-101),
      "title": string,
      "detail": string
    }
  ],
  "strengths": string[] (one brief bullet per passed rule),
  "actions": string[] (concrete, actionable next steps for regional officer and applicant)
}`;

  const prompt = `EVALUATION FACTS FOR INSTITUTION SCRUTINY:
- Institution Name: ${context.institutionName}
- Application Ref: ${context.referenceNo}
- Programme: ${context.programName}
- Application Type: ${APPLICATION_TYPE_LABELS[context.applicationType as ApplicationType] ?? context.applicationType}
- Sanctioned Intake Declared: ${context.studentIntake.toLocaleString("en-IN")} students
- Full-Time Faculty Declared: ${context.facultyCount.toLocaleString("en-IN")} faculty (Ratio 1:${ratio})
- Built-Up Area: ${context.builtUpAreaSqM.toLocaleString("en-IN")} sqm (${areaPerStudent} sqm/student)
- Land Parcel: ${context.totalLandAcres.toFixed(2)} acres
- Overall APH Score: ${summary.score}% (${summary.passed}/${summary.total} rules satisfied)
- Flagged Deficiencies (${flagged.length}):
${flagged.map((f) => `  * [${f.ruleCode}] ${f.ruleName}: Submitted "${f.submittedValue}", Required "${f.requiredValue}". Remarks: ${f.remarks}`).join("\n")}
- Passed Rules (${passed.length}):
${passed.map((p) => `  * [${p.ruleCode}] ${p.ruleName}: ${p.submittedValue}`).join("\n")}
`;

  const output = await invokeGemini({
    systemPrompt,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.15,
  });

  if (!output) return null;

  try {
    const parsed = JSON.parse(cleanJsonFence(output)) as Partial<FilingBriefPayload>;
    if (
      typeof parsed.headline === "string" &&
      typeof parsed.summary === "string" &&
      Array.isArray(parsed.findings) &&
      Array.isArray(parsed.strengths) &&
      Array.isArray(parsed.actions)
    ) {
      const riskLevel =
        flagged.length === 0
          ? "CLEAR"
          : summary.score >= 70
            ? "ATTENTION"
            : "MATERIAL";

      return {
        payload: {
          headline: parsed.headline.slice(0, 180),
          summary: parsed.summary.slice(0, 1200),
          riskLevel,
          readinessScore: summary.score,
          findings: parsed.findings.map((f) => ({
            ruleCode: f.ruleCode || "APH-FLAG",
            title: f.title || "Statutory Deviation",
            detail: f.detail || "Threshold not satisfied.",
          })),
          strengths: parsed.strengths.filter((s): s is string => typeof s === "string"),
          actions: parsed.actions.filter((a): a is string => typeof a === "string"),
          generatedAt: new Date().toISOString(),
        },
        model: "gemini-3-flash-preview",
      };
    }
  } catch {
    // parse failure
  }

  return null;
}

export type GeminiDocumentAnalysis = {
  documentTypeDetected: string;
  confidence: number;
  institutionNamed: string | null;
  extractedFields: {
    institutionName?: string;
    landAcres?: number;
    builtUpAreaSqM?: number;
    facultyCount?: number;
    intake?: number;
    leaseYears?: number;
    expiryDate?: string;
    registrationOrRefNo?: string;
    issuingAuthority?: string;
  };
  forensicAudit: {
    authenticityScore: number; // 0 to 100
    integrityRating: "VERIFIED" | "SUSPICIOUS" | "TAMPER_SUSPECTED";
    sealDetected: boolean;
    signatureDetected: boolean;
    dateConsistencyCheck: boolean;
    tamperFlags: string[];
    officialSummary: string;
  };
  aphComplianceRemarks: string;
};

/**
 * Deep Multi-Modal / Forensic Document Scrutiny using Gemini.
 * Extracts statutory parameters, validates issuing authority, checks tamper indicators.
 */
export async function analyzeDocumentWithGemini(params: {
  fileName: string;
  docType: string;
  rawText: string;
  institutionName: string;
}): Promise<GeminiDocumentAnalysis | null> {
  const systemPrompt = `You are AICTE's National Forensic Evidence Scrutiny AI.
Your role is to scrutinize statutory legal annexures submitted by technical colleges (Land Sale Deeds, Registered Lease Deeds, Fire Safety NOCs, Approved Building Plans, Structural Stability Certificates).
You must extract all numerical parameters and detect any signs of document tampering, forged text, mismatched institution names, expired certifications, or fraudulent reuse.

Return ONLY a valid JSON object matching this schema:
{
  "documentTypeDetected": string (e.g. "LEASE_DEED", "FIRE_SAFETY", "BUILDING_PLAN", "UNDERTAKING", "OTHER"),
  "confidence": number (between 0.0 and 1.0),
  "institutionNamed": string or null,
  "extractedFields": {
    "institutionName": string,
    "landAcres": number or null,
    "builtUpAreaSqM": number or null,
    "facultyCount": number or null,
    "intake": number or null,
    "leaseYears": number or null,
    "expiryDate": "YYYY-MM-DD" or null,
    "registrationOrRefNo": string or null,
    "issuingAuthority": string or null
  },
  "forensicAudit": {
    "authenticityScore": number (0 to 100),
    "integrityRating": "VERIFIED" | "SUSPICIOUS" | "TAMPER_SUSPECTED",
    "sealDetected": boolean,
    "signatureDetected": boolean,
    "dateConsistencyCheck": boolean,
    "tamperFlags": string[],
    "officialSummary": string
  },
  "aphComplianceRemarks": string
}`;

  const prompt = `SCRUTINIZE STATUTORY ANNEXURE:
File Name: ${params.fileName}
Declared Category: ${params.docType}
Applicant Institution Name: ${params.institutionName}

Document Raw Text Content:
---
${params.rawText.slice(0, 7000)}
---

Perform deep forensic analysis, extract exact metrics, verify dates, and check whether this document authentically belongs to "${params.institutionName}".`;

  const output = await invokeGemini({
    systemPrompt,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.1,
  });

  if (!output) return null;

  try {
    const parsed = JSON.parse(cleanJsonFence(output)) as GeminiDocumentAnalysis;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Generates an official, legally enforceable Deficiency Notice under AICTE Act Sec 10.
 */
export async function generateAicteDeficiencyNotice(params: {
  referenceNo: string;
  institutionName: string;
  programName: string;
  flaggedRules: Array<{ ruleCode: string; ruleName: string; submittedValue: string; requiredValue: string; remarks: string }>;
  admissions: number;
  facultyCount: number;
}): Promise<{ noticeText: string; clausesCited: string[]; recommendedCureDays: number } | null> {
  const systemPrompt = `You are the Regional Director at AICTE (All India Council for Technical Education), Ministry of Education, Government of India.
Draft a formal Statutory Deficiency Notice in strict accordance with the AICTE Approval Process Handbook (APH 2026-27) and AICTE Act 1987.
The notice must be firm, legally precise, non-adversarial, and state the exact cure directives and evidence to be submitted.

Respond ONLY with valid JSON:
{
  "noticeText": string (the complete formal notice statement formatted with clear numbered paragraphs and statutory clauses),
  "clausesCited": string[],
  "recommendedCureDays": number (typically 7, 10, or 14 days)
}`;

  const prompt = `DRAFT STATUTORY DEFICIENCY NOTICE:
Application Ref No: ${params.referenceNo}
Institution: ${params.institutionName}
Programme: ${params.programName}
Sanctioned Student Strength: ${params.admissions}
Declared Full-Time Faculty: ${params.facultyCount}

Flagged Deficiencies:
${params.flaggedRules.map((r, i) => `${i + 1}. [${r.ruleCode}] ${r.ruleName}: Submitted figure ${r.submittedValue} fails the statutory threshold of ${r.requiredValue}. Reason: ${r.remarks}`).join("\n")}
`;

  const output = await invokeGemini({
    systemPrompt,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.15,
  });

  if (!output) return null;

  try {
    return JSON.parse(cleanJsonFence(output));
  } catch {
    return null;
  }
}

/**
 * Generates an institutional compliance and remediation roadmap for the applicant.
 */
export async function generateAicteRemediationRoadmap(params: {
  referenceNo: string;
  institutionName: string;
  programName: string;
  flaggedRules: Array<{ ruleCode: string; ruleName: string; submittedValue: string; requiredValue: string; remarks: string }>;
  admissions: number;
  facultyCount: number;
  builtUpArea: number;
}): Promise<{
  executiveGuidance: string;
  roadmapSteps: Array<{ priority: "IMMEDIATE" | "HIGH" | "MEDIUM"; action: string; legalNorm: string; expectedTimeline: string }>;
  projectedOutcome: string;
} | null> {
  const systemPrompt = `You are AICTE's Senior Compliance & Institutional Advisory Expert.
Provide a high-level, practical Compliance & Rectification Roadmap for an engineering/technical college facing statutory deficiencies.
Focus on lawful compliance through AICTE regulations (e.g. recruiting adjunct/emeritus professors per AICTE norms, executing supplemental lease deeds, town planning sanctioned plan updates).

Respond ONLY with valid JSON:
{
  "executiveGuidance": string,
  "roadmapSteps": [
    {
      "priority": "IMMEDIATE" | "HIGH" | "MEDIUM",
      "action": string,
      "legalNorm": string,
      "expectedTimeline": string
    }
  ],
  "projectedOutcome": string
}`;

  const prompt = `CREATE REMEDIATION ROADMAP:
Institution: ${params.institutionName}
Application: ${params.referenceNo}
Programme: ${params.programName}
Intake: ${params.admissions} students
Faculty: ${params.facultyCount}
Built-up Area: ${params.builtUpArea} sqm

Current Non-Compliances:
${params.flaggedRules.map((r) => `- [${r.ruleCode}] ${r.ruleName}: Observed ${r.submittedValue} vs Threshold ${r.requiredValue}`).join("\n")}
`;

  const output = await invokeGemini({
    systemPrompt,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.2,
  });

  if (!output) return null;

  try {
    return JSON.parse(cleanJsonFence(output));
  } catch {
    return null;
  }
}

/**
 * Evaluates an EVC (Expert Visit Committee) Site Inspection Report against submitted plans.
 */
export async function evaluateEvcInspectionWithGemini(params: {
  committeeLead: string;
  institutionName: string;
  declaredIntake: number;
  declaredFaculty: number;
  declaredBuiltUpSqM: number;
  geofenceDistanceM: number;
  siteObservations: string;
}): Promise<{
  recommendation: "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED";
  confidenceScore: number;
  keyFindings: string[];
  discrepanciesObserved: string[];
  reasonedOrderDraft: string;
} | null> {
  const systemPrompt = `You are the Expert Scrutiny Assessor at AICTE Head Office.
Evaluate the on-site physical inspection findings submitted by the Expert Visit Committee (EVC).
Analyze whether the committee observations support the declared capacity, identify infrastructure shortfalls or phantom faculty, and provide an unbiased recommendation.

Respond ONLY with valid JSON:
{
  "recommendation": "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED",
  "confidenceScore": number (0 to 100),
  "keyFindings": string[],
  "discrepanciesObserved": string[],
  "reasonedOrderDraft": string
}`;

  const prompt = `EVC INSPECTION DATA:
Institution: ${params.institutionName}
Committee Lead: ${params.committeeLead}
Geofence Distance at Submission: ${params.geofenceDistanceM} meters
Declared Figures:
- Student Intake: ${params.declaredIntake}
- Full-Time Faculty: ${params.declaredFaculty}
- Built-Up Area: ${params.declaredBuiltUpSqM} sqm

Field Observations Filed by Committee:
"${params.siteObservations}"
`;

  const output = await invokeGemini({
    systemPrompt,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.15,
  });

  if (!output) return null;

  try {
    return JSON.parse(cleanJsonFence(output));
  } catch {
    return null;
  }
}

/**
 * AICTE APH Interactive Copilot & Handbook Knowledge Engine.
 */
export async function askAicteHandbookCopilot(params: {
  question: string;
  context?: {
    institutionName?: string;
    referenceNo?: string;
    programName?: string;
    studentIntake?: number;
    facultyCount?: number;
    builtUpAreaSqM?: number;
    totalLandAcres?: number;
    role?: string;
  };
}): Promise<{
  answer: string;
  citations: string[];
  suggestedFollowUps: string[];
}> {
  const systemPrompt = `You are "AICTE PramaanAI Copilot" — the official AI regulatory and scrutiny intelligence assistant for the All India Council for Technical Education (AICTE), Ministry of Education, Government of India.
You have expert, deep knowledge of the AICTE Approval Process Handbook (APH 2026-27), AICTE Regulations, National Education Policy (NEP 2020), Faculty-Student Ratio norms (1:15 for UG Engineering, 1:20 for Management/Polytechnic), Cadre ratio (1:2:6), Land norms (Rural vs Urban vs Mega Cities), and EVC inspection procedures.

Provide authoritative, concise, and structured answers in Indian English.
Always cite the relevant APH Chapter, Norm or Table (e.g., APH Chapter I Clause 1.4, Table 2.1, Appendix 4).

Respond ONLY with valid JSON:
{
  "answer": string (markdown formatted, highly professional),
  "citations": string[],
  "suggestedFollowUps": string[]
}`;

  const contextStr = params.context
    ? `CURRENT CONTEXT:
- Role: ${params.context.role ?? "Officer"}
- Institution: ${params.context.institutionName ?? "Technical Institution"}
- Application Ref: ${params.context.referenceNo ?? "General Query"}
- Programme: ${params.context.programName ?? "Engineering & Technology"}
- Declared Intake: ${params.context.studentIntake ?? "N/A"}
- Declared Faculty: ${params.context.facultyCount ?? "N/A"}
- Built-up Area: ${params.context.builtUpAreaSqM ?? "N/A"} sqm
- Land: ${params.context.totalLandAcres ?? "N/A"} acres`
    : "GENERAL INQUIRY";

  const prompt = `${contextStr}

USER QUESTION:
${params.question}`;

  const output = await invokeGemini({
    systemPrompt,
    prompt,
    responseMimeType: "application/json",
    temperature: 0.2,
  });

  if (output) {
    try {
      return JSON.parse(cleanJsonFence(output));
    } catch {
      // fallback
    }
  }

  return {
    answer:
      "Under the AICTE Approval Process Handbook (APH 2026–27), institutions must maintain compliance with statutory norms including Faculty-Student Ratio (≤ 1:15), minimum built-up area (≥ 10 sqm/student), and unencumbered 30-year land lease tenure. Please check the specific regulation clauses in Chapter II for Extension of Approval (EoA).",
    citations: ["AICTE APH 2026-27 Chapter II", "AICTE Act 1987 Section 10"],
    suggestedFollowUps: [
      "What are the cadre ratio norms for Professor, Associate Professor and Assistant Professor?",
      "What documents are mandatory for an Extension of Approval (EoA) filing?",
      "What is the penalty if an institution exceeds sanctioned student intake?",
    ],
  };
}
