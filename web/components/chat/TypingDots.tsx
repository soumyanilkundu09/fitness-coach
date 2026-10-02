/** Three dots on a breath cycle — the coach's own tempo, not a loading spinner. */
export function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="sr-only">The coach is writing a reply.</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="breathe-dot block h-[5px] w-[5px] bg-indigo"
          style={{ animationDelay: `${i * 220}ms` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
