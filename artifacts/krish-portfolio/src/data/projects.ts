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
  const liveUrl = str(row.live_url).trim() || (legacyUrl && !isGithub(legacyUrl) && legacyUrl !== githubUrl ? legacyUrl : '');
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

// Starter content, used when Supabase isn't configured.
const starter = (name: string, description: string, url: string) => ({ name, description, url });

export const projects: Project[] = [
  starter('Fitness Temple', 'A fitness-themed website built to practice front-end structure, content hierarchy, and styling.', 'https://github.com/KRRISH972/FITNESS_TEMPLE'),
  starter('LinguaBridge', 'A language-learning and translation project exploring the small details that help communication travel.', 'https://github.com/KRRISH972/LINGUABRIDGE-'),
  starter('Memory Match Game', 'An interactive memory game built around logic, state changes, and event-driven programming.', 'https://github.com/KRRISH972/MEMORY-MATCH'),
  starter('Calculator', 'A functional calculator application focused on core programming logic and arithmetic operations.', ''),
  starter('M2F Gym Website', 'A clean gym and fitness business website designed to present services and information clearly.', ''),
].map((row, i) => projectFromRow(row, i));
