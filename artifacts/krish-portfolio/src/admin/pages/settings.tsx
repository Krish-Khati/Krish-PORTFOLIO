import { type FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, RotateCcw, Save, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSettings, isSupabaseConnected, resetDemoData, saveSettings, type SiteSettings } from '../api';
import { ConfirmDialog, PageHeader, Skeleton } from '../ui';

const socialFields: { key: keyof SiteSettings; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'github', label: 'GitHub' },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: getSettings });
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [newRole, setNewRole] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast({ title: 'Settings saved' });
    },
  });

  const reset = useMutation({
    mutationFn: resetDemoData,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast({ title: 'Demo data restored' });
      setConfirmReset(false);
    },
  });

  if (isLoading || !form) return <div className="adm-page"><Skeleton rows={8} /></div>;

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setForm({ ...form, [key]: value });
  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  const addRole = () => {
    const r = newRole.trim();
    if (r && !form.roles.includes(r)) set('roles', [...form.roles, r]);
    setNewRole('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  return (
    <div className="adm-page">
      <PageHeader
        title="Settings"
        subtitle="Profile details and links used across your portfolio."
        actions={
          <button type="submit" form="settings-form" className="adm-btn adm-btn-primary" disabled={!dirty || save.isPending}>
            <Save size={16} /> {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <form id="settings-form" className="adm-settings" onSubmit={onSubmit}>
        <section className="adm-card adm-rise">
          <h2 className="adm-section-title">Profile</h2>
          <div className="adm-form-grid">
            <label className="adm-field"><span>Name</span><input value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label className="adm-field"><span>Location</span><input value={form.location} onChange={(e) => set('location', e.target.value)} /></label>
            <label className="adm-field"><span>Email</span><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
            <label className="adm-field"><span>Phone</span><input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="adm-field adm-span-2"><span>Hero description</span><textarea rows={3} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
          </div>
        </section>

        <section className="adm-card adm-rise" style={{ animationDelay: '.06s' }}>
          <h2 className="adm-section-title">Typewriter roles</h2>
          <p className="adm-muted adm-small">The rotating titles under your name in the hero.</p>
          <div className="adm-roles">
            {form.roles.map((r) => (
              <span key={r} className="adm-role">
                {r}
                <button type="button" onClick={() => set('roles', form.roles.filter((x) => x !== r))} aria-label={`Remove ${r}`}><X size={13} /></button>
              </span>
            ))}
            <span className="adm-role-add">
              <input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
                placeholder="Add a role…"
                aria-label="New role"
              />
              <button type="button" className="adm-icon-btn" onClick={addRole} aria-label="Add role"><Plus size={15} /></button>
            </span>
          </div>
        </section>

        <section className="adm-card adm-rise" style={{ animationDelay: '.12s' }}>
          <h2 className="adm-section-title">Social links</h2>
          <div className="adm-form-grid">
            {socialFields.map((f) => (
              <label key={f.key} className="adm-field">
                <span>{f.label}</span>
                <input type="url" value={form[f.key] as string} onChange={(e) => set(f.key, e.target.value)} placeholder="https://…" />
              </label>
            ))}
          </div>
        </section>
      </form>

      <section className="adm-card adm-rise adm-supabase" style={{ animationDelay: '.18s' }}>
        <span className="adm-stat-icon"><Database size={20} /></span>
        <div className="adm-grow">
          <h2 className="adm-section-title">Database</h2>
          <p className="adm-muted adm-small">
            {isSupabaseConnected
              ? 'Connected to Supabase. Changes are saved to the database and show up on the live site.'
              : 'Not connected yet. All admin data is stored only in this browser. Connecting Supabase will make it permanent and live on the site.'}
          </p>
        </div>
        <span className={`adm-status ${isSupabaseConnected ? 'adm-status-published' : 'adm-status-draft'}`}>
          {isSupabaseConnected ? 'Connected' : 'Demo mode'}
        </span>
      </section>

      {!isSupabaseConnected && (
      <section className="adm-card adm-danger-zone adm-rise" style={{ animationDelay: '.24s' }}>
        <div className="adm-grow">
          <h2 className="adm-section-title">Reset demo data</h2>
          <p className="adm-muted adm-small">Throw away every change made in this browser and restore the starter posts, projects and messages.</p>
        </div>
        <button type="button" className="adm-btn adm-btn-danger-ghost" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={16} /> Reset
        </button>
      </section>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset all demo data?"
        body="Every post, project, message and setting you changed in this browser will go back to the starter content."
        confirmLabel="Reset data"
        busy={reset.isPending}
        onConfirm={() => reset.mutate()}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
