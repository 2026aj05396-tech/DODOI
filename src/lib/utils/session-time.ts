// Times for creative sessions (SES-03): stored in UTC, shown in the viewer's own time zone, with
// IST beside it when the viewer is somewhere else. The zone comes from the browser.

export const IST_ZONE = "Asia/Kolkata";

export function viewerTimeZone(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || IST_ZONE;
  } catch {
    return IST_ZONE;
  }
}

function format(date: Date, timeZone: string, withDate: boolean): string {
  return new Intl.DateTimeFormat("en-IN", {
    ...(withDate ? { weekday: "short", day: "numeric", month: "short" } : {}),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

/**
 * "Mon, 3 Nov, 4:00 pm" in the viewer's zone, plus `ist` ("Mon, 3 Nov, 4:30 pm IST") when that
 * reads differently there. Zones that share IST's clock (aliases such as Asia/Calcutta) show none.
 */
export function formatSessionTime(
  iso: string,
  timeZone: string = viewerTimeZone(),
): { local: string; ist: string | null } {
  const date = new Date(iso);
  const local = format(date, timeZone, true);
  const ist = format(date, IST_ZONE, true);
  return { local, ist: local === ist ? null : `${ist} IST` };
}

/** One line for notifications and cards: "Mon, 3 Nov, 4:00 pm (Mon, 3 Nov, 4:30 pm IST)". */
export function sessionTimeText(iso: string, timeZone?: string): string {
  const { local, ist } = formatSessionTime(iso, timeZone);
  return ist ? `${local} (${ist})` : local;
}

/** "2026-11-03" and "16:00" typed in the browser, read in the viewer's own zone → an ISO instant. */
export function localInputToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const instant = new Date(`${date}T${time}`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** Today's date in the viewer's zone as `YYYY-MM-DD`, for the date field's minimum. */
export function todayInput(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
