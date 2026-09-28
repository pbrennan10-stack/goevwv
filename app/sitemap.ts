import type { MetadataRoute } from "next";
import { getUtilities, getVehicles } from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://goevwv.com";
  const lastModified = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: "weekly" | "monthly" = "monthly",
  ) => ({ url: `${base}${path}`, lastModified, changeFrequency, priority });

  return [
    page("", 1.0),
    page("/plan", 0.9),
    page("/calculator", 0.9),
    page("/ev", 0.9),
    page("/utilities", 0.9),
    page("/faq", 0.9),
    page("/learn/glossary", 0.7),
    page("/chargers", 0.8, "weekly"),
    page("/about", 0.8),
    page("/state-of-the-data", 0.7),
    ...getUtilities()
      .filter((u) => u.id !== "rural_coops")
      .map((u) => page(`/utilities/${u.id}`, 0.8)),
    ...getVehicles().map((v) =>
      page(`/ev/${v.id}`, v.status === "discontinued" ? 0.4 : 0.7),
    ),
  ];
}
