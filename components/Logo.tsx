export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-extrabold tracking-tight ${className}`}
      aria-label="GoEV WV"
    >
      Go<span className="text-brand">EV</span> WV
    </span>
  );
}
