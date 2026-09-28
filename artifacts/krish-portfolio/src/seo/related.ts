import type { BlogPost } from '../data/blog';
import { type Project, projectPath } from '../data/projects';

/** Up to `count` other posts: same category first (newest first), topped up with the newest others. */
export function relatedPosts<T extends BlogPost>(post: BlogPost, all: T[], count = 3): T[] {
  const others = all.filter((p) => p.slug !== post.slug).sort((a, b) => b.date.localeCompare(a.date));
  const same = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, count);
}

const postText = (p: BlogPost) =>
  [p.title, p.excerpt, ...p.blocks.map((b) => (b.type === 'list' ? b.items.join(' ') : b.text))].join('\n');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Posts (newest first) that mention the project by name or link to its page. */
export function postsMentioningProject<T extends BlogPost>(project: Pick<Project, 'name' | 'slug'>, all: T[], count = 3): T[] {
  const name = project.name.trim();
  if (!name) return [];
  const byName = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}($|[^\\p{L}\\p{N}])`, 'iu');
  const link = projectPath(project.slug);
  return all
    .filter((p) => {
      const text = postText(p);
      return byName.test(text) || text.includes(`](${link})`);
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, count);
}
