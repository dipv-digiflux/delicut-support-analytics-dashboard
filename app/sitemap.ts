import type { MetadataRoute } from "next";

/** Intentionally empty — this private app must not appear in sitemaps / search. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
