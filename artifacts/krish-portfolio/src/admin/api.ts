import { blogPosts, type BlogPost, postFromRow } from '@/data/blog';
import { type Project, projectFromRow, projects as seedProjects } from '@/data/projects';
import { tools as seedTools, stats as seedStats } from '@/data/skills';
import { defaultTicker, type Ticker, type TickerIcon, toTickerIcon } from '@/data/ticker';
import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

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
export type AdminProject = Omit<Project, 'number'> & { id: string; position: number };
export type ProjectInput = Omit<AdminProject, 'id' | 'position' | 'updatedAt'> & { id?: string };
/** A saved project; `warning` is set when some columns couldn't be saved yet (SQL file not run). */
export type SavedProject = AdminProject & { warning?: string };
export type AdminTool = { id: string; name: string; logoUrl: string; position: number };
export type AdminStat = { id: string; value: string; label: string; position: number };
/** Ticker items as the admin edits them; items without an `id` are new. */
export type TickerInput = { items: { id?: string; label: string; icon: TickerIcon }[]; showSecondRow: boolean; secondRow: string[] };
export type AdminMessage = { id: string; name: string; email: string; message: string; createdAt: string; read: boolean };
export type TopicStatus = 'pending' | 'used';
export type AdminTopic = { id: string; title: string; notes: string; category: PostCategory; status: TopicStatus; position: number };
export type AutoPostSettings = { publishAutomatically: boolean };
export type AdminAutoRun = { id: string; ranAt: string; topic: string; status: 'success' | 'failed'; message: string };
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
  heroImage: string;
  aboutPhoto: string;
};

// Demo projects are kept as database-shaped rows, so they go through the same projectFromRow()
// mapping as Supabase rows (and older demo data in localStorage keeps working).
type ProjectRow = Record<string, unknown> & { id: string; position: number };

type Db = {
  posts: AdminPost[]; projects: ProjectRow[]; tools: AdminTool[]; stats: AdminStat[];
  messages: AdminMessage[]; settings: SiteSettings;
  topics: AdminTopic[]; autoPostSettings: AutoPostSettings; autoRuns: AdminAutoRun[];
  ticker?: Ticker; // missing in demo data saved before the ticker was editable
};

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
    projects: seedProjects.map((p, i) => ({ id: uid(), ...projectPayload({ ...p }), position: i })),
    tools: seedTools.map((t, i) => ({ id: uid(), name: t.name, logoUrl: t.logoUrl, position: i })),
    stats: seedStats.map((s, i) => ({ id: uid(), value: s.value, label: s.label, position: i })),
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
      heroImage: '',
      aboutPhoto: '',
    },
    topics: [],
    autoPostSettings: { publishAutomatically: false },
    autoRuns: [],
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
/** A saved post; `warning` is set when some optional columns couldn't be saved yet. */
export type SavedPost = AdminPost & { warning?: string };

async function demo_savePost(input: PostInput): Promise<SavedPost> {
  const posts = db().posts;
  const clash = posts.find((p) => p.slug === input.slug && p.id !== input.id);
  if (clash) throw new Error(`Another post already uses the URL "${input.slug}".`);
  const { updatedAt: _ignored, ...fields } = input as PostInput & { updatedAt?: string };
  const record: AdminPost = { ...fields, id: input.id ?? uid(), updatedAt: now() };
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

const toAdminProject = (row: Record<string, unknown>, index: number): AdminProject => {
  const { number: _n, ...p } = projectFromRow(row, index);
  return { ...p, id: String(row.id), position: typeof row.position === 'number' ? row.position : index };
};

/** The database columns for a project. `url`/`image` keep the older single link/thumbnail in sync. */
function projectPayload(input: Omit<ProjectInput, 'id'>): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description,
    slug: input.slug,
    badge: input.badge,
    long_description: input.writeup,
    features: input.features,
    tech_stack: input.techStack,
    live_url: input.liveUrl,
    github_url: input.githubUrl,
    play_store_url: input.playStoreUrl,
    video_url: input.videoUrl,
    featured: input.featured,
    meta_description: input.metaDescription,
    gallery: input.gallery,
    url: input.githubUrl || input.liveUrl || input.playStoreUrl,
    image: input.gallery[0]?.url ?? '',
    updated_at: now(),
  };
}

function demo_listProjects() {
  return delay([...db().projects].sort((a, b) => a.position - b.position).map(toAdminProject));
}

async function demo_saveProject(input: ProjectInput): Promise<SavedProject> {
  const list = db().projects;
  const clash = list.find((p) => p.id !== input.id && projectFromRow(p, 0).slug === input.slug);
  if (clash) throw new Error(`Another project already uses the URL /projects/${input.slug}.`);
  const payload = projectPayload(input);
  let row = input.id ? list.find((p) => p.id === input.id) : undefined;
  if (row) Object.assign(row, payload);
  else {
    row = { ...payload, id: uid(), position: list.length ? Math.max(...list.map((p) => p.position)) + 1 : 0 };
    list.push(row);
  }
  commit();
  return delay(toAdminProject(row, 0));
}

function demo_setProjectPosition(id: string, index: number) {
  const list = [...db().projects].sort((a, b) => a.position - b.position);
  const from = list.findIndex((p) => p.id === id);
  if (from >= 0) {
    const [moved] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(index, list.length)), 0, moved);
    list.forEach((p, i) => { p.position = i; });
    commit();
  }
  return delay(true, 60);
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

/* ---------- Tools ---------- */

function demo_listTools() {
  return delay([...db().tools].sort((a, b) => a.position - b.position));
}

function demo_saveTool(input: Omit<AdminTool, 'id' | 'position'> & { id?: string }) {
  const list = db().tools;
  const existing = input.id ? list.find((t) => t.id === input.id) : undefined;
  if (existing) Object.assign(existing, input);
  else list.push({ ...input, id: uid(), position: list.length ? Math.max(...list.map((t) => t.position)) + 1 : 0 });
  commit();
  return delay(true);
}

function demo_moveTool(id: string, direction: -1 | 1) {
  const list = [...db().tools].sort((a, b) => a.position - b.position);
  const i = list.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length) {
    const a = list[i].position;
    list[i].position = list[j].position;
    list[j].position = a;
    commit();
  }
  return delay(true, 60);
}

function demo_deleteTool(id: string) {
  db().tools = db().tools.filter((t) => t.id !== id);
  commit();
  return delay(true);
}

/* ---------- Stats ---------- */

function demo_listStats() {
  return delay([...db().stats].sort((a, b) => a.position - b.position));
}

function demo_saveStat(input: Omit<AdminStat, 'id' | 'position'> & { id?: string }) {
  const list = db().stats;
  const existing = input.id ? list.find((s) => s.id === input.id) : undefined;
  if (existing) Object.assign(existing, input);
  else list.push({ ...input, id: uid(), position: list.length ? Math.max(...list.map((s) => s.position)) + 1 : 0 });
  commit();
  return delay(true);
}

function demo_moveStat(id: string, direction: -1 | 1) {
  const list = [...db().stats].sort((a, b) => a.position - b.position);
  const i = list.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length) {
    const a = list[i].position;
    list[i].position = list[j].position;
    list[j].position = a;
    commit();
  }
  return delay(true, 60);
}

function demo_deleteStat(id: string) {
  db().stats = db().stats.filter((s) => s.id !== id);
  commit();
  return delay(true);
}

/* ---------- Auto post topics ---------- */

function demo_listTopics() {
  return delay([...db().topics].sort((a, b) => a.position - b.position));
}

function demo_saveTopic(input: Omit<AdminTopic, 'id' | 'position' | 'status'> & { id?: string; status?: TopicStatus }) {
  const list = db().topics;
  const existing = input.id ? list.find((t) => t.id === input.id) : undefined;
  if (existing) Object.assign(existing, input);
  else list.push({ ...input, status: input.status ?? 'pending', id: uid(), position: list.length ? Math.max(...list.map((t) => t.position)) + 1 : 0 });
  commit();
  return delay(true);
}

function demo_moveTopic(id: string, direction: -1 | 1) {
  const list = [...db().topics].sort((a, b) => a.position - b.position);
  const i = list.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length) {
    const a = list[i].position;
    list[i].position = list[j].position;
    list[j].position = a;
    commit();
  }
  return delay(true, 60);
}

function demo_deleteTopic(id: string) {
  db().topics = db().topics.filter((t) => t.id !== id);
  commit();
  return delay(true);
}

/* ---------- Auto post settings & runs ---------- */

function demo_getAutoPostSettings() {
  return delay(db().autoPostSettings);
}

function demo_saveAutoPostSettings(settings: AutoPostSettings) {
  db().autoPostSettings = settings;
  commit();
  return delay(true);
}

function demo_listAutoRuns() {
  return delay([...db().autoRuns].sort((a, b) => b.ranAt.localeCompare(a.ranAt)));
}

/* ---------- Ticker ---------- */

function demo_getTicker() {
  return delay(db().ticker ?? defaultTicker);
}

function demo_saveTicker(input: TickerInput) {
  db().ticker = { ...input, items: input.items.map((i) => ({ ...i, id: i.id ?? uid() })) };
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
  date: string; status: PostStatus; blocks: AdminPost['blocks']; updated_at: string; cover?: string | null;
  // Optional until supabase/add-seo.sql has been run.
  seo_title?: string | null; meta_description?: string | null; focus_keyword?: string | null;
  faqs?: unknown; cover_alt?: string | null;
};
type MessageRow = { id: string; name: string; email: string; message: string; created_at: string; read: boolean };
type ToolRow = { id: string; name: string; logo_url: string; sort_order: number };
type StatRow = { id: string; value: string; label: string; sort_order: number };
type TopicRow = { id: string; title: string; notes: string; category: PostCategory; status: TopicStatus; position: number };
type AutoPostSettingsRow = { publish_automatically: boolean };
type AutoRunRow = { id: string; ran_at: string; topic: string; status: 'success' | 'failed'; message: string };

const toPost = (r: PostRow): AdminPost => ({
  ...postFromRow(r as unknown as Record<string, unknown>),
  id: r.id, status: r.status, updatedAt: r.updated_at,
});
const toMessage = (r: MessageRow): AdminMessage => ({
  id: r.id, name: r.name, email: r.email, message: r.message, createdAt: r.created_at, read: r.read,
});
const toTool = (r: ToolRow): AdminTool => ({ id: r.id, name: r.name, logoUrl: r.logo_url ?? '', position: r.sort_order });
const toStat = (r: StatRow): AdminStat => ({ id: r.id, value: r.value, label: r.label, position: r.sort_order });
const toTopic = (r: TopicRow): AdminTopic => ({ id: r.id, title: r.title, notes: r.notes ?? '', category: r.category, status: r.status, position: r.position });
const toRun = (r: AutoRunRow): AdminAutoRun => ({ id: r.id, ranAt: r.ran_at, topic: r.topic, status: r.status, message: r.message ?? '' });

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// "tools"/"stats" ship in add-tools-and-stats.sql, which older Supabase projects haven't run yet.
function checkSkillsTable<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === '42P01' || /relation .* does not exist/i.test(res.error.message)) {
      throw new Error('Skills data isn’t set up in the database yet. Run supabase/add-tools-and-stats.sql in the Supabase SQL editor.');
    }
    throw new Error(res.error.message);
  }
  return res.data;
}

// Auto-post tables ship in add-auto-posts.sql, which older Supabase projects haven't run yet.
function checkAutoPostsTable<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === '42P01' || /relation .* does not exist/i.test(res.error.message)) {
      throw new Error('Auto posts isn’t set up in the database yet. Run supabase/add-auto-posts.sql in the Supabase SQL editor.');
    }
    throw new Error(res.error.message);
  }
  return res.data;
}

// Ticker tables ship in add-ticker.sql, which older Supabase projects haven't run yet.
// PostgREST reports a missing table as PGRST205; Postgres itself as 42P01.
function checkTickerTable<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === '42P01' || res.error.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(res.error.message)) {
      throw new Error('The ticker isn’t set up in the database yet. Run supabase/add-ticker.sql in the Supabase SQL editor.');
    }
    throw new Error(res.error.message);
  }
  return res.data;
}

const sb = () => supabase!;

// Columns added by later SQL files; saving works without them (with a warning).
const OPTIONAL_POST_COLUMNS = ['cover', 'seo_title', 'meta_description', 'focus_keyword', 'faqs', 'cover_alt'];
// Everything add-project-details.sql adds (only name/description/url/position are original).
const OPTIONAL_PROJECT_COLUMNS = [
  'image', 'slug', 'badge', 'long_description', 'features', 'tech_stack', 'live_url', 'github_url',
  'play_store_url', 'video_url', 'featured', 'meta_description', 'gallery', 'updated_at',
];

// PostgREST: "Could not find the 'seo_title' column of 'posts' in the schema cache" (PGRST204);
// Postgres: 'column "seo_title" of relation "posts" does not exist' (42703).
function missingColumn(message: string) {
  return message.match(/Could not find the '(\w+)' column/i)?.[1] ?? message.match(/column "?(\w+)"? (?:of relation "?\w+"? )?does not exist/i)?.[1];
}

const remote = {
  async listPosts() {
    const rows = check(await sb().from('posts').select('*').order('date', { ascending: false }));
    return (rows as PostRow[]).map(toPost);
  },
  async getPost(id: string) {
    const row = check(await sb().from('posts').select('*').eq('id', id).maybeSingle());
    return row ? toPost(row as PostRow) : null;
  },
  async savePost(input: PostInput): Promise<SavedPost> {
    const { id } = input;
    const payload: Record<string, unknown> = {
      slug: input.slug, title: input.title, excerpt: input.excerpt, category: input.category,
      date: input.date, status: input.status, blocks: input.blocks, cover: input.cover ?? '', updated_at: now(),
    };
    // SEO fields are only written when the caller provides them, so an older caller can never blank them.
    if (input.seoTitle !== undefined) payload.seo_title = input.seoTitle;
    if (input.metaDescription !== undefined) payload.meta_description = input.metaDescription;
    if (input.focusKeyword !== undefined) payload.focus_keyword = input.focusKeyword;
    if (input.faqs !== undefined) payload.faqs = input.faqs;
    if (input.coverAlt !== undefined) payload.cover_alt = input.coverAlt;

    // A column that doesn't exist yet (SQL file not run) is dropped with a warning instead of
    // failing the whole save — the post itself still saves.
    const skipped: string[] = [];
    for (;;) {
      const res = id
        ? await sb().from('posts').update(payload).eq('id', id).select().single()
        : await sb().from('posts').insert(payload).select().single();
      if (res.error?.code === '23505') throw new Error(`Another post already uses the URL "${input.slug}".`);
      const missing = res.error ? missingColumn(res.error.message) : undefined;
      if (missing && missing in payload && OPTIONAL_POST_COLUMNS.includes(missing)) {
        console.warn(`[posts] Column "${missing}" doesn't exist yet — saving without it.`);
        delete payload[missing];
        skipped.push(missing);
        continue;
      }
      const post: SavedPost = toPost(check(res) as PostRow);
      if (skipped.length) {
        const file = skipped.every((c) => c === 'cover') ? 'add-post-covers.sql' : 'add-seo.sql';
        post.warning = `Saved, but without ${skipped.join(', ')} — run supabase/${file} in the Supabase SQL editor.`;
      }
      return post;
    }
  },
  async deletePost(id: string) {
    check(await sb().from('posts').delete().eq('id', id));
    return true;
  },
  async listProjects() {
    // '*' so this keeps working whether or not the add-project-details.sql columns exist yet
    const rows = check(await sb().from('projects').select('*').order('position'));
    return (rows as Record<string, unknown>[]).map(toAdminProject);
  },
  async saveProject(input: ProjectInput): Promise<SavedProject> {
    const { id } = input;
    const payload = projectPayload(input);
    if (!id) {
      const last = check(await sb().from('projects').select('position').order('position', { ascending: false }).limit(1));
      const top = (last ?? []) as { position: number }[];
      payload.position = top.length ? top[0].position + 1 : 0;
    }

    // A column that doesn't exist yet (SQL file not run) is dropped with a warning instead of
    // failing the whole save — the project itself still saves.
    const skipped: string[] = [];
    for (;;) {
      const res = id
        ? await sb().from('projects').update(payload).eq('id', id).select().single()
        : await sb().from('projects').insert(payload).select().single();
      if (res.error?.code === '23505') throw new Error(`Another project already uses the URL /projects/${input.slug}.`);
      const missing = res.error ? missingColumn(res.error.message) : undefined;
      if (missing && missing in payload && OPTIONAL_PROJECT_COLUMNS.includes(missing)) {
        console.warn(`[projects] Column "${missing}" doesn't exist yet — saving without it.`);
        delete payload[missing];
        skipped.push(missing);
        continue;
      }
      const saved: SavedProject = toAdminProject(check(res) as Record<string, unknown>, 0);
      if (skipped.length) {
        saved.warning = `Saved, but without ${skipped.join(', ')} — run supabase/add-project-details.sql in the Supabase SQL editor, then save again.`;
      }
      return saved;
    }
  },
  async setProjectPosition(id: string, index: number) {
    const list = await remote.listProjects();
    const from = list.findIndex((p) => p.id === id);
    if (from < 0) return true;
    const [moved] = list.splice(from, 1);
    list.splice(Math.max(0, Math.min(index, list.length)), 0, moved);
    const changes = list.map((p, i) => (p.position === i ? null : sb().from('projects').update({ position: i }).eq('id', p.id))).filter(Boolean);
    (await Promise.all(changes)).forEach((r) => check(r!));
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
  async listTools() {
    const rows = checkSkillsTable(await sb().from('tools').select('*').order('sort_order'));
    return (rows as ToolRow[]).map(toTool);
  },
  async saveTool(input: Omit<AdminTool, 'id' | 'position'> & { id?: string }) {
    const { id, name, logoUrl } = input;
    const payload = { name, logo_url: logoUrl };
    if (id) {
      checkSkillsTable(await sb().from('tools').update(payload).eq('id', id));
    } else {
      const last = checkSkillsTable(await sb().from('tools').select('sort_order').order('sort_order', { ascending: false }).limit(1));
      const top = (last ?? []) as { sort_order: number }[];
      const sort_order = top.length ? top[0].sort_order + 1 : 0;
      checkSkillsTable(await sb().from('tools').insert({ ...payload, sort_order }));
    }
    return true;
  },
  async moveTool(id: string, direction: -1 | 1) {
    const list = await remote.listTools();
    const i = list.findIndex((t) => t.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return true;
    const [a, b] = await Promise.all([
      sb().from('tools').update({ sort_order: list[j].position }).eq('id', list[i].id),
      sb().from('tools').update({ sort_order: list[i].position }).eq('id', list[j].id),
    ]);
    checkSkillsTable(a);
    checkSkillsTable(b);
    return true;
  },
  async deleteTool(id: string) {
    checkSkillsTable(await sb().from('tools').delete().eq('id', id));
    return true;
  },
  async listStats() {
    const rows = checkSkillsTable(await sb().from('stats').select('*').order('sort_order'));
    return (rows as StatRow[]).map(toStat);
  },
  async saveStat(input: Omit<AdminStat, 'id' | 'position'> & { id?: string }) {
    const { id, value, label } = input;
    const payload = { value, label };
    if (id) {
      checkSkillsTable(await sb().from('stats').update(payload).eq('id', id));
    } else {
      const last = checkSkillsTable(await sb().from('stats').select('sort_order').order('sort_order', { ascending: false }).limit(1));
      const top = (last ?? []) as { sort_order: number }[];
      const sort_order = top.length ? top[0].sort_order + 1 : 0;
      checkSkillsTable(await sb().from('stats').insert({ ...payload, sort_order }));
    }
    return true;
  },
  async moveStat(id: string, direction: -1 | 1) {
    const list = await remote.listStats();
    const i = list.findIndex((s) => s.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return true;
    const [a, b] = await Promise.all([
      sb().from('stats').update({ sort_order: list[j].position }).eq('id', list[i].id),
      sb().from('stats').update({ sort_order: list[i].position }).eq('id', list[j].id),
    ]);
    checkSkillsTable(a);
    checkSkillsTable(b);
    return true;
  },
  async deleteStat(id: string) {
    checkSkillsTable(await sb().from('stats').delete().eq('id', id));
    return true;
  },
  async listTopics() {
    const rows = checkAutoPostsTable(await sb().from('auto_post_topics').select('*').order('position'));
    return (rows as TopicRow[]).map(toTopic);
  },
  async saveTopic(input: Omit<AdminTopic, 'id' | 'position' | 'status'> & { id?: string; status?: TopicStatus }) {
    const { id, ...rest } = input;
    if (id) {
      checkAutoPostsTable(await sb().from('auto_post_topics').update(rest).eq('id', id));
    } else {
      const last = checkAutoPostsTable(await sb().from('auto_post_topics').select('position').order('position', { ascending: false }).limit(1));
      const top = (last ?? []) as { position: number }[];
      const position = top.length ? top[0].position + 1 : 0;
      checkAutoPostsTable(await sb().from('auto_post_topics').insert({ ...rest, status: rest.status ?? 'pending', position }));
    }
    return true;
  },
  async moveTopic(id: string, direction: -1 | 1) {
    const list = await remote.listTopics();
    const i = list.findIndex((t) => t.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return true;
    const [a, b] = await Promise.all([
      sb().from('auto_post_topics').update({ position: list[j].position }).eq('id', list[i].id),
      sb().from('auto_post_topics').update({ position: list[i].position }).eq('id', list[j].id),
    ]);
    checkAutoPostsTable(a);
    checkAutoPostsTable(b);
    return true;
  },
  async deleteTopic(id: string) {
    checkAutoPostsTable(await sb().from('auto_post_topics').delete().eq('id', id));
    return true;
  },
  async getAutoPostSettings(): Promise<AutoPostSettings> {
    const row = checkAutoPostsTable(await sb().from('auto_post_settings').select('publish_automatically').eq('id', 1).maybeSingle());
    return { publishAutomatically: (row as AutoPostSettingsRow | null)?.publish_automatically ?? false };
  },
  async saveAutoPostSettings(settings: AutoPostSettings) {
    checkAutoPostsTable(await sb().from('auto_post_settings').upsert({ id: 1, publish_automatically: settings.publishAutomatically }));
    return true;
  },
  async listAutoRuns() {
    const rows = checkAutoPostsTable(await sb().from('auto_post_runs').select('*').order('ran_at', { ascending: false }).limit(30));
    return (rows as AutoRunRow[]).map(toRun);
  },
  async getTicker(): Promise<Ticker> {
    const [items, settings] = await Promise.all([
      sb().from('ticker_items').select('id, label, icon').order('sort_order'),
      sb().from('ticker_settings').select('show_second_row, second_row').eq('id', 1).maybeSingle(),
    ]);
    const rows = checkTickerTable(items) as { id: string; label: string; icon: string }[];
    const s = checkTickerTable(settings) as { show_second_row: boolean; second_row: string[] } | null;
    return {
      items: rows.map((r) => ({ id: r.id, label: r.label, icon: toTickerIcon(r.icon) })),
      showSecondRow: s?.show_second_row ?? defaultTicker.showSecondRow,
      secondRow: s?.second_row ?? defaultTicker.secondRow,
    };
  },
  async saveTicker(input: TickerInput) {
    // Remove deleted items, then write every item's text/icon/order, then the second-row settings.
    const existing = checkTickerTable(await sb().from('ticker_items').select('id')) as { id: string }[];
    const kept = new Set(input.items.map((i) => i.id).filter(Boolean));
    const removed = existing.map((r) => r.id).filter((id) => !kept.has(id));
    if (removed.length) checkTickerTable(await sb().from('ticker_items').delete().in('id', removed));
    const rows = input.items.map((item, i) => ({ id: item.id, label: item.label, icon: item.icon, sort_order: i }));
    const updates = rows.filter((r) => r.id);
    const inserts = rows.filter((r) => !r.id).map(({ id: _new, ...r }) => r);
    if (updates.length) checkTickerTable(await sb().from('ticker_items').upsert(updates));
    if (inserts.length) checkTickerTable(await sb().from('ticker_items').insert(inserts));
    checkTickerTable(await sb().from('ticker_settings').upsert({ id: 1, show_second_row: input.showSecondRow, second_row: input.secondRow }));
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

/* ================= Images (post covers, hero/about photos, project images) ================= */

// Every image the admin uploads (post covers, the hero background, the about photo, project
// thumbnails) lands in this same public bucket — set up once in supabase/add-post-covers.sql.
const COVER_BUCKET = 'covers';
const MAX_COVER_MB = 5;
const MAX_DEMO_COVER_MB = 1; // demo mode keeps images in localStorage, which is small

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

// Uploads an image and returns the public URL to store wherever it's used (post cover,
// hero/about photo, project image, tool logo). `folder` groups uploads under a prefix
// (e.g. "tools") within the same bucket — purely organizational, no extra setup needed.
// `maxMB` overrides the default size cap (ignored in demo mode, which stays tiny for localStorage).
export async function uploadImage(file: File, folder = '', maxMB?: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP, SVG or GIF).');
  const limit = supabase ? (maxMB ?? MAX_COVER_MB) : MAX_DEMO_COVER_MB;
  if (file.size > limit * 1024 * 1024) throw new Error(`That image is over ${limit} MB. Please use a smaller one.`);
  if (!supabase) return readAsDataUrl(file);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder ? `${folder}/` : ''}${uid()}.${ext}`;
  const { error } = await sb().storage.from(COVER_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) {
    if (/bucket/i.test(error.message)) {
      throw new Error('Image uploads are not set up yet. Run supabase/add-post-covers.sql in the Supabase SQL editor.');
    }
    throw new Error(error.message);
  }
  return sb().storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export const uploadCover = uploadImage;

/* ---------- Project gallery uploads (per-file progress) ---------- */

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** The public URL prefix of the uploads bucket — images under it can be re-read by /api/alt-text. */
export const storagePublicPrefix = () => (supabase ? `${supabaseUrl}/storage/v1/object/public/${COVER_BUCKET}/` : '');

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the optimized image.'));
    reader.readAsDataURL(blob);
  });
}

function storageError(status: number, body: string) {
  let msg = body;
  try {
    const j = JSON.parse(body) as { message?: string; error?: string };
    msg = j.message || j.error || body;
  } catch { /* not JSON */ }
  if (/bucket not found/i.test(msg)) return 'The image storage bucket is missing. Run supabase/add-project-details.sql in the Supabase SQL editor.';
  if (/row-level security|unauthorized|not allowed/i.test(msg) || status === 403) {
    return 'Supabase refused the upload (storage permissions). Run supabase/add-project-details.sql, or sign in again.';
  }
  if (status === 413 || /too large|exceeded/i.test(msg)) return 'Supabase says the file is too large.';
  return `Upload failed (HTTP ${status}${msg ? `: ${msg.slice(0, 160)}` : ''}).`;
}

/**
 * Uploads a gallery file to Supabase Storage at `path` (inside the covers bucket) and returns its
 * public URL. Uses XHR instead of supabase-js so `onProgress` gets real 0–1 upload progress.
 * If the name is already taken, a short suffix is added. Demo mode returns a data URL instead.
 */
export async function uploadGalleryFile(blob: Blob, path: string, onProgress?: (fraction: number) => void): Promise<string> {
  if (!supabase) {
    if (blob.size > MAX_DEMO_COVER_MB * 1024 * 1024) throw new Error(`Demo mode keeps images in this browser — the limit is ${MAX_DEMO_COVER_MB} MB.`);
    onProgress?.(1);
    return blobToDataUrl(blob);
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your admin session has expired. Sign in again.');

  const send = (target: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/${COVER_BUCKET}/${encodePath(target)}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
      xhr.setRequestHeader('Cache-Control', 'max-age=31536000');
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new Error('Network error while uploading — check your connection and try again.'));
      xhr.ontimeout = () => reject(new Error('The upload timed out.'));
      xhr.timeout = 120_000;
      xhr.send(blob);
    });

  let target = path;
  let res = await send(target);
  if (res.status === 409 || /already exists|duplicate/i.test(res.body)) {
    target = path.replace(/(\.\w+)$/, `-${uid().slice(0, 4)}$1`);
    res = await send(target);
  }
  if (res.status < 200 || res.status >= 300) throw new Error(storageError(res.status, res.body));
  onProgress?.(1);
  return `${storagePublicPrefix()}${encodePath(target)}`;
}

export type AltTextResult = { ok: true; alt: string; model: string } | { ok: false; error: string };

/**
 * Asks the server (api/alt-text.ts) to write alt text for a screenshot with a vision model.
 * Send either a data URL (`image`) or the public URL of an image already in our storage.
 */
export async function requestAltText(input: {
  image?: string; imageUrl?: string; projectName: string; projectDescription: string;
}): Promise<AltTextResult> {
  if (!supabase) return { ok: false, error: 'Demo mode — AI alt text needs the live site.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Not signed in.' };
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/alt-text`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    if (!isJson) return { ok: false, error: 'The alt text endpoint only exists on the deployed site (not in local dev).' };
    const body = (await res.json().catch(() => ({}))) as { alt?: string; model?: string; error?: string };
    if (res.ok && body.alt) return { ok: true, alt: body.alt, model: body.model ?? '' };
    return { ok: false, error: body.error ?? `Alt text failed (HTTP ${res.status}).` };
  } catch {
    return { ok: false, error: 'Could not reach the alt text endpoint.' };
  }
}

/* ================= Public API ================= */

export const listPosts = () => (supabase ? remote.listPosts() : demo_listPosts());
export const getPost = (id: string) => (supabase ? remote.getPost(id) : demo_getPost(id));
export const savePost = (input: PostInput): Promise<SavedPost> => (supabase ? remote.savePost(input) : demo_savePost(input));
export const deletePost = (id: string) => (supabase ? remote.deletePost(id) : demo_deletePost(id));
export const listProjects = () => (supabase ? remote.listProjects() : demo_listProjects());
export const saveProject = (input: ProjectInput): Promise<SavedProject> =>
  supabase ? remote.saveProject(input) : demo_saveProject(input);
/** Moves a project to `index` (0 = first) in the display order. */
export const setProjectPosition = (id: string, index: number) =>
  supabase ? remote.setProjectPosition(id, index) : demo_setProjectPosition(id, index);
export const moveProject = (id: string, direction: -1 | 1) =>
  supabase ? remote.moveProject(id, direction) : demo_moveProject(id, direction);
export const deleteProject = (id: string) => (supabase ? remote.deleteProject(id) : demo_deleteProject(id));
export const listTools = () => (supabase ? remote.listTools() : demo_listTools());
export const saveTool = (input: Omit<AdminTool, 'id' | 'position'> & { id?: string }) =>
  supabase ? remote.saveTool(input) : demo_saveTool(input);
export const moveTool = (id: string, direction: -1 | 1) =>
  supabase ? remote.moveTool(id, direction) : demo_moveTool(id, direction);
export const deleteTool = (id: string) => (supabase ? remote.deleteTool(id) : demo_deleteTool(id));
export const listStats = () => (supabase ? remote.listStats() : demo_listStats());
export const saveStat = (input: Omit<AdminStat, 'id' | 'position'> & { id?: string }) =>
  supabase ? remote.saveStat(input) : demo_saveStat(input);
export const moveStat = (id: string, direction: -1 | 1) =>
  supabase ? remote.moveStat(id, direction) : demo_moveStat(id, direction);
export const deleteStat = (id: string) => (supabase ? remote.deleteStat(id) : demo_deleteStat(id));
export const listTopics = () => (supabase ? remote.listTopics() : demo_listTopics());
export const saveTopic = (input: Omit<AdminTopic, 'id' | 'position' | 'status'> & { id?: string; status?: TopicStatus }) =>
  supabase ? remote.saveTopic(input) : demo_saveTopic(input);
export const moveTopic = (id: string, direction: -1 | 1) =>
  supabase ? remote.moveTopic(id, direction) : demo_moveTopic(id, direction);
export const deleteTopic = (id: string) => (supabase ? remote.deleteTopic(id) : demo_deleteTopic(id));
export const getAutoPostSettings = () => (supabase ? remote.getAutoPostSettings() : demo_getAutoPostSettings());
export const saveAutoPostSettings = (settings: AutoPostSettings) =>
  supabase ? remote.saveAutoPostSettings(settings) : demo_saveAutoPostSettings(settings);
export const listAutoRuns = () => (supabase ? remote.listAutoRuns() : demo_listAutoRuns());
export const getTicker = () => (supabase ? remote.getTicker() : demo_getTicker());
export const saveTicker = (input: TickerInput) => (supabase ? remote.saveTicker(input) : demo_saveTicker(input));
export const listMessages = () => (supabase ? remote.listMessages() : demo_listMessages());
export const setMessageRead = (id: string, read: boolean) =>
  supabase ? remote.setMessageRead(id, read) : demo_setMessageRead(id, read);
export const deleteMessage = (id: string) => (supabase ? remote.deleteMessage(id) : demo_deleteMessage(id));
export const getSettings = () => (supabase ? remote.getSettings() : demo_getSettings());
export const saveSettings = (settings: SiteSettings) =>
  supabase ? remote.saveSettings(settings) : demo_saveSettings(settings);

export const defaultSettings = () => seed().settings;

/* ================= Site rebuild (prerendered pages, sitemap, RSS) ================= */

export type RebuildResult = { ok: boolean; message: string };

/**
 * Asks the server (api/rebuild.ts) to trigger the Vercel Deploy Hook so the public pages,
 * sitemap.xml and rss.xml pick up a published/changed/removed post. The hook URL itself never
 * reaches the browser; the server checks this admin's Supabase session first.
 */
export async function requestSiteRebuild(): Promise<RebuildResult> {
  if (!supabase) return { ok: false, message: 'Demo mode — the live site is not rebuilt.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: 'Not signed in, so the site was not rebuilt.' };
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/rebuild`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    if (!isJson) return { ok: false, message: 'The rebuild endpoint only exists on the deployed site (not in local dev).' };
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (res.ok) return { ok: true, message: body.message ?? 'Site rebuild started.' };
    return { ok: false, message: body.error ?? `Rebuild failed (HTTP ${res.status}).` };
  } catch {
    return { ok: false, message: 'Could not reach the rebuild endpoint.' };
  }
}
