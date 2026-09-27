import Link from "next/link";
import { Logo } from "./Logo";

// Shared site header. Every page used to carry its own copy of this nav;
// keeping it in one place means new pages (EV guides, utility pages, FAQ)
// show up everywhere at once.

const NAV = [
  { href: "/plan", label: "Plan your household" },
  { href: "/calculator", label: "Calculator" },
  { href: "/ev", label: "EVs" },
  { href: "/utilities", label: "Utilities" },
  { href: "/chargers", label: "Charger Map" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "Why EVs Matter" },
  { href: "/state-of-the-data", label: "State of the Data" },
] as const;

export function SiteHeader({
  active,
  className = "mb-10",
}: {
  active?: (typeof NAV)[number]["href"];
  className?: string;
}) {
  return (
    <header className={className}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/">
          <Logo className="text-2xl" />
        </Link>
        <nav className="text-sm text-ink-soft flex items-center flex-wrap">
          {NAV.map((item, i) => (
            <span key={item.href} className="flex items-center">
              {i > 0 && <span className="text-slate-300">·</span>}
              <Link
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={
                  active === item.href
                    ? "text-brand font-semibold transition px-2 py-2"
                    : "hover:text-ink transition px-2 py-2"
                }
              >
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
