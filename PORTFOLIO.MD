# PORTFOLIO

**Owner:** Krish (KRRISH972)
**Repo:** https://github.com/KRRISH972/Krish-PORTFOLIO
**Stack:** React + TypeScript + Vite + Wouter + TanStack Query (pnpm workspace)

This file tracks every change made to the Krish Portfolio website.
It is updated **daily** — each working day gets a dated entry below,
so the full evolution of the site is visible at a glance.

---

## Daily Updates

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

**Verification**
- `pnpm --filter @workspace/krish-portfolio run typecheck` ✅ and production `vite build` ✅.

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