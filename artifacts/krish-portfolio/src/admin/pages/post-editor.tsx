import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Code2, Columns2, Eye, Heading2, List, PenLine, Quote, Save, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { toast } from '@/hooks/use-toast';
import type { BlogBlock } from '@/data/blog';
import { deletePost, getPost, type PostCategory, postCategories, type PostStatus, savePost } from '../api';
import { blocksToText, slugify, textToBlocks, wordCount } from '../content';
import { ConfirmDialog, Skeleton } from '../ui';

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  status: PostStatus;
  body: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({ title: '', slug: '', excerpt: '', category: 'Journey', date: today(), status: 'draft', body: '' });

type View = 'write' | 'split' | 'preview';

export default function PostEditorPage({ id }: { id?: string }) {
  const { data: post, isLoading } = useQuery({
    queryKey: ['admin', 'post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  if (id && isLoading) return <div className="adm-page"><Skeleton rows={8} /></div>;
  if (id && !post) {
    return (
      <div className="adm-page">
        <p className="adm-muted">This post doesn't exist any more.</p>
        <Link href="/posts" className="adm-btn adm-btn-ghost"><ArrowLeft size={16} /> Back to posts</Link>
      </div>
    );
  }

  const initial: Draft = post
    ? { title: post.title, slug: post.slug, excerpt: post.excerpt, category: post.category, date: post.date, status: post.status, body: blocksToText(post.blocks) }
    : emptyDraft();

  return <Editor key={id ?? 'new'} id={id} initial={initial} />;
}

function Editor({ id, initial }: { id?: string; initial: Draft }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState<Draft>(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [view, setView] = useState<View>('split');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const blocks = useMemo(() => textToBlocks(draft.body), [draft.body]);
  const words = wordCount(draft.body);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const onTitle = (title: string) =>
    setDraft((d) => ({ ...d, title, slug: slugTouched ? d.slug : slugify(title) }));

  const save = useMutation({
    mutationFn: (next: Draft) =>
      savePost({
        id,
        title: next.title.trim(),
        slug: next.slug,
        excerpt: next.excerpt.trim(),
        category: next.category,
        date: next.date,
        status: next.status,
        blocks: textToBlocks(next.body),
      }),
    onSuccess: (record, next) => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      qc.setQueryData(['admin', 'post', record.id], record);
      setSaved(next);
      setError('');
      toast({ title: next.status === 'published' ? 'Post published' : 'Draft saved', description: record.title });
      if (!id) navigate(`/posts/${record.id}`, { replace: true });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save.'),
  });

  const remove = useMutation({
    mutationFn: () => deletePost(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      toast({ title: 'Post deleted' });
      navigate('/posts');
    },
  });

  const submit = useCallback((status?: PostStatus) => {
    const next = { ...draft, status: status ?? draft.status, slug: slugify(draft.slug || draft.title) };
    if (!next.title.trim()) return setError('Give the post a title.');
    if (!next.slug) return setError('The URL slug can\'t be empty.');
    if (!next.body.trim()) return setError('Write something in the body first.');
    setDraft(next);
    save.mutate(next);
  }, [draft, save]);

  // Ctrl/Cmd + S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const insert = (kind: 'h2' | 'quote' | 'list' | 'code') => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const selected = value.slice(a, b);
    const snippets = {
      h2: `## ${selected || 'Heading'}`,
      quote: `> ${selected || 'A line worth remembering.'}`,
      list: (selected || 'First item\nSecond item').split('\n').map((l) => `- ${l}`).join('\n'),
      code: `\`\`\`js\n${selected || '// code'}\n\`\`\``,
    };
    const before = value.slice(0, a);
    const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const text = `${pad}${snippets[kind]}\n\n`;
    const next = before + text + value.slice(b);
    set('body', next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = before.length + text.length;
    });
  };

  return (
    <div className="adm-page adm-editor">
      <div className="adm-editor-bar adm-rise">
        <Link href="/posts" className="adm-link"><ArrowLeft size={16} /> Posts</Link>
        <span className={`adm-save-state${dirty ? ' is-dirty' : ''}`}>
          {save.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : id ? 'All changes saved' : 'New post'}
        </span>
        <div className="adm-editor-actions">
          {id && (
            <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setConfirmDelete(true)} aria-label="Delete post">
              <Trash2 size={17} />
            </button>
          )}
          {draft.status === 'published' ? (
            <>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => submit('draft')} disabled={save.isPending}>Unpublish</button>
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => submit()} disabled={save.isPending}><Save size={16} /> Update</button>
            </>
          ) : (
            <>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => submit('draft')} disabled={save.isPending}>Save draft</button>
              <button type="button" className="adm-btn adm-btn-primary" onClick={() => submit('published')} disabled={save.isPending}>Publish</button>
            </>
          )}
        </div>
      </div>

      {error && <p className="adm-form-error adm-rise" role="alert">{error}</p>}

      <div className="adm-editor-grid">
        <div className="adm-editor-main adm-rise" style={{ animationDelay: '.05s' }}>
          <input
            className="adm-title-input"
            value={draft.title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Post title"
            aria-label="Post title"
          />
          <textarea
            className="adm-excerpt-input"
            value={draft.excerpt}
            onChange={(e) => set('excerpt', e.target.value)}
            placeholder="A one- or two-line summary shown on the blog list…"
            rows={2}
            aria-label="Excerpt"
          />

          <div className="adm-md-toolbar">
            <div className="adm-md-tools">
              <button type="button" onClick={() => insert('h2')} title="Heading"><Heading2 size={16} /></button>
              <button type="button" onClick={() => insert('quote')} title="Quote"><Quote size={16} /></button>
              <button type="button" onClick={() => insert('list')} title="Bullet list"><List size={16} /></button>
              <button type="button" onClick={() => insert('code')} title="Code block"><Code2 size={16} /></button>
            </div>
            <div className="adm-seg" role="tablist" aria-label="Editor view">
              {([['write', PenLine, 'Write'], ['split', Columns2, 'Split'], ['preview', Eye, 'Preview']] as const).map(([v, Icon, label]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-active' : ''} onClick={() => setView(v)}>
                  <Icon size={14} /><span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`adm-md adm-md-${view}`}>
            {view !== 'preview' && (
              <textarea
                ref={bodyRef}
                className="adm-md-input"
                value={draft.body}
                onChange={(e) => set('body', e.target.value)}
                placeholder={'Start writing…\n\n## Use this for a heading\n> This becomes a quote\n- And this a bullet list'}
                spellCheck
                aria-label="Post body"
              />
            )}
            {view !== 'write' && (
              <div className="adm-md-preview" aria-label="Preview">
                {draft.title && <h1 className="post-title">{draft.title}</h1>}
                {draft.excerpt && <p className="post-lede">{draft.excerpt}</p>}
                <div className="post-body">
                  {blocks.length ? <Blocks blocks={blocks} /> : <p className="adm-muted">Preview appears here as you type.</p>}
                </div>
              </div>
            )}
          </div>
          <p className="adm-editor-foot">{words} words · ~{Math.max(1, Math.round(words / 200))} min read · <kbd>Ctrl</kbd>+<kbd>S</kbd> to save</p>
        </div>

        <aside className="adm-editor-side adm-rise" style={{ animationDelay: '.1s' }}>
          <div className="adm-card">
            <h3 className="adm-side-title">Post settings</h3>
            <div className="adm-field">
              <span>Status</span>
              <div className="adm-seg adm-seg-full">
                {(['draft', 'published'] as PostStatus[]).map((s) => (
                  <button key={s} type="button" className={draft.status === s ? 'is-active' : ''} onClick={() => set('status', s)}>
                    {s === 'draft' ? 'Draft' : 'Published'}
                  </button>
                ))}
              </div>
            </div>
            <label className="adm-field">
              <span>URL slug</span>
              <div className="adm-input-prefix">
                <em>/blog/</em>
                <input
                  value={draft.slug}
                  onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }}
                  onBlur={() => set('slug', slugify(draft.slug))}
                  placeholder="my-post"
                />
              </div>
            </label>
            <label className="adm-field">
              <span>Category</span>
              <select value={draft.category} onChange={(e) => set('category', e.target.value as PostCategory)}>
                {postCategories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="adm-field">
              <span>Publish date</span>
              <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
            </label>
          </div>

          <div className="adm-card adm-help">
            <h3 className="adm-side-title">Formatting</h3>
            <ul>
              <li><code>## Heading</code></li>
              <li><code>&gt; Quote</code></li>
              <li><code>- List item</code></li>
              <li><code>```js</code> … <code>```</code> code</li>
              <li>Blank line = new paragraph</li>
            </ul>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        body={<><strong>{draft.title || 'This post'}</strong> will be permanently removed.</>}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Blocks({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2': return <h2 key={i} className="post-h2">{b.text}</h2>;
          case 'quote': return <blockquote key={i} className="post-quote">{b.text}</blockquote>;
          case 'list': return <ul key={i} className="post-list">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
          case 'code': return <pre key={i} className="post-code" data-lang={b.lang}><code>{b.text}</code></pre>;
          default: return <p key={i} className="post-p">{b.text}</p>;
        }
      })}
    </>
  );
}
