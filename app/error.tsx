"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

// Route-level error boundary. Catches errors thrown during rendering inside
// any page under app/*, showing a graceful fallback instead of a blank page.
// The reset() callback re-renders the failing segment — useful for transient
// errors (network blip, etc).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; in prod this could ship to an analytics endpoint.
    // eslint-disable-next-line no-console
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-12 sm:py-20">
      <div className="max-w-2xl">
        <Logo className="text-2xl mb-10" />
        <div className="text-xs font-mono uppercase tracking-wider text-amber-700 mb-3">
          Something broke on our end
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight mb-4">
          We hit an unexpected error.
        </h1>
        <p className="text-base sm:text-lg text-ink-muted mb-8 max-w-prose">
          This usually clears up with a retry. If it keeps happening, go back to
          the home page and try a fresh session. No data was lost — the
          calculator stores everything in the URL.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3 text-sm transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-slate-300 hover:bg-slate-50 text-ink font-medium px-5 py-3 text-sm transition"
          >
            Back to home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-ink-soft font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
