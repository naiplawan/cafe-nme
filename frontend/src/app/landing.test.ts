import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Noto_Sans_Thai: () => ({ variable: "font-display-stub" }) }));

const { default: LandingPage } = await import("./page");
const marqueeModule = await import("@/components/site/marquee");
const { landing, landingJsonLd } = await import("./landing-content");
const { default: robots, PRIVATE_PATHS } = await import("./robots");
const { default: sitemap } = await import("./sitemap");
const { config: proxyConfig } = await import("../proxy");
const { AUTH_COOKIE_NAME } = await import("@/server/auth-api");

describe("landing page", () => {
  const markup = renderToStaticMarkup(createElement(LandingPage));

  it("renders one h1 with the main keyword and the sign-up call to action", () => {
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain(landing.title);
    expect(markup).toContain('href="/signup"');
  });

  it("embeds JSON-LD whose FAQ matches the visible FAQ", () => {
    const script = markup.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(script).toBeDefined();
    const graph = JSON.parse(script as string)["@graph"] as { "@type": string; mainEntity?: { name: string }[] }[];
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity?.map((question) => question.name)).toEqual(landing.faq.map((item) => item.q));
    for (const item of landing.faq) {
      expect(markup).toContain(item.q);
    }
  });

  it("exposes each marquee word to screen readers once and hides the looping repeats", () => {
    const { Marquee } = marqueeModule;
    const band = renderToStaticMarkup(createElement(Marquee, { words: ["กาแฟ", "นม"], tone: "amber" }));
    expect(band.match(/<ul class=/g)).toHaveLength(1);
    expect(band.match(/<ul aria-hidden="true"/g)).toHaveLength(3);
    expect(markup.match(/data-marquee-track/g)).toHaveLength(2);
  });

  it("escapes < inside the JSON-LD script", () => {
    expect(JSON.stringify(landingJsonLd()).replace(/</g, "\\u003c")).not.toMatch(/</);
  });
});

describe("signed-in redirect", () => {
  it("runs the proxy on / only when the session cookie is present", () => {
    expect(proxyConfig.matcher).toEqual([{ source: "/", has: [{ type: "cookie", key: AUTH_COOKIE_NAME }] }]);
  });
});

describe("crawler files", () => {
  it("keeps app screens out of robots.txt and points to the sitemap", () => {
    const { rules, sitemap: sitemapUrl } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(PRIVATE_PATHS);
    for (const path of ["/admin", "/pos", "/liff", "/api"]) {
      expect(PRIVATE_PATHS).toContain(path);
    }
    expect(PRIVATE_PATHS).not.toContain("/menu");
    expect(sitemapUrl).toMatch(/\/sitemap\.xml$/);
  });

  it("lists only public URLs in the sitemap", () => {
    for (const entry of sitemap()) {
      const path = new URL(entry.url).pathname;
      expect(PRIVATE_PATHS.some((privatePath) => path.startsWith(privatePath))).toBe(false);
    }
  });
});
