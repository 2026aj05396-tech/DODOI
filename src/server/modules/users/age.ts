// 18+ check (SECURITY_AND_PRIVACY §2.7, OD-07). The date of birth is only used here: it is never
// stored or logged. "Today" is the calendar date in India (launch market, IST default), so someone
// turning 18 today in India is accepted.

export const MINIMUM_AGE = 18;
const TIME_ZONE = "Asia/Kolkata";
/** Older than this is treated as a typo, not a real date of birth. */
const MAXIMUM_AGE = 120;

type CalendarDate = { year: number; month: number; day: number };

export type DateOfBirthCheck = "adult" | "under-minimum-age" | "invalid";

function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Reject dates that roll over, e.g. 2001-02-30.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function calendarDateIn(timeZone: string, now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** Whole years between `birth` and `today`; the birthday counts on the day itself. */
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const hadBirthdayThisYear =
    today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (hadBirthdayThisYear ? 0 : 1);
}

export function checkDateOfBirth(dateOfBirth: string, now = new Date()): DateOfBirthCheck {
  const birth = parseIsoDate(dateOfBirth);
  if (!birth) return "invalid";
  const age = ageOn(birth, calendarDateIn(TIME_ZONE, now));
  if (age < 0 || age > MAXIMUM_AGE) return "invalid";
  return age >= MINIMUM_AGE ? "adult" : "under-minimum-age";
}
