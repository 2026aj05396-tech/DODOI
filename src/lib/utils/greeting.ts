// Feed greeting (`1c`/`2b`: "What will you make tonight, Aanya?"; PO decision P1-22): "today"
// before 5 pm India time and "tonight" after, with the first name taken from the display name.

const EVENING_HOUR = 17;
/** India Standard Time, UTC+5:30 (same reference as the age check). */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * "Aanya Sharma" → "Aanya"; "priyanshi.moonat" → "Priyanshi" (email sign-ups, P1-05); "maker_42"
 * → "Maker". Null when no letters are left.
 */
export function firstName(displayName: string): string | null {
  const [firstWord = ""] = displayName.trim().split(/\s+/u);
  const [name = ""] = firstWord.split(/[._\-\d@+]/u);
  // Letters plus combining marks (vowel signs in Indian scripts), starting with a letter.
  if (!/^\p{L}[\p{L}\p{M}]+$/u.test(name)) return null;
  return name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export function feedGreeting(displayName: string | null, now: Date = new Date()): string {
  const istHour = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).getUTCHours();
  const when = istHour < EVENING_HOUR ? "today" : "tonight";
  const name = displayName ? firstName(displayName) : null;
  return name ? `What will you make ${when}, ${name}?` : `What will you make ${when}?`;
}
