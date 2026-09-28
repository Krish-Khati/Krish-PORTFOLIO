import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, ListTodo, Pencil, Plus, ScrollText, Trash2, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type AdminTopic, deleteTopic, getAutoPostSettings, listAutoRuns, listTopics,
  moveTopic, type PostCategory, postCategories, saveAutoPostSettings, saveTopic,
} from '../api';
import { ConfirmDialog, EmptyState, Modal, PageHeader, relativeTime, Skeleton } from '../ui';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

export default function AutoPostsPage() {
  return (
    <div className="adm-page">
      <PageHeader
        title="Auto posts"
        subtitle="A scheduled GitHub Action writes a post with Gemini on Monday, Wednesday and Friday."
      />
      <PublishToggle />
      <TopicQueue />
      <RecentRuns />
    </div>
  );
}

function PublishToggle() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'auto-post-settings'], queryFn: getAutoPostSettings });

  const save = useMutation({
    mutationFn: saveAutoPostSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'auto-post-settings'] });
      toast({ title: 'Setting saved' });
    },
    onError: (err) => toast({ title: 'Could not save', description: errorMessage(err) }),
  });

  const on = data?.publishAutomatically ?? false;

  return (
    <section className="adm-card adm-rise">
      <h2 className="adm-section-title">Publish automatically</h2>
      <p className="adm-muted adm-small">
        Off (default): new auto-generated posts are saved as drafts, so you can read and edit before they go live.
        On: they're published straight away.
      </p>
      {isLoading ? <Skeleton rows={1} /> : (
        <div className="adm-seg adm-seg-full" style={{ maxWidth: 360 }}>
          <button type="button" className={!on ? 'is-active' : ''} disabled={save.isPending} onClick={() => save.mutate({ publishAutomatically: false })}>
            Off — save as drafts
          </button>
          <button type="button" className={on ? 'is-active' : ''} disabled={save.isPending} onClick={() => save.mutate({ publishAutomatically: true })}>
            On — publish live
          </button>
        </div>
      )}
    </section>
  );
}

type Form = { id?: string; title: string; notes: string; category: PostCategory };
const emptyForm = (): Form => ({ title: '', notes: '', category: 'Journey' });

function TopicQueue() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'topics'], queryFn: listTopics });
  const [editing, setEditing] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<AdminTopic | null>(null);
  const [formError, setFormError] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'topics'] });

  const save = useMutation({
    mutationFn: saveTopic,
    onSuccess: (_, input) => {
      refresh();
      toast({ title: input.id ? 'Topic updated' : 'Topic added', description: input.title });
      setEditing(null);
    },
    onError: (err) => toast({ title: 'Could not save', description: errorMessage(err) }),
  });
  const move = useMutation({ mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => moveTopic(id, dir), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTopic(id),
    onSuccess: () => {
      refresh();
      toast({ title: 'Topic deleted', description: toDelete?.title });
      setToDelete(null);
    },
    onError: (err) => toast({ title: 'Could not delete', description: errorMessage(err) }),
  });

  const open = (form: Form) => {
    setFormError('');
    setEditing(form);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const title = editing.title.trim();
    if (!title) return setFormError('Give the topic a title.');
    setFormError('');
    save.mutate({ ...editing, title, notes: editing.notes.trim() });
  };

  return (
    <section className="adm-card adm-card-flush adm-rise" style={{ animationDelay: '.06s' }}>
      <div className="adm-section-head adm-pad" style={{ paddingBottom: 0 }}>
        <div>
          <h2 className="adm-section-title">Topic queue</h2>
          <p className="adm-muted adm-small">
            The next pending topic (top of the list) is used first. Empty queue: Gemini picks a fresh topic itself.
          </p>
        </div>
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => open(emptyForm())}>
          <Plus size={16} /> Add topic
        </button>
      </div>

      {isLoading ? <div className="adm-pad"><Skeleton rows={3} /></div> : !data?.length ? (
        <div className="adm-pad">
          <EmptyState icon={<ListTodo size={26} />} title="Queue is empty" body="Gemini will pick its own topic until you add one." />
        </div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>Topic</th>
              <th className="adm-hide-sm">Category</th>
              <th>Status</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {data.map((t, i) => (
              <tr key={t.id} className="adm-row-in" style={{ animationDelay: `${i * 0.04}s` }}>
                <td>
                  <strong>{t.title}</strong>
                  {t.notes && <small className="adm-muted adm-block">{t.notes}</small>}
                </td>
                <td className="adm-hide-sm"><span className="adm-chip">{t.category}</span></td>
                <td><span className={`adm-status adm-status-${t.status === 'pending' ? 'draft' : 'published'}`}>{t.status}</span></td>
                <td>
                  <div className="adm-row-actions">
                    <button type="button" className="adm-icon-btn" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: t.id, dir: -1 })} aria-label="Move up"><ArrowUp size={14} /></button>
                    <button type="button" className="adm-icon-btn" disabled={i === data.length - 1 || move.isPending} onClick={() => move.mutate({ id: t.id, dir: 1 })} aria-label="Move down"><ArrowDown size={14} /></button>
                    <button type="button" className="adm-icon-btn" onClick={() => open({ id: t.id, title: t.title, notes: t.notes, category: t.category })} aria-label={`Edit ${t.title}`}><Pencil size={14} /></button>
                    <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setToDelete(t)} aria-label={`Delete ${t.title}`}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit topic' : 'Add topic'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="topic-form" className="adm-btn adm-btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save topic'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="topic-form" className="adm-form" onSubmit={onSubmit}>
            <label className="adm-field">
              <span>Title idea</span>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Why I switched from Python to C" autoFocus />
            </label>
            <label className="adm-field">
              <span>Your notes <small>(optional — your own experience, Gemini will build the post around this)</small></span>
              <textarea rows={4} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="What actually happened, what you learned…" />
            </label>
            <label className="adm-field">
              <span>Category</span>
              <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as PostCategory })}>
                {postCategories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            {formError && <p className="adm-form-error" role="alert">{formError}</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this topic?"
        body={<><strong>{toDelete?.title}</strong> will be removed from the queue.</>}
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

function RecentRuns() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'auto-runs'], queryFn: listAutoRuns });

  return (
    <section className="adm-card adm-card-flush adm-rise" style={{ animationDelay: '.12s' }}>
      <div className="adm-pad" style={{ paddingBottom: 0 }}>
        <h2 className="adm-section-title">Recent runs</h2>
        <p className="adm-muted adm-small">What happened the last few times the scheduled workflow ran.</p>
      </div>

      {isLoading ? <div className="adm-pad"><Skeleton rows={3} /></div> : !data?.length ? (
        <div className="adm-pad">
          <EmptyState icon={<ScrollText size={26} />} title="No runs yet" body="Nothing has run yet — check back after the next scheduled time, or trigger it manually from the GitHub Actions tab." />
        </div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Topic</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} className="adm-row-in" style={{ animationDelay: `${i * 0.04}s` }}>
                <td className="adm-nowrap">{relativeTime(r.ranAt)}</td>
                <td>{r.topic || <span className="adm-muted">—</span>}</td>
                <td>
                  {r.status === 'success' ? (
                    <span className="adm-status adm-status-published"><CheckCircle2 size={13} /> success</span>
                  ) : (
                    <span className="adm-status adm-status-draft" title={r.message}><XCircle size={13} /> failed</span>
                  )}
                  {r.status === 'failed' && r.message && <small className="adm-muted adm-block">{r.message}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
