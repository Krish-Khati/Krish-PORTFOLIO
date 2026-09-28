import type { BlogPost } from '../data/blog';

/** Up to `count` other posts: same category first (newest first), topped up with the newest others. */
export function relatedPosts<T extends BlogPost>(post: BlogPost, all: T[], count = 3): T[] {
  const others = all.filter((p) => p.slug !== post.slug).sort((a, b) => b.date.localeCompare(a.date));
  const same = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, count);
}
