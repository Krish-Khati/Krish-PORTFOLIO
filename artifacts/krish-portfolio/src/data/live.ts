import { useQuery } from '@tanstack/react-query';
import { insertRow, publicDbConfigured, selectRows } from '@/lib/public-db';
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
      if (!publicDbConfigured) return staticPosts;
      // select=* so the query keeps working whether or not optional columns (cover, SEO fields) exist yet
      const data = await selectRows('posts', { filters: { status: 'eq.published' }, order: 'date.desc' });
      return data.map((row) => withCover(postFromRow(row)));
    },
    initialData: publicDbConfigured ? undefined : staticPosts,
    staleTime: 60_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['public', 'projects'],
    queryFn: async (): Promise<Project[]> => {
      if (!publicDbConfigured) return staticProjects;
      // select=* so this keeps working whether or not the optional columns (add-project-details.sql) exist yet
      const data = await selectRows('projects', { order: 'position.asc' });
      return data.map(projectFromRow);
    },
    initialData: publicDbConfigured ? undefined : staticProjects,
    staleTime: 60_000,
  });
}

// Tools/stats fall back to the static list on ANY failure (including the "tools"/"stats"
// tables not existing yet) so the "My Capabilities" section is never empty.
export function useTools() {
  return useQuery({
    queryKey: ['public', 'tools'],
    queryFn: async (): Promise<Tool[]> => {
      if (!publicDbConfigured) return staticTools;
      try {
        const rows = await selectRows<{ id: string; name: string; logo_url: string }>('tools', { select: 'id,name,logo_url', order: 'sort_order.asc' });
        return rows.length ? rows.map((r) => ({ id: r.id, name: r.name, logoUrl: r.logo_url ?? '' })) : staticTools;
      } catch {
        return staticTools;
      }
    },
    initialData: publicDbConfigured ? undefined : staticTools,
    staleTime: 60_000,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['public', 'stats'],
    queryFn: async (): Promise<Stat[]> => {
      if (!publicDbConfigured) return staticStats;
      try {
        const rows = await selectRows<{ id: string; value: string; label: string }>('stats', { select: 'id,value,label', order: 'sort_order.asc' });
        return rows.length ? rows : staticStats;
      } catch {
        return staticStats;
      }
    },
    initialData: publicDbConfigured ? undefined : staticStats,
    staleTime: 60_000,
  });
}

// The hero ticker falls back to the default items on ANY failure (including the ticker tables
// not existing yet). The defaults stand in while loading so the band keeps its height.
export function useTicker() {
  return useQuery({
    queryKey: ['public', 'ticker'],
    queryFn: async (): Promise<Ticker> => {
      if (!publicDbConfigured) return defaultTicker;
      try {
        const items = await selectRows<{ id: string; label: string }>('ticker_items', { select: 'id,label', order: 'sort_order.asc' });
        return tickerFromRows(items);
      } catch {
        return defaultTicker;
      }
    },
    initialData: publicDbConfigured ? undefined : defaultTicker,
    placeholderData: defaultTicker,
    staleTime: 60_000,
  });
}

export function useSiteSettings(): PublicSettings {
  const { data } = useQuery({
    queryKey: ['public', 'settings'],
    queryFn: async (): Promise<PublicSettings> => {
      if (!publicDbConfigured) return defaultPublicSettings;
      const [row] = await selectRows<{ data: Partial<PublicSettings> | null }>('site_settings', { select: 'data', filters: { id: 'eq.1' } });
      return { ...defaultPublicSettings, ...(row?.data ?? {}) };
    },
    staleTime: 60_000,
  });
  return data ?? defaultPublicSettings;
}

/** Saves a contact-form message to the admin inbox. Returns false when Supabase isn't configured. */
export async function sendContactMessage(input: { name: string; email: string; message: string }) {
  if (!publicDbConfigured) return false;
  await insertRow('messages', input);
  return true;
}
