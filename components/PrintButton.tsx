"use client";

export function PrintButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className ?? "rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition"}
    >
      {children ?? "Print this report"}
    </button>
  );
}

export function CopyLinkButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window === "undefined") return;
        navigator.clipboard?.writeText(window.location.href).then(
          () => {
            // Replace button content briefly — we keep it simple with a native visual cue
            const btn = document.getElementById("copy-link-btn");
            if (btn) {
              const prev = btn.textContent;
              btn.textContent = "Link copied ✓";
              setTimeout(() => { btn.textContent = prev ?? "Copy share link"; }, 1800);
            }
          },
          () => { /* clipboard denied — no-op */ }
        );
      }}
      id="copy-link-btn"
      className={className ?? "rounded-lg bg-white ring-1 ring-slate-300 text-ink px-4 py-2 text-sm font-medium hover:bg-slate-50 transition"}
    >
      Copy share link
    </button>
  );
}
