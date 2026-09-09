import type { MetadataRoute } from "next";

/** Private admin analytics — never allow crawlers to index or list this app. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
