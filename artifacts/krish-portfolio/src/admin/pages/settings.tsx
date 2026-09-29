import { type FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Database, Eye, EyeOff, KeyRound, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { type Ticker, type TickerIcon, tickerIcons } from '@/data/ticker';
import { useAdminAuth } from '../auth';
import {
  getSettings, getTicker, isSupabaseConnected, requestSiteRebuild, resetDemoData, saveSettings, saveTicker, type SiteSettings,
} from '../api';
import { ConfirmDialog, PageHeader, Skeleton } from '../ui';

async function rebuildLiveSite() {
  const r = await requestSiteRebuild();
  toast({ title: r.ok ? 'Updating the live site' : 'Live site not rebuilt', description: r.message });
}

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

      <TickerCard />

      <PasswordCard />

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

type DraftItem = { key: string; id?: string; label: string; icon: TickerIcon };
type Draft = { items: DraftItem[]; showSecondRow: boolean; secondRow: string[] };

const toDraft = (t: Ticker): Draft => ({
  items: t.items.map((i) => ({ key: i.id, id: i.id, label: i.label, icon: i.icon })),
  showSecondRow: t.showSecondRow,
  secondRow: [...t.secondRow],
});
// What gets saved — also used to tell whether anything changed.
const toInput = (d: Draft) => ({
  items: d.items.map(({ id, label, icon }) => ({ id, label: label.trim(), icon })).filter((i) => i.label),
  showSecondRow: d.showSecondRow,
  secondRow: d.secondRow,
});
const newKey = () => `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function TickerCard() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'ticker'], queryFn: getTicker, retry: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState<TickerIcon>('');
  const [newWord, setNewWord] = useState('');

  useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  const save = useMutation({
    mutationFn: saveTicker,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ticker'] });
      qc.invalidateQueries({ queryKey: ['public', 'ticker'] });
      toast({ title: 'Ticker saved' });
      void rebuildLiveSite();
    },
    onError: (err) => toast({ title: 'Could not save the ticker', description: err instanceof Error ? err.message : undefined }),
  });

  const header = (
    <>
      <h2 className="adm-section-title">Ticker</h2>
      <p className="adm-muted adm-small">The scrolling band under the hero. Items scroll in this order; icons are optional.</p>
    </>
  );

  if (error) {
    return (
      <section className="adm-card adm-rise" style={{ animationDelay: '.14s' }}>
        {header}
        <p className="adm-form-error" role="alert">{error instanceof Error ? error.message : 'Could not load the ticker.'}</p>
        <p className="adm-muted adm-small">Until then, the site shows the default items.</p>
      </section>
    );
  }
  if (isLoading || !draft || !data) {
    return <section className="adm-card adm-rise" style={{ animationDelay: '.14s' }}>{header}<Skeleton rows={4} /></section>;
  }

  const setItems = (items: DraftItem[]) => setDraft({ ...draft, items });
  const update = (key: string, patch: Partial<DraftItem>) =>
    setItems(draft.items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, dir: -1 | 1) => {
    const items = [...draft.items];
    [items[index], items[index + dir]] = [items[index + dir], items[index]];
    setItems(items);
  };
  const addItem = () => {
    const label = newLabel.trim();
    if (!label) return;
    setItems([...draft.items, { key: newKey(), label, icon: newIcon }]);
    setNewLabel('');
    setNewIcon('');
  };
  const addWord = () => {
    const w = newWord.trim();
    if (w && !draft.secondRow.includes(w)) setDraft({ ...draft, secondRow: [...draft.secondRow, w] });
    setNewWord('');
  };

  const input = toInput(draft);
  const dirty = JSON.stringify(input) !== JSON.stringify(toInput(toDraft(data)));

  return (
    <section className="adm-card adm-rise" style={{ animationDelay: '.14s' }}>
      <div className="adm-section-head">
        <div>{header}</div>
        <div className="adm-row-actions">
          {dirty && (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDraft(toDraft(data))} disabled={save.isPending}>
              Discard
            </button>
          )}
          <button type="button" className="adm-btn adm-btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(input)}>
            <Save size={16} /> {save.isPending ? 'Saving…' : 'Save ticker'}
          </button>
        </div>
      </div>

      {draft.items.length ? (
        <div className="adm-stat-list">
          {draft.items.map((item, i) => (
            <div key={item.key} className="adm-stat-row adm-ticker-row">
              <input
                value={item.label}
                onChange={(e) => update(item.key, { label: e.target.value })}
                placeholder="Item text"
                aria-label={`Ticker item ${i + 1}`}
              />
              <select value={item.icon} onChange={(e) => update(item.key, { icon: e.target.value as TickerIcon })} aria-label={`Icon for ${item.label || `item ${i + 1}`}`}>
                {tickerIcons.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="adm-row-actions">
                <button type="button" className="adm-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                <button type="button" className="adm-icon-btn" disabled={i === draft.items.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setItems(draft.items.filter((x) => x.key !== item.key))} aria-label={`Delete ${item.label}`}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="adm-muted adm-small" style={{ marginTop: 14 }}>No items — the site will show the default list until you add some.</p>
      )}

      <div className="adm-stat-add adm-ticker-row">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder="New item, e.g. TYPESCRIPT"
          aria-label="New ticker item"
        />
        <select value={newIcon} onChange={(e) => setNewIcon(e.target.value as TickerIcon)} aria-label="Icon for the new item">
          {tickerIcons.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" className="adm-icon-btn" onClick={addItem} disabled={!newLabel.trim()} aria-label="Add ticker item"><Plus size={16} /></button>
      </div>

      <h3 className="adm-ticker-sub">Second row <span className="adm-muted adm-small">— thinner, scrolls the other way, desktop only</span></h3>
      <div className="adm-seg adm-seg-full" style={{ maxWidth: 360 }}>
        <button type="button" className={!draft.showSecondRow ? 'is-active' : ''} onClick={() => setDraft({ ...draft, showSecondRow: false })}>Off</button>
        <button type="button" className={draft.showSecondRow ? 'is-active' : ''} onClick={() => setDraft({ ...draft, showSecondRow: true })}>On</button>
      </div>
      {draft.showSecondRow && (
        <div className="adm-roles" style={{ marginTop: 12 }}>
          {draft.secondRow.map((w) => (
            <span key={w} className="adm-role">
              {w}
              <button type="button" onClick={() => setDraft({ ...draft, secondRow: draft.secondRow.filter((x) => x !== w) })} aria-label={`Remove ${w}`}><X size={13} /></button>
            </span>
          ))}
          <span className="adm-role-add">
            <input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }}
              placeholder="Add a word…"
              aria-label="New second-row word"
            />
            <button type="button" className="adm-icon-btn" onClick={addWord} aria-label="Add word"><Plus size={15} /></button>
          </span>
        </div>
      )}
    </section>
  );
}

function PasswordCard() {
  const { updatePassword } = useAdminAuth();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const update = useMutation({
    mutationFn: () => updatePassword(next),
    onSuccess: () => {
      setNext('');
      setConfirm('');
      setError('');
      toast({ title: 'Password updated', description: "Use your new password next time you sign in." });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not update password.'),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 6) return setError('Password must be at least 6 characters.');
    if (next !== confirm) return setError('Passwords don’t match.');
    setError('');
    update.mutate();
  };

  return (
    <section className="adm-card adm-rise" style={{ animationDelay: '.15s' }}>
      <h2 className="adm-section-title">Change password</h2>
      {isSupabaseConnected ? (
        <form className="adm-form-grid" onSubmit={onSubmit}>
          <label className="adm-field">
            <span>New password</span>
            <div className="adm-input-icon">
              <KeyRound size={16} />
              <input
                type={show ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button type="button" className="adm-input-action" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="adm-field">
            <span>Confirm new password</span>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </label>
          {error && <p className="adm-form-error adm-span-2" role="alert">{error}</p>}
          <div className="adm-span-2">
            <button type="submit" className="adm-btn adm-btn-primary" disabled={update.isPending || !next || !confirm}>
              {update.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      ) : (
        <p className="adm-muted adm-small">Connect Supabase to change your sign-in password — the demo login isn’t real security.</p>
      )}
    </section>
  );
}
