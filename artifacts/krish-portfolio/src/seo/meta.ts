import type { BlogPost } from "../data/blog";
import { type Project, projectCover, projectPath } from "../data/projects";
import { INSTAGRAM_PROFILE, GITHUB_PROFILE, LINKEDIN_PROFILE } from "../data/social";
import type { PublicSettings } from "../data/settings";
import { escapeHtml, stripInline } from "./inline";
import { faqs } from "@/data/faqs";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_ALT,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  postPath,
  SITE_NAME,
  SITE_URL,
} from "./site";

/*
 * Per-page SEO: <title>, meta description, canonical, Open Graph / Twitter tags and JSON-LD.
 * Pure functions only — used by the browser (seo/use-seo.ts, on client-side navigation) and by
 * the build-time prerender (scripts/prerender.ts), so both always produce identical tags.
 */

type JsonLd = Record<string, unknown>;

export type PageMeta = {
  title: string;
  description: string;
  path: string; // canonical path, e.g. /blog/my-post
  image: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
  type: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  noindex?: boolean;
  jsonLd: JsonLd[];
};

const PERSON_ID = `${SITE_URL}/#person`;

/** Trims to at most `max` characters on a word boundary, adding an ellipsis when cut. */
export function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const atSpace = cut.lastIndexOf(" ");
  return `${(atSpace > max * 0.6 ? cut.slice(0, atSpace) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Social profile URLs worth listing — skips bare placeholders like "https://instagram.com". */
export function sameAsLinks(s: Pick<PublicSettings, "youtube">) {
  return [GITHUB_PROFILE, LINKEDIN_PROFILE, INSTAGRAM_PROFILE, s.youtube].filter((u) => {
    try {
      const url = new URL(u);
      return url.pathname.replace(/\/+$/, "").length > 1;
    } catch {
      return false;
    }
  });
}

function personJsonLd(s: PublicSettings): JsonLd {
  const parts = s.location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE_NAME,
    alternateName: "Krrish Dhiman",
    url: SITE_URL,
    ...(s.aboutPhoto && !s.aboutPhoto.startsWith("data:")
      ? { image: absoluteUrl(s.aboutPhoto) }
      : {}),
    jobTitle: "AI Developer",
    description: s.tagline,
    ...(parts.length >= 2
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: parts[0],
            addressRegion: parts[parts.length - 2],
            addressCountry:
              parts[parts.length - 1] === "India"
                ? "IN"
                : parts[parts.length - 1],
          },
        }
      : {}),
    knowsAbout: [
      "Python",
      "C",
      "C++",
      "Web development",
      "AI tools",
      "Digital marketing",
      "SEO",
    ],
    sameAs: sameAsLinks(s),
  };
}

const personRef = () => ({
  "@type": "Person",
  "@id": PERSON_ID,
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: [GITHUB_PROFILE],
});

function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

const defaults = {
  image: DEFAULT_OG_IMAGE,
  imageAlt: DEFAULT_OG_ALT,
  type: "website" as const,
};

function faqPageJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function homeMeta(s: PublicSettings): PageMeta {
  return {
    ...defaults,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    jsonLd: [
      personJsonLd(s),
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: `${SITE_NAME} — Portfolio & Blog`,
        url: SITE_URL,
        inLanguage: "en",
        publisher: { "@id": PERSON_ID },
      },
      faqPageJsonLd(),
    ],
  };
}

export function blogListMeta(posts: BlogPost[], s: PublicSettings): PageMeta {
  return {
    ...defaults,
    title: "Blog — Krish Khati | Notes on Coding, AI and Learning",
    description:
      "Honest notes from a self-taught developer in Haryana: learning Python, C and C++, building projects, using AI tools well, and lessons from digital marketing.",
    path: "/blog",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": `${SITE_URL}/blog#blog`,
        name: "Krish Khati — Blog",
        url: absoluteUrl("/blog"),
        inLanguage: "en",
        author: personRef(),
        blogPost: posts.slice(0, 20).map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          url: absoluteUrl(postPath(p.slug)),
          datePublished: p.date,
        })),
      },
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
      ]),
    ],
  };
}

export function projectsMeta(projects: Project[], s: PublicSettings): PageMeta {
  return {
    ...defaults,
    title: "Projects — Krish Khati | Things Built to Learn",
    description:
      "Projects by Krish Khati, a self-taught developer: websites, a memory match game, a language-learning app and more, each built to learn something new. Code on GitHub.",
    path: "/projects",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Projects by Krish Khati",
        url: absoluteUrl("/projects"),
        author: personRef(),
        mainEntity: {
          "@type": "ItemList",
          itemListElement: projects.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(projectPath(p.slug)),
            name: p.name,
          })),
        },
      },
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Projects", path: "/projects" },
      ]),
    ],
  };
}

export const projectSeoTitle = (p: Project) => `${p.name} – Krish Khati`;

export const projectMetaDescription = (p: Project) =>
  clip(
    p.metaDescription.trim() ||
      p.description.trim() ||
      stripInline(p.writeup.split(/\n\s*\n/)[0] ?? "") ||
      `${p.name}, a project by Krish Khati.`,
    160,
  );

// Only real, public http(s) URLs are worth putting in structured data (not demo-mode data: URLs).
const publicImage = (url: string) =>
  /^(https?:)?\/\//i.test(url) || url.startsWith("/") ? absoluteUrl(url) : "";

export function projectMeta(p: Project, s: PublicSettings): PageMeta {
  const path = projectPath(p.slug);
  const url = absoluteUrl(path);
  const cover = projectCover(p);
  const coverUrl = cover ? publicImage(cover.url) : "";
  const image = coverUrl || absoluteUrl(DEFAULT_OG_IMAGE);
  const screenshots = p.gallery.map((g) => publicImage(g.url)).filter(Boolean);
  const description = projectMetaDescription(p);

  // An app you can open or install is a SoftwareApplication; anything else is a CreativeWork.
  const app = p.playStoreUrl || p.liveUrl;
  const main: JsonLd = {
    "@context": "https://schema.org",
    "@type": app ? "SoftwareApplication" : "CreativeWork",
    "@id": `${url}#project`,
    name: p.name,
    description,
    url,
    image: [image],
    author: personRef(),
    creator: personRef(),
    inLanguage: "en",
    isAccessibleForFree: true,
    ...(p.updatedAt ? { dateModified: p.updatedAt } : {}),
    ...(p.techStack.length ? { keywords: p.techStack.join(", ") } : {}),
    ...(screenshots.length && app ? { screenshot: screenshots } : {}),
    ...(app
      ? {
          applicationCategory: p.playStoreUrl
            ? "MobileApplication"
            : "WebApplication",
          operatingSystem: p.playStoreUrl ? "Android" : "Any (web browser)",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          ...(p.liveUrl || p.playStoreUrl
            ? { installUrl: p.playStoreUrl || p.liveUrl }
            : {}),
        }
      : {}),
    ...([p.liveUrl, p.playStoreUrl].filter(Boolean).length
      ? { sameAs: [p.liveUrl, p.playStoreUrl].filter(Boolean) }
      : {}),
  };

  return {
    title: projectSeoTitle(p),
    description,
    path,
    image,
    imageAlt: cover
      ? cover.alt.trim() || `${p.name} screenshot 1`
      : DEFAULT_OG_ALT,
    ...(coverUrl && cover?.width && cover.height
      ? { imageWidth: cover.width, imageHeight: cover.height }
      : {}),
    type: "website",
    jsonLd: [
      main,
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Projects", path: "/projects" },
        { name: p.name, path },
      ]),
    ],
  };
}

/** First paragraph's text, for fallbacks. */
export function firstParagraph(post: Pick<BlogPost, "blocks">) {
  const p = post.blocks.find((b) => b.type === "p");
  return p && p.type === "p" ? stripInline(p.text) : "";
}

export const postSeoTitle = (post: BlogPost) => {
  if (post.seoTitle?.trim()) return post.seoTitle.trim();
  const withName = `${post.title} — Krish Khati`;
  return withName.length <= 60 ? withName : clip(post.title, 60);
};

export const postMetaDescription = (post: BlogPost) =>
  clip(
    post.metaDescription?.trim() || post.excerpt || firstParagraph(post),
    160,
  );

export function postWordCount(post: Pick<BlogPost, "blocks">) {
  return post.blocks
    .map((b) => stripInline(b.type === "list" ? b.items.join(" ") : b.text))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function postMeta(post: BlogPost, s: PublicSettings): PageMeta {
  const path = postPath(post.slug);
  const url = absoluteUrl(path);
  const cover = post.cover;
  // Social previews (Facebook, WhatsApp, …) still expect JPEG/PNG, so the bundled WebP cover swaps back
  // to its .jpg source when it's used as the opengraph image.
  const socialCover =
    cover && /^\/blog-covers\/[^/]+\.webp$/.test(cover)
      ? cover.replace(/\.webp$/, ".jpg")
      : cover;
  const image = socialCover
    ? absoluteUrl(socialCover)
    : absoluteUrl(DEFAULT_OG_IMAGE);
  const modified = post.updatedAt || post.date;
  const description = postMetaDescription(post);
  const faqs = post.faqs ?? [];

  const jsonLd: JsonLd[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: clip(post.title, 110),
      description,
      image: [image],
      datePublished: post.date,
      dateModified: modified,
      author: personRef(),
      publisher: personRef(),
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
      inLanguage: "en",
      articleSection: post.category,
      wordCount: postWordCount(post),
      ...(post.focusKeyword ? { keywords: post.focusKeyword } : {}),
    },
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
      { name: post.title, path },
    ]),
  ];
  if (faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: stripInline(f.answer) },
      })),
    });
  }

  return {
    title: postSeoTitle(post),
    description,
    path,
    image,
    imageAlt: post.coverAlt?.trim() || post.title,
    type: "article",
    publishedTime: post.date,
    modifiedTime: modified,
    section: post.category,
    tags: post.focusKeyword ? [post.focusKeyword] : [],
    jsonLd,
  };
}

export function notFoundMeta(): PageMeta {
  return {
    ...defaults,
    title: "Page not found — Krish Khati",
    description: DEFAULT_DESCRIPTION,
    path: "/404",
    noindex: true,
    jsonLd: [],
  };
}

/* ---------- Rendering the tags ---------- */

export type HeadTag = {
  tag: "meta" | "link" | "script";
  attrs: Record<string, string>;
  text?: string;
};

// JSON inside <script> must not be able to close the tag early.
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/** Every managed head tag except <title>. Each carries data-seo so the browser can swap them. */
export function headTags(meta: PageMeta): HeadTag[] {
  const canonical = absoluteUrl(meta.path);
  const image = absoluteUrl(meta.image);
  const tags: HeadTag[] = [
    { tag: "meta", attrs: { name: "description", content: meta.description } },
    {
      tag: "meta",
      attrs: {
        name: "robots",
        content: meta.noindex
          ? "noindex, follow"
          : "index, follow, max-image-preview:large",
      },
    },
  ];
  if (!meta.noindex)
    tags.push({ tag: "link", attrs: { rel: "canonical", href: canonical } });
  tags.push(
    { tag: "link", attrs: { rel: "me", href: GITHUB_PROFILE } },
    { tag: "link", attrs: { rel: "me", href: LINKEDIN_PROFILE } },
    { tag: "link", attrs: { rel: "me", href: INSTAGRAM_PROFILE } },
  );
  tags.push(
    { tag: "meta", attrs: { property: "og:type", content: meta.type } },
    { tag: "meta", attrs: { property: "og:site_name", content: SITE_NAME } },
    { tag: "meta", attrs: { property: "og:locale", content: "en_US" } },
    { tag: "meta", attrs: { property: "og:title", content: meta.title } },
    {
      tag: "meta",
      attrs: { property: "og:description", content: meta.description },
    },
    { tag: "meta", attrs: { property: "og:url", content: canonical } },
    { tag: "meta", attrs: { property: "og:image", content: image } },
    {
      tag: "meta",
      attrs: { property: "og:image:alt", content: meta.imageAlt },
    },
  );
  if (meta.image === DEFAULT_OG_IMAGE) {
    tags.push(
      { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
      { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
    );
  } else if (meta.imageWidth && meta.imageHeight) {
    tags.push(
      {
        tag: "meta",
        attrs: { property: "og:image:width", content: String(meta.imageWidth) },
      },
      {
        tag: "meta",
        attrs: {
          property: "og:image:height",
          content: String(meta.imageHeight),
        },
      },
    );
  }
  if (meta.type === "article") {
    if (meta.publishedTime)
      tags.push({
        tag: "meta",
        attrs: {
          property: "article:published_time",
          content: meta.publishedTime,
        },
      });
    if (meta.modifiedTime)
      tags.push({
        tag: "meta",
        attrs: {
          property: "article:modified_time",
          content: meta.modifiedTime,
        },
      });
    if (meta.section)
      tags.push({
        tag: "meta",
        attrs: { property: "article:section", content: meta.section },
      });
    for (const t of meta.tags ?? [])
      tags.push({
        tag: "meta",
        attrs: { property: "article:tag", content: t },
      });
  }
  tags.push(
    {
      tag: "meta",
      attrs: { name: "twitter:card", content: "summary_large_image" },
    },
    { tag: "meta", attrs: { name: "twitter:title", content: meta.title } },
    {
      tag: "meta",
      attrs: { name: "twitter:description", content: meta.description },
    },
    { tag: "meta", attrs: { name: "twitter:image", content: image } },
    {
      tag: "meta",
      attrs: { name: "twitter:image:alt", content: meta.imageAlt },
    },
  );
  for (const data of meta.jsonLd)
    tags.push({
      tag: "script",
      attrs: { type: "application/ld+json" },
      text: safeJson(data),
    });
  return tags;
}

/** The head block as an HTML string, for the prerendered pages. */
export function headHtml(meta: PageMeta) {
  const lines = [`<title>${escapeHtml(meta.title)}</title>`];
  for (const t of headTags(meta)) {
    const attrs = Object.entries(t.attrs)
      .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
      .join("");
    lines.push(
      t.tag === "script"
        ? `<script data-seo${attrs}>${t.text ?? ""}</script>`
        : `<${t.tag} data-seo${attrs} />`,
    );
  }
  return lines.join("\n    ");
}
