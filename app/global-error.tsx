"use client";

// Last-resort error page for failures in the root layout itself (app/error.tsx
// only covers pages inside the layout). Keeps the same friendly tone.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "15vh auto", padding: "0 16px", color: "#0f172a" }}>
        <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
        <p>The page didn&apos;t load. Please try again — if it keeps happening, check back in a few minutes.</p>
        <p style={{ display: "flex", gap: 16 }}>
          <button onClick={() => reset()} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
            Try again
          </button>
          {/* Plain <a> on purpose: a full page load escapes a broken root layout. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ padding: "10px 0", color: "#047857" }}>Go to the homepage</a>
        </p>
      </body>
    </html>
  );
}
