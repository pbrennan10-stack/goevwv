"use client";

// Tap-to-explain: dotted-underlined words that open a short plain-English
// definition. Uses the browser's built-in Popover API (no library, closes on
// tap-outside or Esc). On phones it opens as a bottom sheet.
// Rule of thumb: explain the first use on a page only, and never inside
// headings, buttons, or select options.

import { useId } from "react";
import glossary from "@/data/glossary.json";

export type TermId = keyof typeof glossary.terms;

export function Term({ id, children }: { id: TermId; children?: React.ReactNode }) {
  const entry = glossary.terms[id];
  const popId = `term-${id}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!entry) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        popoverTarget={popId}
        className="underline decoration-dotted decoration-1 underline-offset-2 cursor-help text-inherit font-inherit"
        aria-label={`${typeof children === "string" ? children : entry.term} — what's this?`}
      >
        {children ?? entry.term}
      </button>
      <span
        id={popId}
        popover="auto"
        role="note"
        className="m-0 fixed inset-x-4 bottom-4 top-auto mx-auto max-w-md rounded-2xl bg-white p-4 text-left text-sm font-normal text-ink shadow-2xl ring-1 ring-slate-200 sm:bottom-auto sm:top-1/3"
      >
        <span className="block font-semibold text-ink">{entry.term}</span>
        <span className="mt-1 block text-ink-muted">{entry.short}</span>
        <a href="/learn/glossary" className="mt-2 inline-block text-brand hover:underline">All terms →</a>
      </span>
    </>
  );
}
