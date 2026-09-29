import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { blogPosts, type BlogPost, postFromRow, withCover } from './blog';
import { projectFromRow, projects as staticProjects, type Project } from './projects';
import { defaultPublicSettings, type PublicSettings } from './settings';
import { stats as staticStats, type Stat, tools as staticTools, type Tool } from './skills';
import { defaultTicker, type Ticker, tickerFromRows } from './ticker';

export { defaultPublicSettings, type PublicSettings };

/*
 * Public-site data. With Supabase configured, content comes from the database (what the admin
 * panel edits). Without it, the static files in src/data are used.
 */

const staticPosts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date)).map(withCover);

export function usePublishedPosts() {
  return useQuery({
    queryKey: ['public', 'posts'],
    queryFn: async (): Promise<BlogPost[]> => {
      if (!supabase) return staticPosts;
      const { data, error } = await supabase
        .from('posts')
        .select('*') // '*' so the query keeps working whether or not optional columns (cover, SEO fields) exist yet
        .eq('status', 'published')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data as Record<string, unknown>[]).map((row) => withCover(postFromRow(row)));
    },
    initialData: supabase ? undefined : staticPosts,
    staleTime: 60_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['public', 'projects'],
    queryFn: async (): Promise<Project[]> => {
      if (!supabase) return staticProjects;
      // '*' so this keeps working whether or not the optional columns (add-project-details.sql) exist yet
      const { data, error } = await supabase.from('projects').select('*').order('position');
      if (error) throw error;
      return (data as Record<string, unknown>[]).map(projectFromRow);
    },
    initialData: supabase ? undefined : staticProjects,
    staleTime: 60_000,
  });
}

// Tools/stats fall back to the static list on ANY failure (including the "tools"/"stats"
// tables not existing yet) so the "My Capabilities" section is never empty.
export function useTools() {
  return useQuery({
    queryKey: ['public', 'tools'],
    queryFn: async (): Promise<Tool[]> => {
      if (!supabase) return staticTools;
      try {
        const { data, error } = await supabase.from('tools').select('id, name, logo_url').order('sort_order');
        if (error) throw error;
        const rows = data as { id: string; name: string; logo_url: string }[];
        return rows.length ? rows.map((r) => ({ id: r.id, name: r.name, logoUrl: r.logo_url ?? '' })) : staticTools;
      } catch {
        return staticTools;
      }
    },
    initialData: supabase ? undefined : staticTools,
    staleTime: 60_000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['public', 'stats'],
    queryFn: async (): Promise<Stat[]> => {
      if (!supabase) return staticStats;
      try {
        const { data, error } = await supabase.from('stats').select('id, value, label').order('sort_order');
        if (error) throw error;
        const rows = data as { id: string; value: string; label: string }[];
        return rows.length ? rows : staticStats;
      } catch {
        return staticStats;
      }
    },
    initialData: supabase ? undefined : staticStats,
    staleTime: 60_000,
  });
}

// The hero ticker falls back to the default items on ANY failure (including the ticker tables
// not existing yet). The defaults stand in while loading so the band keeps its height.
export function useTicker() {
  return useQuery({
    queryKey: ['public', 'ticker'],
    queryFn: async (): Promise<Ticker> => {
      if (!supabase) return defaultTicker;
      try {
        const items = await supabase.from('ticker_items').select('id, label').order('sort_order');
        if (items.error) throw items.error;
        return tickerFromRows(items.data ?? []);
      } catch {
        return defaultTicker;
      }
    },
    initialData: supabase ? undefined : defaultTicker,
    placeholderData: defaultTicker,
    staleTime: 60_000,
  });
}

export function useSiteSettings(): PublicSettings {
  const { data } = useQuery({
    queryKey: ['public', 'settings'],
    queryFn: async (): Promise<PublicSettings> => {
      if (!supabase) return defaultPublicSettings;
      const { data, error } = await supabase.from('site_settings').select('data').eq('id', 1).maybeSingle();
      if (error) throw error;
      return { ...defaultPublicSettings, ...((data?.data as Partial<PublicSettings>) ?? {}) };
    },
    staleTime: 60_000,
  });
  return data ?? defaultPublicSettings;
}

/** Saves a contact-form message to the admin inbox. Returns false when Supabase isn't configured. */
export async function sendContactMessage(input: { name: string; email: string; message: string }) {
  if (!supabase) return false;
  const { error } = await supabase.from('messages').insert(input);
  if (error) throw error;
  return true;
}
