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
  { href: "/learn", label: "EV 101" },
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
  const linkClass = (href: string) =>
    active === href ? "text-brand font-semibold transition px-2 py-2" : "hover:text-ink transition px-2 py-2";
  const MOBILE_MAIN = ["/plan", "/ev", "/faq"] as const;
  const labelFor = (href: string) => (href === "/plan" ? "Plan" : NAV.find((n) => n.href === href)!.label);
  return (
    <header className={className}>
      {/* Phones: logo + three main links + a "More" menu (native <details>, no JS). */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <Link href="/" aria-label="GoEV WV home">
          <Logo className="text-xl" />
        </Link>
        <nav aria-label="Main" className="text-sm text-ink-muted flex items-center">
          {MOBILE_MAIN.map((href) => (
            <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
              className={`${linkClass(href)} min-h-11 inline-flex items-center`}>
              {labelFor(href)}
            </Link>
          ))}
          <details className="relative">
            <summary className="list-none cursor-pointer min-h-11 inline-flex items-center px-2 py-2 hover:text-ink">
              More <span aria-hidden className="ml-1">▾</span>
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 py-1">
              {NAV.filter((n) => !(MOBILE_MAIN as readonly string[]).includes(n.href)).map((n) => (
                <Link key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}
                  className={`block min-h-11 px-4 py-3 ${active === n.href ? "text-brand font-semibold" : "text-ink hover:bg-slate-50"}`}>
                  {n.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>
      </div>
      <div className="hidden sm:flex items-center justify-between gap-4 flex-wrap">
        <Link href="/">
          <Logo className="text-2xl" />
        </Link>
        <nav aria-label="Main" className="text-sm text-ink-soft flex items-center flex-wrap">
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
