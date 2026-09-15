import type { MetadataRoute } from "next";

/** Private admin analytics — never allow crawlers to index or list this app. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
      {
        userAgent: [
          "Googlebot",
          "Googlebot-Image",
          "Googlebot-News",
          "Googlebot-Video",
          "Bingbot",
          "Slurp",
          "DuckDuckBot",
          "Baiduspider",
          "YandexBot",
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "ClaudeBot",
          "anthropic-ai",
          "Claude-Web",
          "CCBot",
          "Bytespider",
          "PerplexityBot",
          "Applebot",
          "Applebot-Extended",
          "Amazonbot",
          "meta-externalagent",
        ],
        disallow: "/",
      },
    ],
  };
}
