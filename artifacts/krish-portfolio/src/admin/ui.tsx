import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage } from './api';

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus());
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="adm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" role="dialog" aria-modal="true" aria-label={title} ref={panelRef} style={{ maxWidth: width }}>
        <header className="adm-modal-head">
          <h2>{title}</h2>
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="adm-modal-body">{children}</div>
        {footer && <footer className="adm-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="adm-btn adm-btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="adm-confirm">
        <span className="adm-confirm-icon"><AlertTriangle size={20} /></span>
        <div>{body}</div>
      </div>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <span className="adm-empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="adm-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}
    </div>
  );
}

export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / 900, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

// Shared image upload/preview control — used by the Images page (hero/about/project photos)
// and the Skills page (tool logos). Uploads through uploadImage() in api.ts.
export function ImagePicker({
  value,
  onChange,
  aspect,
  folder,
  maxMB,
  busy,
  small,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect: string;
  folder?: string;
  maxMB?: number;
  busy?: boolean;
  small?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [value]);

  const upload = async (file?: File) => {
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      onChange(await uploadImage(file, folder, maxMB));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const working = uploading || busy;

  return (
    <div className={small ? 'adm-images-picker-small' : undefined}>
      <div
        className={`adm-cover-drop${value && !broken ? ' has-image' : ''}`}
        style={{ aspectRatio: aspect }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
      >
        {value && !broken ? (
          <>
            <img src={value} alt="" onError={() => setBroken(true)} />
            <button type="button" className="adm-cover-remove" onClick={() => onChange('')} aria-label="Remove image">
              <X size={15} />
            </button>
          </>
        ) : (
          <button type="button" className="adm-cover-empty" onClick={() => fileRef.current?.click()} disabled={working}>
            {working ? <Loader2 size={small ? 16 : 22} className="adm-spin" /> : <ImagePlus size={small ? 16 : 22} />}
            {!small && <span>{working ? 'Uploading…' : broken ? "Image couldn't load — pick another" : 'Click or drop an image'}</span>}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      {value && !broken && !small && (
        <button type="button" className="adm-btn adm-btn-ghost adm-cover-replace" onClick={() => fileRef.current?.click()} disabled={working}>
          {working ? <Loader2 size={15} className="adm-spin" /> : <ImagePlus size={15} />} {working ? 'Uploading…' : 'Replace image'}
        </button>
      )}
      {err && <p className="adm-form-error" role="alert">{err}</p>}
    </div>
  );
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
