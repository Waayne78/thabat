const ARABIC_LETTER = /[ء-يٱ-ۓ]/;

/** Splits an ayah into recitable words; pause marks and signs stay attached to the word before them. */
export function splitWords(text: string): string[] {
  const words: string[] = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    if (!ARABIC_LETTER.test(token) && words.length > 0) words[words.length - 1] += ` ${token}`;
    else words.push(token);
  }
  return words;
}

/**
 * Indexes of the words to hide at a given level (0..1). Deterministic for a given seed so the
 * hidden set grows instead of reshuffling: every word hidden at 25 % is still hidden at 50 %.
 */
export function hiddenIndexes(count: number, ratio: number, seed: number): Set<number> {
  const order = Array.from({ length: count }, (_, i) => i);
  let s = (seed * 2654435761) >>> 0 || 1;
  for (let i = count - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const n = Math.min(count, Math.max(0, Math.round(count * ratio)));
  return new Set(order.slice(0, n));
}
