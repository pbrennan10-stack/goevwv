import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Report pages are dynamic user-generated; noindexed anyway via metadata,
      // but keep them out of crawl to avoid burning crawl budget on every permutation.
      disallow: "/report",
    },
    sitemap: "https://goevwv.com/sitemap.xml",
  };
}
