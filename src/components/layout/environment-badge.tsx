// Marks the hosted test site (P1-35, SYSTEM_ARCHITECTURE §13) so nobody mistakes it for the real
// app: a small butter tag in the top-left corner on every page. Rendered only when APP_ENV=test.
// Decorative for screen readers; clicks go through to whatever is underneath.
export function EnvironmentBadge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-60 rounded-br-md bg-butter-strong px-2 py-0.5 text-overline font-bold text-foreground"
    >
      TEST
    </div>
  );
}
