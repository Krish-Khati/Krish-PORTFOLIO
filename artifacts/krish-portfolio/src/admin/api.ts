import { blogPosts, type BlogPost } from '@/data/blog';
import { projects as seedProjects } from '@/data/projects';

/*
 * Admin data layer.
 *
 * Every screen in the admin panel talks to the data ONLY through the async functions below.
 * Right now they read/write a demo copy in this browser's localStorage. When Supabase is
 * connected, replace the body of each function with the matching Supabase query
 * (tables are described in supabase/schema.sql) — the screens will not need to change.
 */

export type PostStatus = 'draft' | 'published';
export type PostCategory = BlogPost['category'];
export const postCategories: PostCategory[] = ['Journey', 'Learning', 'Projects', 'AI', 'Marketing'];

export type AdminPost = BlogPost & { id: string; status: PostStatus; updatedAt: string };
export type AdminProject = { id: string; name: string; description: string; url: string; position: number };
export type AdminMessage = { id: string; name: string; email: string; message: string; createdAt: string; read: boolean };
export type SiteSettings = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  location: string;
  roles: string[];
  instagram: string;
  linkedin: string;
  youtube: string;
  github: string;
};

type Db = { posts: AdminPost[]; projects: AdminProject[]; messages: AdminMessage[]; settings: SiteSettings };

const KEY = 'krish-admin-demo-v1';

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const now = () => new Date().toISOString();

function seed(): Db {
  const daysAgo = (d: number, h = 10) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(h, 12, 0, 0);
    return t.toISOString();
  };
  return {
    posts: blogPosts.map((p) => ({ ...p, id: uid(), status: 'published', updatedAt: `${p.date}T10:00:00.000Z` })),
    projects: seedProjects.map((p, i) => ({ id: uid(), name: p.name, description: p.description, url: p.url, position: i })),
    messages: [
      { id: uid(), name: 'Sample: Riya Sharma', email: 'riya@example.com', message: 'Hi Krish! Loved the Memory Match game. Are you open to a short frontend internship this winter?', createdAt: daysAgo(0, 9), read: false },
      { id: uid(), name: 'Sample: Aman Verma', email: 'aman@example.com', message: 'Your portfolio animations are really clean. Could you help set up a simple landing page for my coaching centre?', createdAt: daysAgo(1, 16), read: false },
      { id: uid(), name: 'Sample: Neha Gupta', email: 'neha@example.com', message: 'Read your post about using AI tools without outsourcing your thinking — great point of view. Keep writing!', createdAt: daysAgo(4, 12), read: true },
    ],
    settings: {
      name: 'Krish',
      tagline: "I'm passionate about creating modern web experiences, exploring the power of AI and digital marketing, and building things that make an impact.",
      email: 'dhimankrish10@gmail.com',
      phone: '+91 93060 91154',
      location: 'Pundri, Kaithal, Haryana, India',
      roles: ['Web Developer', 'Digital Marketer', 'AI Enthusiast'],
      instagram: 'https://instagram.com',
      linkedin: 'https://www.linkedin.com',
      youtube: 'https://youtube.com',
      github: 'https://github.com/KRRISH972',
    },
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* storage blocked or corrupt — fall back to fresh demo data */
  }
  const db = seed();
  persist(db);
  return db;
}

function persist(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage unavailable — changes live only for this page load */
  }
}

let cache: Db | null = null;
const db = () => (cache ??= load());
const commit = () => persist(db());

// Small delay so loading states behave the same as they will with a real network.
const delay = <T,>(value: T, ms = 180) => new Promise<T>((r) => setTimeout(() => r(structuredClone(value)), ms));

export const isSupabaseConnected = false;

/* ---------- Posts ---------- */

export function listPosts() {
  return delay([...db().posts].sort((a, b) => b.date.localeCompare(a.date)));
}

export function getPost(id: string) {
  return delay(db().posts.find((p) => p.id === id) ?? null);
}

export type PostInput = Omit<AdminPost, 'id' | 'updatedAt'> & { id?: string };

export async function savePost(input: PostInput) {
  const posts = db().posts;
  const clash = posts.find((p) => p.slug === input.slug && p.id !== input.id);
  if (clash) throw new Error(`Another post already uses the URL "${input.slug}".`);
  const record: AdminPost = { ...input, id: input.id ?? uid(), updatedAt: now() };
  const i = posts.findIndex((p) => p.id === record.id);
  if (i >= 0) posts[i] = record;
  else posts.push(record);
  commit();
  return delay(record);
}

export function deletePost(id: string) {
  db().posts = db().posts.filter((p) => p.id !== id);
  commit();
  return delay(true);
}

/* ---------- Projects ---------- */

export function listProjects() {
  return delay([...db().projects].sort((a, b) => a.position - b.position));
}

export function saveProject(input: Omit<AdminProject, 'id' | 'position'> & { id?: string }) {
  const list = db().projects;
  const existing = input.id ? list.find((p) => p.id === input.id) : undefined;
  if (existing) Object.assign(existing, input);
  else list.push({ ...input, id: uid(), position: list.length ? Math.max(...list.map((p) => p.position)) + 1 : 0 });
  commit();
  return delay(true);
}

export function moveProject(id: string, direction: -1 | 1) {
  const list = [...db().projects].sort((a, b) => a.position - b.position);
  const i = list.findIndex((p) => p.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length) {
    const a = list[i].position;
    list[i].position = list[j].position;
    list[j].position = a;
    commit();
  }
  return delay(true, 60);
}

export function deleteProject(id: string) {
  db().projects = db().projects.filter((p) => p.id !== id);
  commit();
  return delay(true);
}

/* ---------- Messages ---------- */

export function listMessages() {
  return delay([...db().messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function setMessageRead(id: string, read: boolean) {
  const m = db().messages.find((x) => x.id === id);
  if (m) m.read = read;
  commit();
  return delay(true, 60);
}

export function deleteMessage(id: string) {
  db().messages = db().messages.filter((m) => m.id !== id);
  commit();
  return delay(true);
}

/* ---------- Settings ---------- */

export function getSettings() {
  return delay(db().settings);
}

export function saveSettings(settings: SiteSettings) {
  db().settings = settings;
  commit();
  return delay(true);
}

/* ---------- Demo helpers ---------- */

export function resetDemoData() {
  cache = seed();
  commit();
  return delay(true);
}
