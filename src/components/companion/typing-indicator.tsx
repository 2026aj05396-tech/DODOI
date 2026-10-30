/** Shown while the answer is on its way (F-23 step 2); the dots stand still with reduced motion. */
export function TypingIndicator() {
  return (
    <div
      role="status"
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-background px-4 py-3.5"
    >
      <span className="sr-only">dodoi is writing an answer</span>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          aria-hidden
          style={{ animationDelay: `${dot * 150}ms` }}
          className="size-2 rounded-full bg-plum/60 motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}
