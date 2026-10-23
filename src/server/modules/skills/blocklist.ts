// Offensive-word check for public custom interests (OD-13). The word list is data
// (./blocked-terms.ts); this module only knows how to match. Matching works on whole words after
// undoing common character swaps, so harmless words that merely contain a blocked string pass.

const CHARACTER_SWAPS: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

function toWords(text: string): string[] {
  const canonical = [...text.normalize("NFKC").toLocaleLowerCase("en")]
    .map((character) => CHARACTER_SWAPS[character] ?? character)
    .join("");
  return canonical.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

function containsSequence(words: readonly string[], sequence: readonly string[]): boolean {
  for (let start = 0; start + sequence.length <= words.length; start++) {
    if (sequence.every((word, offset) => words[start + offset] === word)) return true;
  }
  return false;
}

/** Builds a matcher for a list of blocked words or phrases. */
export function createBlocklistMatcher(terms: readonly string[]): (name: string) => boolean {
  const blockedWords = new Set<string>();
  const blockedPhrases: string[][] = [];
  const blockedJoined = new Set<string>();
  for (const term of terms) {
    const words = toWords(term);
    if (words.length === 0) continue;
    if (words.length === 1) blockedWords.add(words[0] ?? "");
    else blockedPhrases.push(words);
    blockedJoined.add(words.join(""));
  }

  return (name) => {
    const words = toWords(name);
    if (words.some((word) => blockedWords.has(word))) return true;
    if (blockedPhrases.some((phrase) => containsSequence(words, phrase))) return true;
    // Catches spaced or hyphenated spellings of a whole blocked term ("b a d", "b-a-d").
    return blockedJoined.has(words.join(""));
  };
}
