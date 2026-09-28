import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSettings, listProjects, saveProject, saveSettings, type SiteSettings, uploadImage } from '../api';
import { PageHeader, Skeleton } from '../ui';

export default function ImagesPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading: settingsLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: getSettings });
  const { data: projects, isLoading: projectsLoading } = useQuery({ queryKey: ['admin', 'projects'], queryFn: listProjects });

  const saveSettingsField = useMutation({
    mutationFn: (next: SiteSettings) => saveSettings(next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast({ title: 'Image updated' });
    },
  });

  const saveProjectImage = useMutation({
    mutationFn: (input: { id: string; name: string; description: string; url: string; image: string }) => saveProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
      toast({ title: 'Project image updated' });
    },
    onError: (err) => toast({ title: 'Could not save', description: err instanceof Error ? err.message : undefined }),
  });

  return (
    <div className="adm-page">
      <PageHeader title="Images" subtitle="Photos used across the site — change them here, no code needed." />

      {settingsLoading || !settings ? (
        <Skeleton rows={4} />
      ) : (
        <div className="adm-form-grid" style={{ marginBottom: 22 }}>
          <div className="adm-card adm-rise">
            <h2 className="adm-section-title">Hero background</h2>
            <p className="adm-muted adm-small">Shown behind your name at the top of the site. Leave empty to keep the video.</p>
            <ImagePicker
              aspect="16 / 9"
              value={settings.heroImage}
              busy={saveSettingsField.isPending}
              onChange={(image) => saveSettingsField.mutate({ ...settings, heroImage: image })}
            />
          </div>

          <div className="adm-card adm-rise" style={{ animationDelay: '.06s' }}>
            <h2 className="adm-section-title">About / My journey photo</h2>
            <p className="adm-muted adm-small">Your photo in the "Small town. Big intent." section.</p>
            <ImagePicker
              aspect="4 / 5"
              value={settings.aboutPhoto}
              busy={saveSettingsField.isPending}
              onChange={(image) => saveSettingsField.mutate({ ...settings, aboutPhoto: image })}
            />
          </div>
        </div>
      )}

      <section className="adm-card adm-rise" style={{ animationDelay: '.12s' }}>
        <h2 className="adm-section-title">Project images</h2>
        <p className="adm-muted adm-small">A thumbnail shown next to each project in "Things built to learn."</p>
        {projectsLoading || !projects ? (
          <Skeleton rows={3} />
        ) : !projects.length ? (
          <p className="adm-muted adm-small">Add a project on the Projects page first.</p>
        ) : (
          <div className="adm-images-projects">
            {projects.map((p) => (
              <div className="adm-images-project" key={p.id}>
                <ImagePicker
                  aspect="1 / 1"
                  small
                  value={p.image}
                  busy={saveProjectImage.isPending}
                  onChange={(image) => saveProjectImage.mutate({ id: p.id, name: p.name, description: p.description, url: p.url, image })}
                />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ImagePicker({
  value,
  onChange,
  aspect,
  busy,
  small,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect: string;
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
      onChange(await uploadImage(file));
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
