import { capMlTokens, cleanReviewTextForMl } from "./reviewTextPipeline.js";

const POSITIVE_TERMS = [
  "great",
  "excellent",
  "amazing",
  "clean",
  "friendly",
  "helpful",
  "perfect",
  "love",
  "awesome",
  "comfortable",
];

const NEGATIVE_TERMS = [
  "bad",
  "dirty",
  "slow",
  "rude",
  "terrible",
  "poor",
  "worst",
  "awful",
  "noisy",
  "disappointed",
  "cold",
  "tasteless",
];

/**
 * Rule-based sentiment (placeholder for trained AIML model).
 * Uses cleaned tokens from the preprocessing pipeline.
 * @returns {{ score: number, label: string, tokens: string[], cleanedPreview: string, sentimentPositivePct: number, sentimentNeutralPct: number, sentimentNegativePct: number }}
 */
export function analyzeReviewSentiment(text, rating) {
  const { tokens, cleanedPreview } = cleanReviewTextForMl(text);
  const normalized = tokens.join(" ");
  let score = (Number(rating) - 3) * 0.25;

  for (const term of POSITIVE_TERMS) {
    if (normalized.includes(term)) score += 0.1;
  }
  for (const term of NEGATIVE_TERMS) {
    if (normalized.includes(term)) score -= 0.1;
  }

  score = Math.max(-1, Math.min(1, Number(score.toFixed(2))));
  let label = "neutral";
  if (score >= 0.25) label = "positive";
  if (score <= -0.25) label = "negative";

  const capped = capMlTokens(tokens, 50);

  let posPct = 0;
  let neuPct = 0;
  let negPct = 0;
  if (label === "positive") {
    posPct = Math.round(55 + Math.min(45, Math.abs(score) * 80));
    negPct = Math.round((100 - posPct) * 0.15);
    neuPct = 100 - posPct - negPct;
  } else if (label === "negative") {
    negPct = Math.round(55 + Math.min(45, Math.abs(score) * 80));
    posPct = Math.round((100 - negPct) * 0.15);
    neuPct = 100 - negPct - posPct;
  } else {
    neuPct = 55;
    posPct = 23;
    negPct = 22;
  }

  return {
    score,
    label,
    tokens: capped,
    cleanedPreview,
    sentimentPositivePct: posPct,
    sentimentNeutralPct: neuPct,
    sentimentNegativePct: negPct,
  };
}
