/**
 * AIML preprocessing pipeline for guest reviews (before sentiment / model features).
 * Steps: lowercasing → strip punctuation & digits → stopword removal → tokenization → light stemming → dedupe.
 */

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "by",
  "with",
  "from",
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "very",
  "just",
  "too",
  "also",
  "not",
  "no",
  "yes",
  "so",
  "if",
  "than",
  "then",
  "there",
  "here",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "only",
  "own",
  "same",
]);

function lightStem(word) {
  const w = String(word || "").toLowerCase();
  if (w.length < 3) return w;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/**
 * @param {string} raw
 * @returns {{ tokens: string[], cleanedPreview: string }}
 */
export function cleanReviewTextForMl(raw) {
  const lowered = String(raw || "").toLowerCase();
  const noPunct = lowered.replace(/[^a-z\s]/g, " ");
  const pieces = noPunct.split(/\s+/).filter(Boolean);
  const filtered = pieces.filter((t) => t.length > 1 && !STOPWORDS.has(t));
  const stemmed = filtered.map(lightStem);
  const tokens = [...new Set(stemmed)];
  const cleanedPreview = tokens.slice(0, 24).join(" ");
  return { tokens, cleanedPreview };
}

export function capMlTokens(tokens, max = 50) {
  if (!Array.isArray(tokens)) return [];
  return tokens.slice(0, max).map((t) => String(t).slice(0, 64));
}
