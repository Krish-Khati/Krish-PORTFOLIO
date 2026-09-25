import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { blogPosts, type BlogPost, withCover } from './blog';
import { projects as staticProjects, type Project } from './projects';

/*
 * Public-site data. With Supabase configured, content comes from the database (what the admin
 * panel edits). Without it, the static files in src/data are used.
 */

export type PublicSettings = {
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

export const defaultPublicSettings: PublicSettings = {
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
};

const staticPosts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date)).map(withCover);

export function usePublishedPosts() {
  return useQuery({
    queryKey: ['public', 'posts'],
    queryFn: async (): Promise<BlogPost[]> => {
      if (!supabase) return staticPosts;
      const { data, error } = await supabase
        .from('posts')
        .select('*') // '*' so the query keeps working whether or not the optional cover column exists yet
        .eq('status', 'published')
        .order('date', { ascending: false });
      if (error) throw error;
      return (data as BlogPost[]).map(withCover);
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
      const { data, error } = await supabase.from('projects').select('name, description, url').order('position');
      if (error) throw error;
      return (data as Omit<Project, 'number'>[]).map((p, i) => ({ ...p, number: String(i + 1).padStart(2, '0') }));
    },
    initialData: supabase ? undefined : staticProjects,
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
