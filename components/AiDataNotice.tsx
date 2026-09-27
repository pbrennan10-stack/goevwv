import Link from "next/link";

// Plain-language notice that the data is AI-assisted. Shown in every footer
// and prominently on /state-of-the-data.
export function AiDataNotice({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      Our data is gathered and cross-checked with the help of AI tools from
      manufacturer specs, EPA ratings, utility tariffs, and published reviews.
      It can contain errors — confirm anything important with the manufacturer,
      your utility, or a dealer. Sources are on{" "}
      <Link href="/state-of-the-data" className="text-brand hover:underline">
        State of the Data
      </Link>
      .
    </p>
  );
}
