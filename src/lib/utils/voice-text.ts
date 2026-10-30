// Puts dictated words into a text box at the caret (VOI-03). Pure, so it is tested without a browser.

export type VoiceInsertion = { value: string; caret: number };

/**
 * Inserts `spoken` into `value` between `start` and `end` (the selection), with one space on each
 * side where the neighbouring text needs it, then cuts the result to `maxLength`.
 * Returns the new value and where the caret goes (after the inserted words).
 */
export function insertSpokenText(
  value: string,
  spoken: string,
  start: number,
  end: number,
  maxLength?: number,
): VoiceInsertion {
  const words = spoken.replace(/\s+/g, " ").trim();
  if (!words) return { value, caret: Math.min(end, value.length) };

  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  const before = value.slice(0, from);
  const after = value.slice(to);

  const lead = before !== "" && !/\s$/.test(before) ? " " : "";
  const trail = after !== "" && !/^[\s.,;:!?)]/.test(after) ? " " : "";

  let inserted = `${lead}${words}${trail}`;
  if (maxLength !== undefined) {
    const room = maxLength - before.length - after.length;
    if (room <= 0) return { value, caret: from };
    inserted = inserted.slice(0, room);
  }
  const caret = before.length + inserted.trimEnd().length;
  return { value: `${before}${inserted}${after}`, caret };
}
