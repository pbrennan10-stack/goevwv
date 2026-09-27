import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /report is noindexed via its metadata. Don't block it here too — a
      // blocked page can't be crawled, so search engines never see the noindex.
      disallow: "/api/",
    },
    sitemap: "https://goevwv.com/sitemap.xml",
  };
}
