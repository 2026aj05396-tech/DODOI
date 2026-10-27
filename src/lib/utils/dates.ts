// Dates shown in sentences, e.g. "Your account will be deleted on 10 November 2026."

export function formatLongDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
