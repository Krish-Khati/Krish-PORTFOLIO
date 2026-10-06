import { slugify } from '../lib/text-blocks';

/*
 * Projects shown in "Things built to learn." (home), on /projects and on /projects/<slug>.
 * Relative imports only: the build-time prerender (scripts/prerender.ts) uses this file too.
 */

// `thumb` is a small copy made at upload time for the thumbnail row (older images don't have one).
export type GalleryImage = { url: string; alt: string; caption: string; width?: number; height?: number; thumb?: string };

export type Project = {
  number: string; // "01", "02", … — display order
  slug: string;
  name: string;
  badge: string; // e.g. "Flagship", "Live", "In progress" — empty for none
  description: string; // short, shown in the section
  writeup: string; // long write-up for /projects/<slug>, same simple formatting as blog posts
  features: string[];
  techStack: string[];
  liveUrl: string;
  githubUrl: string;
  playStoreUrl: string;
  videoUrl: string; // YouTube or a video file — shown as one gallery item
  featured: boolean;
  metaDescription: string;
  gallery: GalleryImage[]; // first image = cover
  updatedAt?: string;
};

export const BADGE_PRESETS = ['Flagship', 'Live', 'In progress'];

export const projectPath = (slug: string) => `/projects/${slug}`;

export const projectCover = (p: Pick<Project, 'gallery'>): GalleryImage | undefined => p.gallery[0];

/** Alt text for gallery image `i`, falling back to "<Project> screenshot <n>". */
export const imageAlt = (p: Pick<Project, 'name'>, img: GalleryImage, i: number) =>
  img.alt.trim() || `${p.name} screenshot ${i + 1}`;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strList = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean) : []);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined);

export function galleryFromJson(v: unknown): GalleryImage[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((g) => {
      const o = (g ?? {}) as Record<string, unknown>;
      return {
        url: str(o.url).trim(), alt: str(o.alt), caption: str(o.caption),
        width: num(o.width), height: num(o.height), thumb: str(o.thumb).trim() || undefined,
      };
    })
    .filter((g) => g.url);
}

const isGithub = (u: string) => /^https?:\/\/(www\.)?github\.com\//i.test(u);

/**
 * A database row → Project. Every column added by supabase/add-project-details.sql is optional,
 * so rows from before that file was run still work: the old single "url" becomes the GitHub or
 * live link, and the old single "image" becomes the first gallery image.
 */
export function projectFromRow(row: Record<string, unknown>, index: number): Project {
  const name = str(row.name);
  const legacyUrl = str(row.url).trim();
  const githubUrl = str(row.github_url).trim() || (isGithub(legacyUrl) ? legacyUrl : '');
  const rawLiveUrl = str(row.live_url).trim() || (legacyUrl && !isGithub(legacyUrl) && legacyUrl !== githubUrl ? legacyUrl : '');
  const liveUrl = rawLiveUrl === '#' ? '' : rawLiveUrl;
  let gallery = galleryFromJson(row.gallery);
  const legacyImage = str(row.image).trim();
  if (!gallery.length && legacyImage) gallery = [{ url: legacyImage, alt: '', caption: '' }];
  return {
    number: String(index + 1).padStart(2, '0'),
    slug: str(row.slug).trim() || slugify(name),
    name,
    badge: str(row.badge).trim(),
    description: str(row.description),
    writeup: str(row.long_description),
    features: strList(row.features),
    techStack: strList(row.tech_stack),
    liveUrl,
    githubUrl,
    playStoreUrl: str(row.play_store_url).trim(),
    videoUrl: str(row.video_url).trim(),
    featured: row.featured === true,
    metaDescription: str(row.meta_description),
    gallery,
    updatedAt: str(row.updated_at) || undefined,
  };
}

/** The projects for the home page section: the featured ones, or all of them if none are featured. */
export const homeProjects = (all: Project[]) => (all.some((p) => p.featured) ? all.filter((p) => p.featured) : all);

const shot = (url: string, alt: string, width: number, height: number): GalleryImage => ({ url, alt, caption: '', width, height });

type StarterRow = {
  name: string;
  description: string;
  meta_description?: string;
  github_url?: string;
  live_url?: string;
  tech_stack?: string[];
  gallery?: GalleryImage[];
};

// Starter content, used when Supabase isn't configured.
const starter: StarterRow[] = [
  {
    name: 'Fitness Temple',
    description:
      'A modern, high-energy gym website for "Fitness Temple" featuring a hero section, programs/disciplines showcase, stats bar (ratings, members, years active), and a sleek black-and-red themed UI with smooth navigation.',
    meta_description: 'Gym website design for Fitness Temple: hero section, programs showcase, stats bar and a sleek black-and-red themed UI.',
    github_url: 'https://github.com/KRRISH972/FITNESS_TEMPLE',
    live_url: 'https://fitness-temple-k0r76nt7c-kisshu1.vercel.app/',
    tech_stack: ['Web Design', 'Responsive Design', 'React', 'Gym Website', 'UI/UX'],
    gallery: [shot('/projects/fitness-temple.png', 'Fitness Temple - Gym Website Homepage Screenshot showing hero section and programs', 1440, 1000)],
  },
  {
    name: 'Memory Match Game',
    description:
      'An interactive memory-matching arcade game with a modern gradient UI, built with real-time audio components and an engaging "Launch Arcade" entry screen.',
    meta_description: 'Memory match game arcade with a modern gradient UI, real-time audio and an engaging "Launch Arcade" entry screen.',
    github_url: 'https://github.com/KRRISH972/MEMORY-MATCH',
    live_url: 'https://memory-match-ashy.vercel.app/',
    tech_stack: ['Game Development', 'JavaScript', 'Browser Game', 'UI/UX'],
    gallery: [shot('/projects/memory-match.png', 'Memory Match - Browser Based Memory Arcade Game Launch Screen', 1440, 1000)],
  },
  {
    name: 'LinguaBridge',
    description: 'An AI-powered language translation tool that bridges communication across languages using AI.',
    meta_description: 'AI language translator that bridges communication across languages using AI, built by Krish.',
    github_url: 'https://github.com/KRRISH972/LINGUABRIDGE-',
    live_url: 'https://linguabridge.ai.studio',
    tech_stack: ['AI', 'NLP', 'Translation', 'Web App'],
    gallery: [shot('/projects/linguabridge.png', 'LinguaBridge - AI Translation App Showing Text Translation and Voice Interpreter Panels', 1440, 1000)],
  },
  {
    name: 'Calculator',
    description:
      'A sleek, modern calculator app with a dark-themed UI, circular button design, and smooth interactions for basic arithmetic operations.',
    meta_description: 'Calculator app UI with a dark theme, circular buttons and smooth interactions for basic arithmetic operations.',
    live_url: '#',
    tech_stack: ['JavaScript', 'UI Design', 'Calculator App'],
    gallery: [shot('/projects/calculator.png', 'Calculator App - Dark Theme UI with Circular Buttons', 600, 333)],
  },
];

export const projects: Project[] = starter.map((row, i) => projectFromRow(row, i));
