import { type DragEvent, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, GripVertical, ImagePlus, Loader2, Sparkles, Star, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { GalleryImage } from '@/data/projects';
import { requestAltText, storagePublicPrefix, uploadGalleryFile } from './api';
import { ACCEPTED_TYPES, checkFile, galleryFileName, MAX_UPLOAD_MB, optimizeImage, previewFromUrl, shortDescription } from './image-seo';
import { CharCounter } from './seo-ui';

export const ALT_MAX = 120;

type Stage = 'waiting' | 'optimizing' | 'describing' | 'uploading' | 'done' | 'error';
type QueueItem = { key: string; name: string; preview: string; stage: Stage; progress: number; message: string };

const stageLabel: Record<Stage, string> = {
  waiting: 'Waiting…',
  optimizing: 'Optimizing (resize + WebP)…',
  describing: 'Writing alt text…',
  uploading: 'Uploading',
  done: 'Added',
  error: 'Failed',
};

const shortId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)
    .replace(/-/g, '').slice(0, 8);

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * Screenshot gallery editor for a project: upload many images at once (drag & drop or click), each
 * optimized in the browser, described by the alt-text model and uploaded with visible progress;
 * then reorder (drag or arrows), set the cover (first image), edit alt text + caption, regenerate
 * alt text, or remove.
 */
export function GalleryManager({
  images,
  setImages,
  project,
}: {
  images: GalleryImage[];
  setImages: (update: (prev: GalleryImage[]) => GalleryImage[]) => void;
  project: { name: string; slug: string; description: string };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const running = useRef(false);
  const pending = useRef<{ file: File; key: string }[]>([]);
  const nextNumber = useRef(0);
  const projectRef = useRef(project);
  projectRef.current = project;

  const name = project.name.trim();
  const busy = queue.some((q) => q.stage !== 'done' && q.stage !== 'error');

  const patch = (key: string, p: Partial<QueueItem>) => setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...p } : it)));

  const processOne = async (file: File, key: string, n: number) => {
    const { name: projectName, slug, description } = projectRef.current;
    try {
      patch(key, { stage: 'optimizing' });
      const opt = await optimizeImage(file);

      patch(key, { stage: 'describing' });
      const ai = await requestAltText({ image: opt.preview, projectName, projectDescription: description });
      const alt = ai.ok ? ai.alt : `${projectName} screenshot ${n}`;
      const base = galleryFileName(slug, ai.ok ? shortDescription(alt, projectName) : 'screenshot', n, opt.ext);
      const folder = `projects/${shortId()}`;

      patch(key, { stage: 'uploading', progress: 0 });
      const url = await uploadGalleryFile(opt.blob, `${folder}/${base}`, (p) => patch(key, { progress: p * 0.9 }));
      const thumbExt = opt.thumb.type === 'image/webp' ? 'webp' : 'jpg';
      // The thumbnail is a nice-to-have: if it fails, the gallery just uses the full image.
      const thumb = await uploadGalleryFile(opt.thumb, `${folder}/${base.replace(/\.\w+$/, `-thumb.${thumbExt}`)}`, (p) => patch(key, { progress: 0.9 + p * 0.1 }))
        .catch(() => undefined);

      setImages((prev) => [...prev, { url, thumb, alt, caption: '', width: opt.width, height: opt.height }]);
      patch(key, {
        stage: 'done',
        progress: 1,
        message: ai.ok
          ? `${opt.width}×${opt.height} · ${(opt.blob.size / 1024).toFixed(0)} KB ${opt.ext.toUpperCase()}`
          : `Added with fallback alt text — ${ai.error}`,
      });
      if (ai.ok) setTimeout(() => setQueue((q) => q.filter((it) => it.key !== key)), 3500);
    } catch (err) {
      patch(key, { stage: 'error', message: err instanceof Error ? err.message : 'Upload failed.' });
    }
  };

  const runQueue = async () => {
    if (running.current) return;
    running.current = true;
    // One at a time, so images land in the gallery in the order they were chosen.
    while (pending.current.length) {
      const { file, key } = pending.current.shift()!;
      nextNumber.current += 1;
      await processOne(file, key, nextNumber.current);
    }
    running.current = false;
  };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files?.length) return;
    if (!name) {
      toast({ title: 'Add the project name first', description: 'It is used for the image file names and alt text.' });
      return;
    }
    if (!running.current) nextNumber.current = images.length;
    const items: QueueItem[] = [];
    for (const file of Array.from(files)) {
      const key = shortId();
      const problem = checkFile(file);
      items.push({ key, name: file.name, preview: problem ? '' : URL.createObjectURL(file), stage: problem ? 'error' : 'waiting', progress: 0, message: problem ?? '' });
      if (!problem) pending.current.push({ file, key });
    }
    setQueue((q) => [...q, ...items]);
    void runQueue();
  };

  const dismiss = (key: string) =>
    setQueue((q) => {
      const item = q.find((it) => it.key === key);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return q.filter((it) => it.key !== key);
    });

  const update = (i: number, p: Partial<GalleryImage>) => setImages((prev) => prev.map((img, j) => (j === i ? { ...img, ...p } : img)));

  const regenerate = async (img: GalleryImage) => {
    setRegenerating((s) => new Set(s).add(img.url));
    try {
      const prefix = storagePublicPrefix();
      const common = { projectName: name, projectDescription: project.description };
      let res;
      if (prefix && img.url.startsWith(prefix)) {
        res = await requestAltText({ imageUrl: img.url, ...common });
      } else {
        try {
          res = await requestAltText({ image: await previewFromUrl(img.url), ...common });
        } catch (err) {
          res = { ok: false as const, error: err instanceof Error ? err.message : 'Could not read this image.' };
        }
      }
      if (res.ok) {
        const alt = res.alt;
        setImages((prev) => prev.map((x) => (x.url === img.url ? { ...x, alt } : x)));
        toast({ title: 'New alt text written', description: alt });
      } else {
        toast({ title: 'Could not write alt text', description: res.error });
      }
    } finally {
      setRegenerating((s) => {
        const next = new Set(s);
        next.delete(img.url);
        return next;
      });
    }
  };

  const onDropZone = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.types.includes('Files')) addFiles(e.dataTransfer.files);
  };

  const onCardDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) return addFiles(e.dataTransfer.files);
    if (dragIndex !== null && dragIndex !== to) setImages((prev) => move(prev, dragIndex, to));
    setDragIndex(null);
  };

  return (
    <div className="adm-card adm-gallery">
      <div className="adm-gallery-head">
        <h3 className="adm-side-title">
          Screenshots <small className="adm-muted">the first image is the cover · drag to reorder</small>
        </h3>
        {images.length > 0 && <span className="adm-chip">{images.length} image{images.length === 1 ? '' : 's'}</span>}
      </div>

      <div
        className={`adm-gallery-drop${dragOver ? ' is-over' : ''}${!name ? ' is-disabled' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDropZone}
      >
        <button type="button" className="adm-cover-empty" onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 size={22} className="adm-spin" /> : <ImagePlus size={22} />}
          <span>{name ? 'Click or drop screenshots here — several at once is fine' : 'Add the project name first'}</span>
          <small>JPG, PNG or WebP · up to {MAX_UPLOAD_MB} MB each · resized to 1600px WebP with AI alt text automatically</small>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="adm-upload-list" aria-live="polite">
          {queue.map((q) => (
            <li key={q.key} className={`adm-upload is-${q.stage}`}>
              {q.preview ? <img src={q.preview} alt="" /> : <span className="adm-upload-icon"><AlertTriangle size={16} /></span>}
              <div className="adm-upload-body">
                <div className="adm-upload-top">
                  <strong title={q.name}>{q.name}</strong>
                  <span>
                    {q.stage === 'done' ? <Check size={14} /> : q.stage === 'error' ? <AlertTriangle size={14} /> : <Loader2 size={14} className="adm-spin" />}
                    {stageLabel[q.stage]}{q.stage === 'uploading' ? ` ${Math.round(q.progress * 100)}%` : ''}
                  </span>
                </div>
                <div className="adm-progress"><span style={{ width: `${Math.round((q.stage === 'done' ? 1 : q.progress) * 100)}%` }} /></div>
                {q.message && <small className={q.stage === 'error' || q.message.startsWith('Added with') ? 'adm-upload-warn' : 'adm-muted'}>{q.message}</small>}
              </div>
              {(q.stage === 'done' || q.stage === 'error') && (
                <button type="button" className="adm-icon-btn" onClick={() => dismiss(q.key)} aria-label={`Dismiss ${q.name}`}><X size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <ol className="adm-gallery-grid">
          {images.map((img, i) => (
            <li
              key={img.url}
              className={`adm-gimg${dragIndex === i ? ' is-dragging' : ''}`}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onCardDrop(e, i)}
            >
              <div className="adm-gimg-media">
                <img src={img.thumb || img.url} alt="" loading="lazy" />
                <span className="adm-gimg-grip" aria-hidden="true"><GripVertical size={14} /></span>
                {i === 0 ? <span className="adm-gimg-cover"><Star size={12} /> Cover</span> : <span className="adm-gimg-num">{i + 1}</span>}
                {img.width && img.height ? <span className="adm-gimg-size">{img.width}×{img.height}</span> : null}
              </div>
              <div className="adm-gimg-fields">
                <label className="adm-field">
                  <span className="adm-field-row">Alt text <CharCounter value={img.alt} min={20} max={ALT_MAX} /></span>
                  <textarea rows={2} value={img.alt} onChange={(e) => update(i, { alt: e.target.value })} placeholder={`${name || 'Project'} screenshot ${i + 1}`} />
                </label>
                <label className="adm-field">
                  <span>Caption <small>optional, shown under the image</small></span>
                  <input value={img.caption} onChange={(e) => update(i, { caption: e.target.value })} placeholder="e.g. The booking screen on a phone" />
                </label>
              </div>
              <div className="adm-gimg-actions">
                <button type="button" className="adm-icon-btn" disabled={i === 0} onClick={() => setImages((prev) => move(prev, i, i - 1))} aria-label="Move earlier" title="Move earlier">
                  <ArrowLeft size={15} />
                </button>
                <button type="button" className="adm-icon-btn" disabled={i === images.length - 1} onClick={() => setImages((prev) => move(prev, i, i + 1))} aria-label="Move later" title="Move later">
                  <ArrowRight size={15} />
                </button>
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-xs" disabled={i === 0} onClick={() => setImages((prev) => move(prev, i, 0))}>
                  <Star size={13} /> {i === 0 ? 'Cover' : 'Set as cover'}
                </button>
                <button type="button" className="adm-btn adm-btn-ghost adm-btn-xs" disabled={regenerating.has(img.url) || !name} onClick={() => regenerate(img)}>
                  {regenerating.has(img.url) ? <Loader2 size={13} className="adm-spin" /> : <Sparkles size={13} />} Regenerate alt text
                </button>
                <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`} title="Remove">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
