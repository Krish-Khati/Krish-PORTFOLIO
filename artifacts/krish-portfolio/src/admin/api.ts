import { blogPosts, type BlogPost } from '@/data/blog';
import { projects as seedProjects } from '@/data/projects';
import { supabase } from '@/lib/supabase';

/*
 * Admin data layer.
 *
 * Every screen in the admin panel talks to the data ONLY through the async functions below.
 * With Supabase configured (src/lib/supabase.ts) they query the tables in supabase/schema.sql;
 * without it they fall back to a demo copy in this browser's localStorage.
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

export const isSupabaseConnected = !!supabase;

/* ---------- Posts ---------- */

function demo_listPosts() {
  return delay([...db().posts].sort((a, b) => b.date.localeCompare(a.date)));
}

function demo_getPost(id: string) {
  return delay(db().posts.find((p) => p.id === id) ?? null);
}

export type PostInput = Omit<AdminPost, 'id' | 'updatedAt'> & { id?: string };

async function demo_savePost(input: PostInput) {
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

function demo_deletePost(id: string) {
  db().posts = db().posts.filter((p) => p.id !== id);
  commit();
  return delay(true);
}

/* ---------- Projects ---------- */

function demo_listProjects() {
  return delay([...db().projects].sort((a, b) => a.position - b.position));
}

function demo_saveProject(input: Omit<AdminProject, 'id' | 'position'> & { id?: string }) {
  const list = db().projects;
  const existing = input.id ? list.find((p) => p.id === input.id) : undefined;
  if (existing) Object.assign(existing, input);
  else list.push({ ...input, id: uid(), position: list.length ? Math.max(...list.map((p) => p.position)) + 1 : 0 });
  commit();
  return delay(true);
}

function demo_moveProject(id: string, direction: -1 | 1) {
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

function demo_deleteProject(id: string) {
  db().projects = db().projects.filter((p) => p.id !== id);
  commit();
  return delay(true);
}

/* ---------- Messages ---------- */

function demo_listMessages() {
  return delay([...db().messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

function demo_setMessageRead(id: string, read: boolean) {
  const m = db().messages.find((x) => x.id === id);
  if (m) m.read = read;
  commit();
  return delay(true, 60);
}

function demo_deleteMessage(id: string) {
  db().messages = db().messages.filter((m) => m.id !== id);
  commit();
  return delay(true);
}

/* ---------- Settings ---------- */

function demo_getSettings() {
  return delay(db().settings);
}

function demo_saveSettings(settings: SiteSettings) {
  db().settings = settings;
  commit();
  return delay(true);
}

/* ---------- Demo helpers ---------- */

export function resetDemoData() {
  if (supabase) throw new Error('Reset is only available in demo mode.');
  cache = seed();
  commit();
  return delay(true);
}

/* ================= Supabase ================= */

type PostRow = {
  id: string; slug: string; title: string; excerpt: string; category: PostCategory;
  date: string; status: PostStatus; blocks: AdminPost['blocks']; updated_at: string;
};
type MessageRow = { id: string; name: string; email: string; message: string; created_at: string; read: boolean };

const toPost = (r: PostRow): AdminPost => ({
  id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, category: r.category,
  date: r.date, status: r.status, blocks: r.blocks, updatedAt: r.updated_at,
});
const toMessage = (r: MessageRow): AdminMessage => ({
  id: r.id, name: r.name, email: r.email, message: r.message, createdAt: r.created_at, read: r.read,
});

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const sb = () => supabase!;

const remote = {
  async listPosts() {
    const rows = check(await sb().from('posts').select('*').order('date', { ascending: false }));
    return (rows as PostRow[]).map(toPost);
  },
  async getPost(id: string) {
    const row = check(await sb().from('posts').select('*').eq('id', id).maybeSingle());
    return row ? toPost(row as PostRow) : null;
  },
  async savePost(input: PostInput) {
    const { id, ...rest } = input;
    const payload = { ...rest, updated_at: now() };
    const res = id
      ? await sb().from('posts').update(payload).eq('id', id).select().single()
      : await sb().from('posts').insert(payload).select().single();
    if (res.error?.code === '23505') throw new Error(`Another post already uses the URL "${input.slug}".`);
    return toPost(check(res) as PostRow);
  },
  async deletePost(id: string) {
    check(await sb().from('posts').delete().eq('id', id));
    return true;
  },
  async listProjects() {
    return check(await sb().from('projects').select('*').order('position')) as AdminProject[];
  },
  async saveProject(input: Omit<AdminProject, 'id' | 'position'> & { id?: string }) {
    const { id, ...rest } = input;
    if (id) {
      check(await sb().from('projects').update(rest).eq('id', id));
    } else {
      const last = check(await sb().from('projects').select('position').order('position', { ascending: false }).limit(1));
      const top = (last ?? []) as { position: number }[];
      const position = top.length ? top[0].position + 1 : 0;
      check(await sb().from('projects').insert({ ...rest, position }));
    }
    return true;
  },
  async moveProject(id: string, direction: -1 | 1) {
    const list = await remote.listProjects();
    const i = list.findIndex((p) => p.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return true;
    const [a, b] = await Promise.all([
      sb().from('projects').update({ position: list[j].position }).eq('id', list[i].id),
      sb().from('projects').update({ position: list[i].position }).eq('id', list[j].id),
    ]);
    check(a);
    check(b);
    return true;
  },
  async deleteProject(id: string) {
    check(await sb().from('projects').delete().eq('id', id));
    return true;
  },
  async listMessages() {
    const rows = check(await sb().from('messages').select('*').order('created_at', { ascending: false }));
    return (rows as MessageRow[]).map(toMessage);
  },
  async setMessageRead(id: string, read: boolean) {
    check(await sb().from('messages').update({ read }).eq('id', id));
    return true;
  },
  async deleteMessage(id: string) {
    check(await sb().from('messages').delete().eq('id', id));
    return true;
  },
  async getSettings(): Promise<SiteSettings> {
    const row = check(await sb().from('site_settings').select('data').eq('id', 1).maybeSingle());
    return { ...seed().settings, ...((row as { data: Partial<SiteSettings> } | null)?.data ?? {}) };
  },
  async saveSettings(settings: SiteSettings) {
    check(await sb().from('site_settings').upsert({ id: 1, data: settings }));
    return true;
  },
};

/* ================= Public API ================= */

export const listPosts = () => (supabase ? remote.listPosts() : demo_listPosts());
export const getPost = (id: string) => (supabase ? remote.getPost(id) : demo_getPost(id));
export const savePost = (input: PostInput) => (supabase ? remote.savePost(input) : demo_savePost(input));
export const deletePost = (id: string) => (supabase ? remote.deletePost(id) : demo_deletePost(id));
export const listProjects = () => (supabase ? remote.listProjects() : demo_listProjects());
export const saveProject = (input: Omit<AdminProject, 'id' | 'position'> & { id?: string }) =>
  supabase ? remote.saveProject(input) : demo_saveProject(input);
export const moveProject = (id: string, direction: -1 | 1) =>
  supabase ? remote.moveProject(id, direction) : demo_moveProject(id, direction);
export const deleteProject = (id: string) => (supabase ? remote.deleteProject(id) : demo_deleteProject(id));
export const listMessages = () => (supabase ? remote.listMessages() : demo_listMessages());
export const setMessageRead = (id: string, read: boolean) =>
  supabase ? remote.setMessageRead(id, read) : demo_setMessageRead(id, read);
export const deleteMessage = (id: string) => (supabase ? remote.deleteMessage(id) : demo_deleteMessage(id));
export const getSettings = () => (supabase ? remote.getSettings() : demo_getSettings());
export const saveSettings = (settings: SiteSettings) =>
  supabase ? remote.saveSettings(settings) : demo_saveSettings(settings);

export const defaultSettings = () => seed().settings;
