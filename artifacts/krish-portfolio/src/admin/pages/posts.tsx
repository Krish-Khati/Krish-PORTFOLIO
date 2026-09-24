import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { formatPostDate } from '@/data/blog';
import { type AdminPost, deletePost, listPosts } from '../api';
import { ConfirmDialog, EmptyState, PageHeader, relativeTime, Skeleton } from '../ui';

type Filter = 'all' | 'published' | 'draft';

export default function PostsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'posts'], queryFn: listPosts });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<AdminPost | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      toast({ title: 'Post deleted', description: toDelete?.title });
      setToDelete(null);
    },
  });

  const counts = useMemo(() => ({
    all: data?.length ?? 0,
    published: data?.filter((p) => p.status === 'published').length ?? 0,
    draft: data?.filter((p) => p.status === 'draft').length ?? 0,
  }), [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => filter === 'all' || p.status === filter)
      .filter((p) => !q || `${p.title} ${p.category} ${p.slug}`.toLowerCase().includes(q));
  }, [data, filter, query]);

  return (
    <div className="adm-page">
      <PageHeader
        title="Blog posts"
        subtitle="Write, edit and publish posts for your blog."
        actions={<Link href="/posts/new" className="adm-btn adm-btn-primary"><Plus size={16} /> New post</Link>}
      />

      <div className="adm-toolbar adm-rise">
        <div className="adm-tabs" role="tablist">
          {(['all', 'published', 'draft'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`adm-tab${filter === f ? ' is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'published' ? 'Published' : 'Drafts'}
              <span className="adm-tab-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="adm-search">
          <Search size={16} />
          <span className="visually-hidden">Search posts</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search posts…" />
        </label>
      </div>

      <div className="adm-card adm-card-flush adm-rise" style={{ animationDelay: '.1s' }}>
        {isLoading ? <div className="adm-pad"><Skeleton rows={5} /></div> : rows.length === 0 ? (
          <EmptyState
            icon={<FileText size={26} />}
            title={data?.length ? 'No posts match' : 'No posts yet'}
            body={data?.length ? 'Try a different search or filter.' : 'Your first post is one click away.'}
            action={!data?.length && <Link href="/posts/new" className="adm-btn adm-btn-primary"><Plus size={16} /> Write a post</Link>}
          />
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Title</th>
                <th className="adm-hide-sm">Category</th>
                <th>Status</th>
                <th className="adm-hide-sm">Date</th>
                <th className="adm-hide-md">Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.id} className="adm-row-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <td>
                    <Link href={`/posts/${p.id}`} className="adm-table-title">{p.title}</Link>
                    <small className="adm-muted adm-block">/blog/{p.slug}</small>
                  </td>
                  <td className="adm-hide-sm"><span className="adm-chip">{p.category}</span></td>
                  <td><span className={`adm-status adm-status-${p.status}`}>{p.status}</span></td>
                  <td className="adm-hide-sm adm-nowrap">{formatPostDate(p.date)}</td>
                  <td className="adm-hide-md adm-muted adm-nowrap">{relativeTime(p.updatedAt)}</td>
                  <td>
                    <div className="adm-row-actions">
                      <Link href={`/posts/${p.id}`} className="adm-icon-btn" aria-label={`Edit ${p.title}`}><Pencil size={16} /></Link>
                      <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setToDelete(p)} aria-label={`Delete ${p.title}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this post?"
        body={<><strong>{toDelete?.title}</strong> will be permanently removed. This can't be undone.</>}
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
