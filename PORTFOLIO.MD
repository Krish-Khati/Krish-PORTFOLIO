# PORTFOLIO

**Owner:** Krish (KRRISH972)
**Repo:** https://github.com/KRRISH972/Krish-PORTFOLIO
**Stack:** React + TypeScript + Vite + Wouter + TanStack Query (pnpm workspace)

This file tracks every change made to the Krish Portfolio website.
It is updated **daily** — each working day gets a dated entry below,
so the full evolution of the site is visible at a glance.

---

## Daily Updates

### 2026-09-29 (3) — Supabase MCP + database rules

- `.mcp.json`: connects Claude Code to the portfolio's Supabase project through the Supabase MCP server (OAuth login, no credentials in the repo).
- `CLAUDE.md`: rules for all database work. Write the change to a `.sql` file in `supabase/` first, in a form that is safe to re-run (`if not exists`), then apply it through the MCP and check it with a query. Additive changes only (no `DROP`/`TRUNCATE`/`DELETE` or turning off RLS without the owner's explicit yes). Apply migrations before pushing code that depends on them.
- From now on, migrations are applied directly instead of being left as "Owner action needed".

### 2026-09-29 (2) — Hero ticker: seamless, slim, editable from admin

**Public site** (`src/components/hero-ticker.tsx`, `src/data/ticker.ts`, `src/index.css`)
- The band under the hero is now a true infinite marquee: two identical groups slide from 0 to -50%, each repeated to fill the row width, so there is no gap or jump at any screen size.
- Final look: one slim row (46–48px) on the page background with faint top and bottom borders, 12–12.5px muted gray uppercase text with wide letter spacing, and small green star separators. It scrolls slowly at 32px/s with faded edges and pauses on hover. The first item starts just inside the fade instead of cut off. The gap to the About section is tighter.
- Reduced motion: no animation, just one centered static row that wraps. Mobile: smaller text and spacing, no horizontal overflow.
- New default items (ALWAYS BUILDING … LOGIC FIRST). An earlier version of this change had per-item icons and a reverse second row (LEARN / BUILD / SHIP / REPEAT); both were removed in the slim redesign.

**Admin**
- Settings → Ticker: add, edit, delete and reorder items. Saving triggers the Vercel deploy hook.

**Data / build**
- `src/data/live.ts` loads the items from Supabase. `scripts/prerender.ts` includes them in the static HTML. Both fall back to the default items if the table is missing.

**Database**: `supabase/add-ticker.sql` creates and seeds `ticker_items` and `ticker_settings`. It is applied on the live database (both tables present ✅). The unused `icon` column and the `ticker_settings` table are left in place (additive only).

### 2026-09-29 — Project gallery redesign, project pages, automatic image SEO

**Public site**
- "04 / Selected practice — Things built to learn." now shows stacked project blocks instead of the numbered list: a gallery card (main image with prev/next arrows, "1 / 4" counter, green dots, thumbnail row, captions, fade, lazy loading, swipe, arrow keys, optional YouTube/video slide, `object-fit: contain` so phone and desktop screenshots both fit) beside a details card (name + badge pill, description, Key Features with green square bullets, Technology Stack pills, Live demo / GitHub / Play Store buttons, hidden when empty). Sides alternate on desktop; on phones the gallery sits on top. Projects without images show a green gradient placeholder. The home page shows featured projects (all when none are featured) with a "See all" link.
- New `/projects/<slug>` pages: the same layout plus the long write-up, blog posts that mention the project, previous/next project. `/projects` uses the same blocks for every project.
- SEO: `<title>` "<Project> – Krish", meta description, canonical, Open Graph/Twitter with the cover image and its size, JSON-LD `SoftwareApplication` (projects with a live/Play Store link) or `CreativeWork`, plus `BreadcrumbList`. Prerendered by `scripts/prerender.ts` and listed in `sitemap.xml` with `lastmod`.

**Admin**
- Projects page: cards with cover, badge, featured star, image/feature counts, meta-description status; reordering or deleting redeploys the site (reorders are batched).
- New full-page project editor (`/admin/projects/:id`): name, slug, badge, short description, write-up (with preview), key features (add/remove/reorder), tech stack tags, live/GitHub/Play Store/video links, featured toggle, display order, meta description with 140–160 counter and Google preview. Saving triggers the Vercel redeploy.
- Gallery manager: multi-file drag & drop or click (JPG/PNG/WebP, ≤ 5 MB each) with per-file progress and real error messages; drag or arrows to reorder, "Set as cover", delete, editable alt text + caption, "Regenerate alt text". Existing single project images become the first gallery image.

**Automatic image SEO** (`src/admin/image-seo.ts`, `api/alt-text.ts`)
- In the browser: resize to ≤ 1600px wide, WebP ~80% (EXIF stripped by re-encoding), a 320px thumbnail, width/height saved for the `<img>` tags, file name `<project-slug>-<short-description>-<n>.webp`.
- `api/alt-text.ts` (Vercel function, admin-only like `api/rebuild.ts`): sends the image + project name/description to a vision-capable model chosen live by `scripts/src/ai-model-picker.ts` (Gemini, then Groq vision models) — alt text ≤ 120 chars that mentions the project, never "image of". Falls back to "<Project> screenshot <n>". Needs `GEMINI_API_KEY` and/or `GROQ_API_KEY` in Vercel.
- `api/tsconfig.json` now uses `"module": "NodeNext"` so `api/*` stays CommonJS while the shared picker (under `scripts/`, `"type": "module"`) compiles as a real ES module — verified by loading the built function the way Vercel does.

**Database**: one file, `supabase/add-project-details.sql` (all `if not exists`; also sets up the `covers` storage bucket). ~~Owner action needed~~ Now applied on the live database (new `projects` columns present ✅). Before it was applied, the site, admin and build skipped the missing columns with a warning and kept using each project's name, description, link and image.

**Verification**
- Typecheck ✅, `vercel build` ✅ (prerender against live Supabase without the new columns ✅), headless Chrome at 1366/414/390/375px: new layout, arrows/keys/thumbnails/swipe, portrait images contained, no horizontal overflow ✅; admin demo mode: multi-upload, WebP + size, invalid-file error, fallback alt text, set as cover, save ✅.

### 2026-09-28 (3) — Fully automatic SEO (prerendering, sitemap/RSS, SEO auto-posts, admin SEO panel)

**Search engines now see real HTML**
- `scripts/prerender.ts` runs after `vite build`: loads published posts, projects and settings from Supabase and writes `index.html`, `blog/index.html`, `blog/<slug>/index.html`, `projects/index.html` with the page's title, meta description, canonical, Open Graph/Twitter tags, JSON-LD and the full article text. Also writes `sitemap.xml`, `rss.xml`, `robots.txt` and `spa.html` (fallback shell for other URLs, e.g. admin). Fails the build if posts can't be loaded, so a broken build never replaces the live site.
- `src/seo/*`: shared tag/JSON-LD builders (Person + WebSite on home, Blog, CollectionPage, BlogPosting + BreadcrumbList on posts, FAQPage when a post has FAQs), `useSeo()` keeps `<head>` in sync on client-side navigation, SEO score, related posts, inline `[text](/path)` links.
- Posts: FAQ section, "Related posts" (3, same category first), inline internal links, cover alt text, lazy images. New `/projects` page. Footer links to Projects + RSS. Default 1200×630 share image `public/og-default.png`.
- `vercel.json`: rewrites to `spa.html`, `trailingSlash: false`, `X-Robots-Tag: noindex` on `/admin`.

**Publishing → redeploy → IndexNow**
- `api/rebuild.ts` (Vercel function): checks the admin's Supabase session and calls the Deploy Hook in the server-side env var `VERCEL_DEPLOY_HOOK`. Called by the admin panel on publish / update of a published post / unpublish / delete.
- The auto-post script calls the same hook (GitHub secret `VERCEL_DEPLOY_HOOK`) when it publishes.
- Production builds ping IndexNow with only the URLs that are new or changed versus the live sitemap. Key file: `public/cdc12c37e7f44adfe1b7b8e92683bd1d.txt`.

**Auto-post pipeline**
- Shared AI code moved to `scripts/src/ai-generate.ts` (still uses `ai-model-picker.ts`, nothing hardcoded). `scripts/src/seo.ts` enforces SEO title ≤ 60, meta description 140–160, short keyword slug, 3–4 FAQs, cover alt, and valid internal links (2–3 posts + projects/contact), fixing them in code. Keyword placement in the first paragraph and an H2 is checked, with one retry.
- `scripts/src/seo-backfill.ts` + workflow "SEO backfill": fills SEO fields for existing posts (no slug or text changes), then redeploys.

**Admin**
- Post editor: SEO panel (focus keyword, SEO title, meta description, slug with counters, Google preview, score + checklist), FAQ editor, cover alt text. Blog posts list: SEO score column.

**Database**: one file, `supabase/add-seo.sql` (`add column if not exists`). **Owner action needed:** run it once. Until then, every part of the system saves without these columns and logs a warning.

**Verification**
- Typecheck (all packages) ✅, production build + prerender ✅ (5 posts from Supabase), 1 H1 per page ✅, sitemap/RSS/robots ✅, headless Chrome: React replaces the static HTML with a single set of head tags ✅, admin SEO panel renders ✅.

### 2026-09-28 (2) — Admin: editable Skills section, real tool logos

**"My Capabilities" is now fully editable from the admin panel**
- New database tables `tools` (name, logo_url, sort_order) and `stats` (value, label, sort_order), public read / authenticated-only write, seeded with the current 10 tools and 3 stats. One file: `supabase/add-tools-and-stats.sql` (safe to re-run — seeds only when the tables are empty). **Owner action needed:** run it once in the Supabase SQL editor.
- Tool logos upload into the existing "covers" storage bucket under a `tools/` folder — no new bucket needed.
- `src/admin/api.ts`: `uploadImage()` gained optional `folder`/`maxMB` params; added full CRUD (list/save/move/delete) for tools and stats, demo-mode and Supabase-mode, matching the Projects page's pattern exactly.
- `src/admin/ui.tsx`: pulled the cover-style image dropzone out into a shared `ImagePicker` component (used by both the Images page and the new Skills page).

**New: Skills page (`/admin/skills`)**
- Tools: grid of cards with a logo dropzone (click/drag, PNG/SVG/WebP/JPG up to 2 MB) and an editable name, move up/down, delete with confirm, add via a modal.
- Stats: editable value + label rows, move up/down, delete with confirm, add inline.
- Success/error toasts throughout, using the real Supabase error message on failure.

**Public site**
- `src/data/skills.ts` (new): static fallback tools/stats + a name → line-icon lookup (kept for tools without an uploaded logo).
- `src/data/live.ts`: `useTools()` / `useStats()` load from Supabase in `sort_order`, falling back to the static list on any error (including the tables not existing yet) so the section is never empty.
- `src/App.tsx`: tools render their uploaded logo (48px, contain, on a subtle dark tile so dark logos like GitHub's stay visible), or the existing line icon, or a green initial circle as a last resort; stats keep their count-up animation, now driven by the database. Both show a simple pulsing placeholder while loading.

**Verification**
- `pnpm --filter @workspace/krish-portfolio run typecheck` ✅ and production `vite build` ✅.

### 2026-09-28 — Admin: session expiry, change password, Images page

**Admin login no longer stays signed in forever**
- `src/lib/supabase.ts`: Supabase client now uses `persistSession: false`, so the admin session lives only in memory. Closing the tab/browser (or reloading the page) signs the admin out — next visit asks for email + password again.

**New: Change password (Settings)**
- `src/admin/auth.tsx`: added `updatePassword()` using `supabase.auth.updateUser({ password })`.
- `src/admin/pages/settings.tsx`: new "Change password" card (new password + confirm, shown only when Supabase is connected, since the demo login has no real password).

**New: Images page (`/admin/images`)**
- Manage every photo on the site from the admin panel instead of touching code:
  - **Hero background** — replaces the hero video with an uploaded image when set.
  - **About / My journey photo** — fills the photo placeholder in the "Small town. Big intent." section.
  - **Project images** — a thumbnail per project, shown next to it in "Things built to learn."
- `src/admin/api.ts`: generalized `uploadCover` into `uploadImage` (same "covers" storage bucket, now used for all image types); `SiteSettings` gained `heroImage` / `aboutPhoto`; `AdminProject` gained `image`.
- `src/data/live.ts`, `src/data/projects.ts`, `src/App.tsx`, `src/index.css`: public site reads and renders the new fields (hero `<img>` fallback, about photo, project thumbnail), all optional — nothing changes on the live site until an image is set.
- `supabase/add-project-images.sql` (new) + `supabase/schema.sql` updated: adds the `image` column to `projects`. **Owner action needed:** run `supabase/add-project-images.sql` once in the Supabase SQL editor to enable project images (hero image, about photo and password change need no SQL — they work immediately).

**Verification**
- `pnpm --filter @workspace/krish-portfolio run typecheck` ✅ and production `vite build` ✅.

### 2026-09-24 — Blog page + site-wide animations

**New: Blog (`/blog`, `/blog/:slug`)**
- Added `src/data/blog.ts` (typed posts: title, excerpt, category, date, content blocks — paragraph / heading / quote / list / code) with 5 starter posts (Journey, Learning, Projects, AI, Marketing).
- `src/pages/blog.tsx`: animated hero ("Thoughts on building & learning."), floating teal glow orbs, live search, category filter chips, featured latest post + staggered card grid with reading time.
- `src/pages/blog-post.tsx`: article page with staggered block entrance, styled headings / quotes / bullet lists / code blocks, and Older / Newer post navigation; unknown slugs fall back to 404.
- Routes registered in `App.tsx`; "Blog" link added to the navbar and footer.

**Navigation**
- Navbar extracted to `src/components/site-nav.tsx`: scroll-spy highlights the section in view, links work from blog pages (go back to Home + scroll to the section), and a new mobile hamburger menu (links were hidden on phones before).
- Footer extracted to `src/components/site-footer.tsx`.

**Animations (whole site)**
- `site-effects.tsx`: teal scroll-progress bar at the top, back-to-top button, magnetic hover on the main buttons, 3D tilt on project rows and blog cards, subtle hero-video parallax.
- `hero-particles.tsx`: canvas particle network in the hero that links to the cursor; pauses when off-screen or tab hidden.
- CSS: shine sweep across the "Krish" name, sheen on the primary button, glow + wiggle on tool icons, gradient underline + teal title on project hover, rotating light border on the My Story card, pulsing timeline dots, marquee pauses on hover.
- All new motion respects `prefers-reduced-motion`.

**New: Admin panel (`/admin`) — UI only, Supabase to be connected later**
- Login screen (`/admin/login`) with animated grid + glow orbs. **Demo sign-in only** (any valid email + 6-char password) — not real security until Supabase Auth is wired in.
- Dashboard: greeting, animated stat cards (published / drafts / projects / unread), recent posts, latest messages, quick actions.
- Blog posts: table with All / Published / Drafts tabs, search, edit, delete (confirm dialog).
- Post editor: title, excerpt, simple text formatting (`##` heading, `>` quote, `-` list, code fences) with toolbar, Write / Split / Preview modes using the real blog styles, slug auto-generated from the title, category, date, draft/publish, Ctrl+S save, unsaved-changes warning.
- Projects: card grid with add/edit modal, reorder up/down, delete.
- Messages: inbox with unread badge, reading pane, mark read/unread, reply by email, delete (mobile: list → detail).
- Settings: profile, typewriter roles, social links, database status card, "reset demo data".
- Responsive sidebar (off-canvas drawer on mobile), entrance animations, skeleton loaders, toasts; custom cursor/site effects disabled inside admin.
- Data layer `src/admin/api.ts`: every screen goes through its async functions; for now they use demo data in the browser's localStorage. Swap their bodies for Supabase queries later.
- `supabase/schema.sql`: ready-to-run tables (posts, projects, messages, site_settings) + Row Level Security policies (not applied yet).
- Projects data moved to `src/data/projects.ts` (shared by the site and the admin seed).
- The public site still reads the static data files — admin edits don't show on the site until Supabase is connected.

**Supabase connected (live database)**
- Supabase project "PORTFOLIO" (Mumbai region) created by the owner; `schema.sql` + `seed.sql` run, admin user created, public sign-ups turned OFF.
- `src/lib/supabase.ts` client reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `artifacts/krish-portfolio/.env` (git-ignored; template in `.env.example`).
- Admin: real Supabase email/password login; all screens read/write the database; topbar shows "Live · Supabase"; demo reset hidden when live.
- Site: blog list + post pages, projects, hero roles/description, contact details and social links now come from the database (static files remain the fallback when no keys are set).
- Contact form saves messages into the admin inbox (falls back to opening the mail app if saving fails).
- `supabase/seed.sql`: starter posts, projects and settings; message length limits added to `messages`.

**Verification**
- `pnpm --filter @workspace/krish-portfolio run typecheck` ✅ and production `vite build` ✅.
- Editor text ↔ blocks conversion round-trips all 5 existing posts exactly ✅.
- Live database checks as a public visitor: 5 published posts, 5 projects and settings readable ✅; messages NOT readable ✅; creating a post blocked (401) ✅; sign-up blocked ✅; contact-form message saved (201) ✅; oversized message rejected ✅.
- Dev server loads `/`, `/blog`, `/admin/login` with the Supabase URL picked up ✅. Admin login itself to be confirmed by the owner (password known only to them).

### 2026-09-23 — Launch build (major)

**Global / Architecture**
- Initialized the `krish-portfolio` Vite + React + TS workspace (pnpm), components in `src/components`, pages in `src/pages`.
- Added dedicated `PORTFOLIO.MD` work log (this file) with a daily-update policy.

**Hero section**
- Background video swap: replaced with the user's own file (`Man_sitting_in_office_chair_…mp4`); duplicated to `public/krish-hero.mp4` and `public/media/krish-hero.mp4`.
- Rebuilt hero text from a user-provided markup template: greet → "Krish" name (letter-by-letter entrance + bouncing dots) → Typewriter roles (Web Developer / Digital Marketer / AI Enthusiast) → description → CTA buttons (Download Resume, View Projects).
- Font Awesome icons replaced with `lucide-react` icons (Instagram, LinkedIn, YouTube, GitHub, Download, ArrowRight).
- Applied the teal-green theme (`#2ecc71 → #16a085`) with Inter/Poppins fonts; no uppercase text.
- Entrance animations (greet 0.1s, name letters 0.3+ stagger, dots bounce, role 0.9s, desc 1.1s, buttons 1.3s) exempted from reduced-motion kill-switch.
- Custom animated cursor (teal dot + trailing ring with lerp; scales on hover over links/buttons), desktop-only via `@media (hover:hover) and (pointer:fine)`.

**Navigation bar**
- Fixed navbar with `.scrolled` state (backdrop blur, dark translucent bg, teal bottom border) toggled on `scrollY > 50`.
- KC logo removed from navbar; nav-links (Home/About/Skills/Projects/Contact) with teal animated underline hover + social icons.

**Section 01 — About ("Small town. Big intent.")**
- Restructured into a 2-column layout (55/40) with photo placeholder, coral label, Poppins 800 heading, gray copy.
- Scroll entrance animations via a dedicated `.about-in` IntersectionObserver (threshold 0.2, one-shot).
- Left-side outlined "01" watermark (floating, 6s) + photo corner brackets + scattered dots + radial teal glow behind the photo.

**Section 02 — My Story**
- New "My Story" card (teal-bordered, lighter panel `#131e1b`) with 3 real story paragraphs (class 12 self-taught, Python/C/C++ journey, entry-level goal).

**Section 03 — Skills / Capabilities grid**
- Redesigned to "My Capabilities": heading, 10-tool icon grid (5×2) using outline icons (Claude, GitHub Copilot, ChatGPT, VS Code, GitHub, Figma, ElevenLabs, Deepgram, Cartesia AI, LiveKit); teal hover + scale.
- Animated stats counters (500+ hours, 5+ projects, 3+ languages) counting up over 1.5s ease-out on scroll (rAF, one-shot).
- "Digital Marketing" subsection: teal-accent heading + 5 pill badges (SEO, Google Ads, Meta Ads, Social Media Management, Digital Marketing Strategy) with icon + hover states.
- Section renumbered sequence: About 01 / Story 02 / Skills 03 / Projects 04 / Timeline 05 / Vision 06 / Contact 07.

**Section 04 — Projects ("Things built to learn.")**
- 5 project rows (Fitness Temple, LinguaBridge, Memory Match Game, Calculator, M2F Gym Website) with GitHub links.
- Moved after Skills to match navbar order (About → Skills → Projects).

**Section 05 — Trajectory / Timeline**
- Heading replaced with "Learning fast. / Building faster." (white + teal, Inter 800, ~56–64px).
- Chronological order fixed: 2024 Class 10 → 2026/NOW Class 12 → 2026 Digital Marketing with AI certification → NEXT entry-level.
- Styling overhaul: teal year labels (Inter 600, uppercase), Poppins 700 titles (22px), gray 15px descriptions, 2px teal rail (0.4 opacity) with dot markers, teal-tinted dividers.
- Left-column "05" watermark (floating 6s) + faint diagonal decorative lines.
- Entry entrance: slide-in from right (translateX 20px → 0) with 0.15s stagger, one-shot observer, threshold 0.2.

**Section 06 — My Vision (replaces Working Principles)**
- Coral "Working Principles" section replaced with a dark "My Vision" section (`#0a0a0a`).
- Concentric dashed teal radar rings (620/980/1400px, opacity 0.06) rotating 60/80/100s; dotted-grid overlay (0.04).
- 3 contrast statement pairs (white → teal): "I don't wait… / I build…", "I don't chase… / I chase…", "I don't follow… / I follow…".
- Scroll-triggered "flashlight" highlight: each line sweeps `scaleX(0→1)` from left (0.6s ease-out, blur glow) + text fades in; per-line IntersectionObserver threshold 0.5, once.
- "Let's Build Together →" CTA button (white outline pill, `#contact` link; hover teal gradient + dark text).

**Section 07 — Contact ("Let's build what's next.")**
- Added a form card (dark `#131e1b`, teal border): Full Name / Email Address / Message fields (dark inputs, teal focus), full-width **Send 🚀** button (white outline → teal gradient on hover, `scale(0.98)` press) with a `mailto:` submit.
- Divider + location line (map-pin icon, "Pundri, Kaithal, Haryana, India") and 4 circular social icon buttons (Instagram/LinkedIn/YouTube/GitHub) matching navbar style.
- Field stagger entrance (0s/0.1s/0.2s), button 0.4s, location+socials 0.5s.
- Preserved the original contact-details links (email/phone/GitHub) below the card.

**Background patterns (per-section identity)**
- About: dotted grid (24px).
- Skills: plus/cross grid (SVG data-URI, 40px tile, white 0.06).
- Projects: nested-square outlines (SVG data-URI, 50px tile, teal 0.08).
- Timeline: retained solid `#071114` + "05" watermark.
- Vision: `#0a0a0a` + rings + dots overlay.
- Contact: radial "spotlight" dot fade (dotted pattern masked to center via `::after`).
- Alternating shades `#0d0d0d` / `#0f1614` preserved; hero keeps its photo/video background.

**Polish / maintenance**
- All sections run IntersectionObserver-based entrance animations (one-shot, ease-out).
- Workflow notes: typecheck via `pnpm --filter @workspace/krish-portfolio run typecheck`; dev server on `PORT=5173 BASE_PATH=/`.
- Fixed dead CSS, removed unused principles styles, curated responsive breakpoints.

---

## Daily update policy
1. Append a new `### YYYY-MM-DD — <summary>` entry at the top of the **Daily Updates** list.
2. Keep every entry short but complete: what changed, where, and any verification done (typecheck/load).
3. Commit alongside the day's code changes with message `docs(PORTFOLIO): update work log`.
4. Push to `origin/main` after committing.