// Pure, dependency-free text classifier core shared by the trainer and the runtime.
// Multinomial Naive Bayes over unigrams + bigrams, trained on the statutory
// annexure corpus in scripts/train-doc-classifier.ts.

export type DocClassifierModel = {
  version: string;
  trainedAt: string;
  classes: string[];
  vocabSize: number;
  examples: number;
  logPrior: Record<string, number>;
  unknown: Record<string, number>;
  logLikelihood: Record<string, Record<string, number>>;
};

export type Classification = {
  type: string;
  confidence: number;
  needsReview: boolean;
  scores: Array<{ type: string; probability: number }>;
  drivers: Array<{ token: string; weight: number }>;
  runnerUp: { type: string; probability: number } | null;
};

const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/\bsquare\s+(?:metres?|meters?)\b/g, "sqm"],
  [/\bsq\.?\s*(?:mtr|met(?:er|re)s?|m)\b/g, "sqm"],
  [/\bm(?:2|²)\b/g, "sqm"],
  [/\bsq\.?\s*ft\b|\bsquare\s+feet\b|\bsqft\b/g, "sqft"],
  [/\bacres?\b/g, "acre"],
  [/\bhectares?\b|\bha\b/g, "hectare"],
  [/\bno\s+objection\s+certificate\b/g, "noc"],
  [/\byears?\b/g, "year"],
  [/\bfloors?\b/g, "floor"],
  [/\bmetres?\b|\bmeters?\b/g, "meter"],
];

function normalizeUnits(text: string): string {
  let next = text.toLowerCase();
  for (const [pattern, replacement] of UNIT_ALIASES) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "shall", "will", "are", "was",
  "has", "have", "been", "under", "into", "upon", "such", "any", "all", "its", "their",
  "hereby", "herein", "thereof", "which", "who", "may", "not", "per", "dated", "day",
]);

export function tokenize(text: string): string[] {
  const raw = normalizeUnits(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens: string[] = [];
  for (const word of raw) {
    if (word.length >= 3 && word.length <= 24 && !STOP.has(word)) tokens.push(word);
  }
  for (let i = 0; i < raw.length - 1; i += 1) {
    const a = raw[i];
    const b = raw[i + 1];
    if (a.length >= 3 && b.length >= 3 && !STOP.has(a) && !STOP.has(b)) {
      tokens.push(`${a}_${b}`);
    }
  }
  return tokens;
}

const TEMPERATURE = 0.4;

export function predict(model: DocClassifierModel, text: string): Classification {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { type: "OTHER", confidence: 0, needsReview: true, scores: [], drivers: [], runnerUp: null };
  }

  const scores = model.classes.map((cls) => {
    let score = model.logPrior[cls] ?? -12;
    const likelihoods = model.logLikelihood[cls] ?? {};
    const unknown = model.unknown[cls] ?? -12;
    for (const token of tokens) {
      score += likelihoods[token] ?? unknown;
    }
    return { type: cls, score: score * TEMPERATURE };
  });

  const max = Math.max(...scores.map((entry) => entry.score));
  const exps = scores.map((entry) => Math.exp(entry.score - max));
  const sum = exps.reduce((acc, value) => acc + value, 0);
  const ranked = scores
    .map((entry, index) => ({ type: entry.type, probability: exps[index] / sum }))
    .sort((a, b) => b.probability - a.probability);

  const domainHits = tokens.filter(
    (token) =>
      model.classes.some((cls) => model.logLikelihood[cls]?.[token] !== undefined),
  ).length;
  const coverage = domainHits / tokens.length;

  const top = ranked[0];
  const second = ranked[1];
  const runnerUp = second ? { type: second.type, probability: Number(second.probability.toFixed(3)) } : null;
  const margin = top.probability - (second?.probability ?? 0);

  // Unrelated uploads should not be forced into a statutory class.
  if (coverage < 0.04 || top.type === "OTHER" || top.probability < 0.34) {
    return {
      type: "OTHER",
      confidence: Number(Math.min(0.45, 0.18 + coverage).toFixed(3)),
      needsReview: true,
      scores: ranked,
      drivers: [],
      runnerUp,
    };
  }

  const drivers = explainTokens(model, tokens, top.type);
  const confidence = Math.min(0.98, top.probability * (0.72 + Math.min(1, margin * 2.5) * 0.28));
  return {
    type: top.type,
    confidence: Number(confidence.toFixed(3)),
    needsReview: confidence < 0.6 || margin < 0.15 || coverage < 0.08,
    scores: ranked,
    drivers,
    runnerUp,
  };
}

function explainTokens(
  model: DocClassifierModel,
  tokens: string[],
  topType: string,
): Array<{ token: string; weight: number }> {
  const own = model.logLikelihood[topType] ?? {};
  const others = model.classes.filter((cls) => cls !== topType);
  const seen = new Set<string>();
  const contributions: Array<{ token: string; weight: number }> = [];

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    const ownScore = own[token];
    if (ownScore === undefined) continue;
    let bestOther = -Infinity;
    for (const cls of others) {
      const value = model.logLikelihood[cls]?.[token];
      if (value !== undefined && value > bestOther) bestOther = value;
    }
    const weight = bestOther === -Infinity ? ownScore : ownScore - bestOther;
    if (weight > 0) contributions.push({ token, weight: Number(weight.toFixed(3)) });
  }

  return contributions.sort((a, b) => b.weight - a.weight).slice(0, 6);
}
