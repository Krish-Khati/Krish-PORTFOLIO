import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Eye, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { PostBlocks } from '@/components/post-blocks';
import { BADGE_PRESETS, type GalleryImage, type Project, projectPath } from '@/data/projects';
import { META_MAX, META_MIN } from '@/seo/score';
import { projectMetaDescription, projectSeoTitle } from '@/seo/meta';
import { deleteProject, listProjects, type ProjectInput, requestSiteRebuild, saveProject, setProjectPosition } from '../api';
import { slugify, textToBlocks } from '../content';
import { GalleryManager } from '../gallery-manager';
import { CharCounter, GooglePreview } from '../seo-ui';
import { ConfirmDialog, Skeleton } from '../ui';

type Draft = Omit<ProjectInput, 'id'> & { order: number };

const emptyDraft = (order: number): Draft => ({
  name: '', slug: '', badge: '', description: '', writeup: '', features: [], techStack: [],
  liveUrl: '', githubUrl: '', playStoreUrl: '', videoUrl: '', featured: false, metaDescription: '', gallery: [], order,
});

const URL_FIELDS = [
  ['liveUrl', 'Live demo', 'https://…'],
  ['githubUrl', 'GitHub', 'https://github.com/krish-khati/…'],
  ['playStoreUrl', 'Play Store', 'https://play.google.com/store/apps/details?id=…'],
  ['videoUrl', 'Video (YouTube or .mp4)', 'https://youtu.be/…'],
] as const;

async function rebuildLiveSite() {
  const r = await requestSiteRebuild();
  toast({ title: r.ok ? 'Updating the live site' : 'Live site not rebuilt', description: r.message });
}

export default function ProjectEditorPage({ id }: { id?: string }) {
  const { data: projects, isLoading } = useQuery({ queryKey: ['admin', 'projects'], queryFn: listProjects });

  if (isLoading || !projects) return <div className="adm-page"><Skeleton rows={8} /></div>;
  const index = id ? projects.findIndex((p) => p.id === id) : -1;
  if (id && index < 0) {
    return (
      <div className="adm-page">
        <p className="adm-muted">This project doesn't exist any more.</p>
        <Link href="/projects" className="adm-btn adm-btn-ghost"><ArrowLeft size={16} /> Back to projects</Link>
      </div>
    );
  }
  const p = index >= 0 ? projects[index] : undefined;
  const initial: Draft = p
    ? {
      name: p.name, slug: p.slug, badge: p.badge, description: p.description, writeup: p.writeup,
      features: p.features, techStack: p.techStack, liveUrl: p.liveUrl, githubUrl: p.githubUrl,
      playStoreUrl: p.playStoreUrl, videoUrl: p.videoUrl, featured: p.featured, metaDescription: p.metaDescription,
      gallery: p.gallery, order: index + 1,
    }
    : emptyDraft(projects.length + 1);
  const others = projects.filter((x) => x.id !== id);

  return <Editor key={id ?? 'new'} id={id} initial={initial} total={id ? projects.length : projects.length + 1} takenSlugs={others.map((x) => x.slug)} />;
}

function Editor({ id, initial, total, takenSlugs }: { id?: string; initial: Draft; total: number; takenSlugs: string[] }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState<Draft>(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewWriteup, setPreviewWriteup] = useState(false);
  const [customBadge, setCustomBadge] = useState(!!initial.badge && !BADGE_PRESETS.includes(initial.badge));
  const [techInput, setTechInput] = useState('');

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const slug = draft.slug || slugify(draft.name);
  const writeupBlocks = useMemo(() => textToBlocks(draft.writeup), [draft.writeup]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setGallery = useCallback((update: (prev: GalleryImage[]) => GalleryImage[]) => setDraft((d) => ({ ...d, gallery: update(d.gallery) })), []);

  const onName = (name: string) => setDraft((d) => ({ ...d, name, slug: slugTouched ? d.slug : slugify(name) }));

  const save = useMutation({
    mutationFn: async (next: Draft) => {
      const { order, ...input } = next;
      const record = await saveProject({ ...input, id });
      if (order !== saved.order || !id) await setProjectPosition(record.id, order - 1);
      return record;
    },
    onSuccess: (record, next) => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
      setSaved(next);
      setError('');
      toast({ title: id ? 'Project updated' : 'Project added', description: record.name });
      if (record.warning) toast({ title: 'Some fields were not saved', description: record.warning });
      void rebuildLiveSite();
      if (!id) navigate(`/projects/${record.id}`, { replace: true });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save.'),
  });

  const remove = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
      toast({ title: 'Project deleted' });
      void rebuildLiveSite();
      navigate('/projects');
    },
  });

  const submit = useCallback(() => {
    const next: Draft = {
      ...draft,
      name: draft.name.trim(),
      slug: slugify(draft.slug || draft.name),
      badge: draft.badge.trim(),
      description: draft.description.trim(),
      features: draft.features.map((f) => f.trim()).filter(Boolean),
      metaDescription: draft.metaDescription.trim(),
      gallery: draft.gallery.map((g) => ({ ...g, alt: g.alt.trim(), caption: g.caption.trim() })),
      order: Math.min(Math.max(1, Math.round(draft.order) || 1), total),
      liveUrl: draft.liveUrl.trim(),
      githubUrl: draft.githubUrl.trim(),
      playStoreUrl: draft.playStoreUrl.trim(),
      videoUrl: draft.videoUrl.trim(),
    };
    if (!next.name) return setError('Give the project a name.');
    if (!next.slug) return setError("The URL slug can't be empty.");
    if (takenSlugs.includes(next.slug)) return setError(`Another project already uses the URL /projects/${next.slug}.`);
    for (const [k, label] of URL_FIELDS) {
      if (next[k] && !/^https?:\/\/\S+$/i.test(next[k])) return setError(`${label} link must start with http:// or https://`);
    }
    setDraft(next);
    save.mutate(next);
  }, [draft, save, takenSlugs, total]);

  // Ctrl/Cmd + S saves.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
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

  /* ---- Key features ---- */
  const setFeature = (i: number, v: string) => set('features', draft.features.map((f, j) => (j === i ? v : f)));
  const moveFeature = (i: number, dir: -1 | 1) => {
    const list = [...draft.features];
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    set('features', list);
  };
  const addFeature = () => {
    set('features', [...draft.features, '']);
    requestAnimationFrame(() => [...document.querySelectorAll<HTMLInputElement>('.adm-feature-row input')].at(-1)?.focus());
  };

  /* ---- Tech stack tags ---- */
  const addTech = (raw: string) => {
    const tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return;
    const lower = draft.techStack.map((t) => t.toLowerCase());
    set('techStack', [...draft.techStack, ...tags.filter((t, i) => !lower.includes(t.toLowerCase()) && tags.indexOf(t) === i)]);
    setTechInput('');
  };
  const onTechKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTech(techInput);
    } else if (e.key === 'Backspace' && !techInput && draft.techStack.length) {
      set('techStack', draft.techStack.slice(0, -1));
    }
  };

  const asProject: Project = { ...draft, number: '', slug, name: draft.name.trim() || 'Your project' };
  const googleTitle = projectSeoTitle(asProject);
  const googleDescription = projectMetaDescription(asProject);

  return (
    <div className="adm-page adm-editor">
      <div className="adm-editor-bar adm-rise">
        <Link href="/projects" className="adm-link"><ArrowLeft size={16} /> Projects</Link>
        <span className={`adm-save-state${dirty ? ' is-dirty' : ''}`}>
          {save.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : id ? 'All changes saved' : 'New project'}
        </span>
        <div className="adm-editor-actions">
          {id && (
            <a className="adm-icon-btn" href={projectPath(saved.slug || slugify(saved.name))} target="_blank" rel="noreferrer" aria-label="View on the site" title="View on the site">
              <ExternalLink size={17} />
            </a>
          )}
          {id && (
            <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setConfirmDelete(true)} aria-label="Delete project">
              <Trash2 size={17} />
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-primary" onClick={submit} disabled={save.isPending}>
            <Save size={16} /> {id ? 'Save project' : 'Add project'}
          </button>
        </div>
      </div>

      {error && <p className="adm-form-error adm-rise" role="alert">{error}</p>}

      <div className="adm-editor-grid">
        <div className="adm-editor-main adm-rise" style={{ animationDelay: '.05s' }}>
          <input className="adm-title-input" value={draft.name} onChange={(e) => onName(e.target.value)} placeholder="Project name" aria-label="Project name" />
          <textarea
            className="adm-excerpt-input"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Short description — one or two lines shown next to the gallery…"
            rows={2}
            aria-label="Short description"
          />

          <GalleryManager images={draft.gallery} setImages={setGallery} project={{ name: draft.name, slug, description: draft.description }} />

          <div className="adm-card adm-stack">
            <h3 className="adm-side-title">Key features <small className="adm-muted">shown as a list with green bullets · 3–6 is ideal</small></h3>
            {draft.features.map((f, i) => (
              <div key={i} className="adm-feature-row">
                <input
                  value={f}
                  onChange={(e) => setFeature(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                  placeholder="e.g. Live class timetable with booking"
                  aria-label={`Feature ${i + 1}`}
                />
                <button type="button" className="adm-icon-btn" disabled={i === 0} onClick={() => moveFeature(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                <button type="button" className="adm-icon-btn" disabled={i === draft.features.length - 1} onClick={() => moveFeature(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => set('features', draft.features.filter((_, j) => j !== i))} aria-label={`Remove feature ${i + 1}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="adm-btn adm-btn-ghost adm-self-start" onClick={addFeature}><Plus size={15} /> Add feature</button>
          </div>

          <div className="adm-card adm-stack">
            <div className="adm-card-head">
              <h3 className="adm-side-title">Write-up <small className="adm-muted">the longer story on the project's own page · same formatting as blog posts</small></h3>
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-xs" onClick={() => setPreviewWriteup((v) => !v)}>
                <Eye size={14} /> {previewWriteup ? 'Edit' : 'Preview'}
              </button>
            </div>
            {previewWriteup ? (
              <div className="adm-md-preview">
                {writeupBlocks.length ? <div className="post-body"><PostBlocks blocks={writeupBlocks} /></div> : <p className="adm-muted">Nothing written yet.</p>}
              </div>
            ) : (
              <textarea
                className="adm-md-input adm-md-input-sm"
                value={draft.writeup}
                onChange={(e) => set('writeup', e.target.value)}
                placeholder={'Why you built it, how it works, what you learned…\n\n## A heading\n- A bullet point\n[a link](/blog/a-post)'}
                aria-label="Write-up"
              />
            )}
          </div>
        </div>

        <aside className="adm-editor-side adm-rise" style={{ animationDelay: '.1s' }}>
          <div className="adm-card">
            <h3 className="adm-side-title">Project settings</h3>
            <label className="adm-field">
              <span>Badge <small>optional pill next to the name</small></span>
              <select
                value={customBadge ? '__custom' : draft.badge}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomBadge(v === '__custom');
                  set('badge', v === '__custom' ? '' : v);
                }}
              >
                <option value="">None</option>
                {BADGE_PRESETS.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="__custom">Custom…</option>
              </select>
            </label>
            {customBadge && (
              <label className="adm-field">
                <span className="adm-field-row">Custom badge <CharCounter value={draft.badge} max={20} /></span>
                <input value={draft.badge} onChange={(e) => set('badge', e.target.value)} placeholder="e.g. Hackathon" maxLength={24} />
              </label>
            )}
            <div className="adm-field">
              <span>Featured on the home page</span>
              <div className="adm-seg adm-seg-full">
                <button type="button" className={draft.featured ? 'is-active' : ''} onClick={() => set('featured', true)}>Featured</button>
                <button type="button" className={!draft.featured ? 'is-active' : ''} onClick={() => set('featured', false)}>Not featured</button>
              </div>
              <small className="adm-muted adm-small">The home page shows only featured projects when any are featured; /projects always shows all.</small>
            </div>
            <label className="adm-field">
              <span>Display order <small>1 = first, of {total}</small></span>
              <input type="number" min={1} max={total} value={draft.order} onChange={(e) => set('order', Number(e.target.value))} />
            </label>
          </div>

          <div className="adm-card">
            <h3 className="adm-side-title">Links <small className="adm-muted">empty ones are hidden on the site</small></h3>
            {URL_FIELDS.map(([k, label, placeholder]) => (
              <label key={k} className="adm-field">
                <span>{label}</span>
                <input value={draft[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} inputMode="url" />
              </label>
            ))}
          </div>

          <div className="adm-card">
            <h3 className="adm-side-title">Technology stack <small className="adm-muted">type and press Enter</small></h3>
            <div className="adm-tags">
              {draft.techStack.map((t) => (
                <span key={t} className="adm-tag">
                  {t}
                  <button type="button" onClick={() => set('techStack', draft.techStack.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button>
                </span>
              ))}
              <input
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={onTechKey}
                onBlur={() => addTech(techInput)}
                placeholder={draft.techStack.length ? 'Add more…' : 'e.g. React, Supabase'}
                aria-label="Add a technology"
              />
            </div>
          </div>

          <div className="adm-card adm-seo">
            <h3 className="adm-side-title">SEO</h3>
            <label className="adm-field">
              <span className="adm-field-row">Meta description <CharCounter value={draft.metaDescription} min={META_MIN} max={META_MAX} /></span>
              <textarea
                rows={3}
                value={draft.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
                placeholder="The 1–2 sentence summary Google shows under the title (140–160 characters). Defaults to the short description."
              />
            </label>
            <label className="adm-field">
              <span className="adm-field-row">URL slug <CharCounter value={draft.slug} max={60} /></span>
              <div className="adm-input-prefix">
                <em>/projects/</em>
                <input
                  value={draft.slug}
                  onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }}
                  onBlur={() => set('slug', slugify(draft.slug))}
                  placeholder={slugify(draft.name) || 'my-project'}
                />
              </div>
              {id && saved.slug && draft.slug !== saved.slug && (
                <small className="adm-seo-warn">Changing the slug breaks links to the old URL.</small>
              )}
            </label>
            <GooglePreview section="projects" title={googleTitle} description={googleDescription} slug={slug} />
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this project?"
        body={<><strong>{draft.name || 'This project'}</strong> will be removed from your portfolio.</>}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
