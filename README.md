# 🧑‍💻 Krish Khati — AI Developer Portfolio

A full-stack personal portfolio with a Supabase-backed admin panel, an auto-posting AI blog, and fully automatic SEO — built as a pnpm monorepo (React + Vite frontend, Express API, Supabase/Postgres).

[![React](https://img.shields.io/badge/React-TypeScript-blue)](#)
[![Vite](https://img.shields.io/badge/Vite-Build-purple)](#)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E)](#)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220)](#)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](#)

🔗 **Live site:** [krish-portfolio-dev.vercel.app](https://krish-portfolio-dev.vercel.app)

🔗 **Connect:** [LinkedIn](https://www.linkedin.com/in/krish-khati-b0775a239/) · [GitHub](https://github.com/krish-khati)

---

## ✨ What it does

| Section | What happens |
|---|---|
| **Home / Hero** | Animated hero (video/image), infinite scrolling skills ticker, custom cursor, scroll-reveal motion |
| **Projects** | Gallery-style project cards (swipeable images, live demo / GitHub / Play Store links), dedicated `/projects/<slug>` pages |
| **Blog** | Posts stored in Supabase, rendered with FAQs, related posts, and inline internal links |
| **Admin panel** | Private dashboard to manage projects, blog posts, images, skills/tools, ticker text, and site settings — no code edits needed |
| **Auto-blog pipeline** | A scheduled script picks a long-tail keyword, writes a full SEO-checked post with AI, and publishes it to Supabase automatically |
| **SEO** | Build-time prerendering, sitemap/RSS/robots.txt, Open Graph + JSON-LD, automatic image alt-text, and IndexNow pings on every deploy |

Every publish/update in the admin panel triggers a live Vercel redeploy via a deploy hook.

---

## 🛠 How it's built

- **Frontend** — React + TypeScript + Vite + Wouter (routing) + TanStack Query, Tailwind CSS, Radix UI components
- **Backend / data** — Supabase (Postgres + Auth + Storage), plus a small Express API package for workspace use
- **Serverless functions** (`api/`) — Vercel functions for admin-triggered rebuilds and AI-generated image alt text
- **AI pipeline** (`scripts/`) — model-agnostic picker that asks Gemini/Groq for currently available models (never hardcoded) to write blog posts and backfill SEO fields
- **SEO** — `scripts/prerender.ts` runs after every build to bake real HTML, meta tags, JSON-LD and a sitemap for each page before it ships
- **Database migrations** — every schema change is written as an idempotent `.sql` file under `supabase/` and applied through the Supabase MCP

---

## 📁 Project structure

```
.
├── api/                        # Vercel serverless functions (admin rebuild, AI alt-text)
├── artifacts/
│   └── krish-portfolio/        # The actual site (Vite app)
│       ├── src/
│       │   ├── admin/          # Admin panel (auth, pages, gallery manager, SEO UI)
│       │   ├── components/     # Hero, nav, footer, project gallery, etc.
│       │   ├── data/           # Static fallback data + Supabase live hooks
│       │   ├── pages/          # Blog, projects, FAQ, 404
│       │   └── seo/            # Meta tag + JSON-LD builders, site-wide SEO constants
│       └── supabase/           # Idempotent SQL migrations for the live database
├── lib/                        # Shared workspace packages (API client, API spec, db)
├── scripts/                    # Auto-blog pipeline, SEO backfill, AI model picker
└── vercel.json                 # Rewrites, caching + security headers
```

---

## 🚀 Run it locally

```bash
git clone https://github.com/Krish-Khati/Krish-PORTFOLIO.git
cd Krish-PORTFOLIO
pnpm install
```

Set up environment variables (Supabase URL/key, AI provider keys) — see `.env.example` inside `artifacts/krish-portfolio/`.

```bash
pnpm --filter @workspace/krish-portfolio run dev
```

Other useful commands:

```bash
pnpm run typecheck   # typecheck every package
pnpm run build       # typecheck + build + prerender (SEO HTML, sitemap, RSS)
```

---

## 📄 License

MIT
