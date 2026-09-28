import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Code2, Columns2, Eye, Heading2, ImagePlus, Link2, List, Loader2, PenLine, Plus, Quote, Save, Trash2, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { toast } from '@/hooks/use-toast';
import type { BlogBlock, BlogFaq } from '@/data/blog';
import { InlineText } from '@/components/rich-text';
import { firstParagraph } from '@/seo/meta';
import { META_MAX, META_MIN, SEO_TITLE_MAX, seoScore } from '@/seo/score';
import {
  deletePost, getPost, type PostCategory, postCategories, type PostStatus, requestSiteRebuild, savePost, uploadCover,
} from '../api';
import { blocksToText, slugify, textToBlocks, wordCount } from '../content';
import { CharCounter, GooglePreview, SeoBadge, SeoChecklist } from '../seo-ui';
import { ConfirmDialog, Skeleton } from '../ui';

type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  status: PostStatus;
  cover: string;
  coverAlt: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  faqs: BlogFaq[];
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({
  title: '', slug: '', excerpt: '', category: 'Journey', date: today(), status: 'draft', cover: '', coverAlt: '', body: '',
  seoTitle: '', metaDescription: '', focusKeyword: '', faqs: [],
});

const MAX_FAQS = 6;

// Rebuilds the live site's prerendered pages + sitemap after a public change. Runs in the
// background; the result shows up as a toast.
async function rebuildLiveSite() {
  const r = await requestSiteRebuild();
  toast({ title: r.ok ? 'Updating the live site' : 'Live site not rebuilt', description: r.message });
}

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
    ? {
      title: post.title, slug: post.slug, excerpt: post.excerpt, category: post.category, date: post.date, status: post.status,
      cover: post.cover ?? '', coverAlt: post.coverAlt ?? '', body: blocksToText(post.blocks),
      seoTitle: post.seoTitle ?? '', metaDescription: post.metaDescription ?? '', focusKeyword: post.focusKeyword ?? '',
      faqs: post.faqs ?? [],
    }
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
  const seo = useMemo(() => seoScore({ ...draft, blocks }), [draft, blocks]);

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
        cover: next.cover.trim(),
        coverAlt: next.coverAlt.trim(),
        blocks: textToBlocks(next.body),
        seoTitle: next.seoTitle.trim(),
        metaDescription: next.metaDescription.trim(),
        focusKeyword: next.focusKeyword.trim().toLowerCase(),
        faqs: next.faqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question && f.answer),
      }),
    onSuccess: (record, next) => {
      const wasPublic = saved.status === 'published';
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      qc.setQueryData(['admin', 'post', record.id], record);
      setSaved(next);
      setError('');
      toast({ title: next.status === 'published' ? 'Post published' : 'Draft saved', description: record.title });
      if (record.warning) toast({ title: 'Some SEO fields were not saved', description: record.warning });
      // Published, updated while published, or just unpublished: the public pages need a rebuild.
      if (next.status === 'published' || wasPublic) void rebuildLiveSite();
      if (!id) navigate(`/posts/${record.id}`, { replace: true });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save.'),
  });

  const remove = useMutation({
    mutationFn: () => deletePost(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'posts'] });
      toast({ title: 'Post deleted' });
      if (saved.status === 'published') void rebuildLiveSite();
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
                {draft.cover && <img className="post-cover adm-preview-cover" src={draft.cover} alt="" />}
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

          <div className="adm-card adm-seo">
            <div className="adm-seo-head">
              <h3 className="adm-side-title">SEO</h3>
              <SeoBadge result={seo} />
            </div>
            <label className="adm-field">
              <span>Focus keyword <small>what people would type into Google</small></span>
              <input
                value={draft.focusKeyword}
                onChange={(e) => set('focusKeyword', e.target.value)}
                placeholder="e.g. learn python without a teacher"
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-row">SEO title <CharCounter value={draft.seoTitle || draft.title} min={30} max={SEO_TITLE_MAX} /></span>
              <input value={draft.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder={draft.title || 'Defaults to the post title'} />
            </label>
            <label className="adm-field">
              <span className="adm-field-row">Meta description <CharCounter value={draft.metaDescription} min={META_MIN} max={META_MAX} /></span>
              <textarea
                rows={3}
                value={draft.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
                placeholder="The 1–2 sentence summary Google shows under the title (140–160 characters)."
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-row">URL slug <CharCounter value={draft.slug} max={60} /></span>
              <div className="adm-input-prefix">
                <em>/blog/</em>
                <input
                  value={draft.slug}
                  onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }}
                  onBlur={() => set('slug', slugify(draft.slug))}
                  placeholder="my-post"
                />
              </div>
              {id && saved.status === 'published' && draft.slug !== saved.slug && (
                <small className="adm-seo-warn">Changing the slug of a published post breaks links to the old URL.</small>
              )}
            </label>
            <GooglePreview
              title={draft.seoTitle || draft.title}
              description={draft.metaDescription || draft.excerpt || firstParagraph({ blocks })}
              slug={draft.slug}
              date={draft.date}
            />
            <SeoChecklist result={seo} />
          </div>

          <FaqEditor faqs={draft.faqs} onChange={(faqs) => set('faqs', faqs)} />

          <CoverPicker
            value={draft.cover}
            onChange={(v) => set('cover', v)}
            alt={draft.coverAlt}
            onAltChange={(v) => set('coverAlt', v)}
          />

          <div className="adm-card adm-help">
            <h3 className="adm-side-title">Formatting</h3>
            <ul>
              <li><code>## Heading</code></li>
              <li><code>&gt; Quote</code></li>
              <li><code>- List item</code></li>
              <li><code>```js</code> … <code>```</code> code</li>
              <li><code>[text](/blog/a-post)</code> link</li>
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

function FaqEditor({ faqs, onChange }: { faqs: BlogFaq[]; onChange: (faqs: BlogFaq[]) => void }) {
  const update = (i: number, patch: Partial<BlogFaq>) => onChange(faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="adm-card">
      <h3 className="adm-side-title">FAQ <small className="adm-muted">shown at the end of the post · 3–4 is ideal</small></h3>
      {faqs.map((f, i) => (
        <div key={i} className="adm-faq-row">
          <input value={f.question} onChange={(e) => update(i, { question: e.target.value })} placeholder="Question" aria-label={`Question ${i + 1}`} />
          <textarea rows={2} value={f.answer} onChange={(e) => update(i, { answer: e.target.value })} placeholder="Answer" aria-label={`Answer ${i + 1}`} />
          <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => onChange(faqs.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {faqs.length < MAX_FAQS && (
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onChange([...faqs, { question: '', answer: '' }])}>
          <Plus size={15} /> Add question
        </button>
      )}
    </div>
  );
}

function CoverPicker({ value, onChange, alt, onAltChange }: {
  value: string; onChange: (v: string) => void; alt: string; onAltChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [value]);

  const upload = async (file?: File) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      onChange(await uploadCover(file));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="adm-card">
      <h3 className="adm-side-title">Cover image</h3>
      <div
        className={`adm-cover-drop${value && !broken ? ' has-image' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
      >
        {value && !broken ? (
          <>
            <img src={value} alt="Cover preview" onError={() => setBroken(true)} />
            <button type="button" className="adm-cover-remove" onClick={() => onChange('')} aria-label="Remove cover image">
              <X size={15} />
            </button>
          </>
        ) : (
          <button type="button" className="adm-cover-empty" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={22} className="adm-spin" /> : <ImagePlus size={22} />}
            <span>{busy ? 'Uploading…' : broken ? "Image couldn't load — pick another" : 'Click or drop an image'}</span>
            <small>JPG, PNG or WebP · wide images look best</small>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {value && !broken && (
        <button type="button" className="adm-btn adm-btn-ghost adm-cover-replace" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={15} className="adm-spin" /> : <ImagePlus size={15} />} {busy ? 'Uploading…' : 'Replace image'}
        </button>
      )}
      <label className="adm-field adm-cover-url">
        <span><Link2 size={13} /> Or paste an image URL</span>
        <input
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
      </label>
      <label className="adm-field">
        <span>Alt text <small>describe the image for Google and screen readers</small></span>
        <input value={alt} onChange={(e) => onAltChange(e.target.value)} placeholder="e.g. Laptop on a desk with Python code on screen" />
      </label>
      {err && <p className="adm-form-error" role="alert">{err}</p>}
    </div>
  );
}

function Blocks({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2': return <h2 key={i} className="post-h2">{b.text}</h2>;
          case 'quote': return <blockquote key={i} className="post-quote"><InlineText text={b.text} /></blockquote>;
          case 'list': return <ul key={i} className="post-list">{b.items.map((it, j) => <li key={j}><InlineText text={it} /></li>)}</ul>;
          case 'code': return <pre key={i} className="post-code" data-lang={b.lang}><code>{b.text}</code></pre>;
          default: return <p key={i} className="post-p"><InlineText text={b.text} /></p>;
        }
      })}
    </>
  );
}
