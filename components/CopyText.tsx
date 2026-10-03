"use client";

// Copy a block of text (an email template) or print the page. The page itself
// renders on the server; only these two buttons need the browser.

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copy this text:", text);
        }
      }}
      className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-ink hover:border-brand"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

export function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-ink hover:border-brand print:hidden"
    >
      Print this page
    </button>
  );
}
