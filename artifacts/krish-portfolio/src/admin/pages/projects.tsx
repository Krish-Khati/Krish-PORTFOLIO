import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, FolderKanban, Github, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { type AdminProject, deleteProject, listProjects, moveProject, saveProject } from '../api';
import { ConfirmDialog, EmptyState, Modal, PageHeader, Skeleton } from '../ui';

type Form = { id?: string; name: string; description: string; url: string };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'projects'], queryFn: listProjects });
  const [editing, setEditing] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<AdminProject | null>(null);
  const [formError, setFormError] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'projects'] });

  const save = useMutation({
    mutationFn: saveProject,
    onSuccess: (_, input) => {
      refresh();
      toast({ title: input.id ? 'Project updated' : 'Project added', description: input.name });
      setEditing(null);
    },
  });
  const move = useMutation({ mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => moveProject(id, dir), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      refresh();
      toast({ title: 'Project deleted', description: toDelete?.name });
      setToDelete(null);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const name = editing.name.trim();
    const url = editing.url.trim();
    if (!name) return setFormError('Project name is required.');
    if (url && !/^https?:\/\//.test(url)) return setFormError('Link must start with http:// or https://');
    setFormError('');
    save.mutate({ ...editing, name, url, description: editing.description.trim() });
  };

  const open = (form: Form) => {
    setFormError('');
    setEditing(form);
  };

  return (
    <div className="adm-page">
      <PageHeader
        title="Projects"
        subtitle="The projects listed in the “Things built to learn” section, in display order."
        actions={
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => open({ name: '', description: '', url: '' })}>
            <Plus size={16} /> Add project
          </button>
        }
      />

      {isLoading ? <Skeleton rows={5} /> : !data?.length ? (
        <EmptyState icon={<FolderKanban size={26} />} title="No projects yet" body="Add the first thing you've built." />
      ) : (
        <div className="adm-project-grid">
          {data.map((p, i) => (
            <article key={p.id} className="adm-project adm-rise" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="adm-project-top">
                <span className="adm-project-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="adm-project-order">
                  <button type="button" className="adm-icon-btn" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: p.id, dir: -1 })} aria-label="Move up">
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" className="adm-icon-btn" disabled={i === data.length - 1 || move.isPending} onClick={() => move.mutate({ id: p.id, dir: 1 })} aria-label="Move down">
                    <ArrowDown size={15} />
                  </button>
                </div>
              </div>
              <h3>{p.name}</h3>
              <p>{p.description || <span className="adm-muted">No description.</span>}</p>
              <div className="adm-project-foot">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="adm-link">
                    {p.url.includes('github.com') ? <Github size={14} /> : <ExternalLink size={14} />} Open link
                  </a>
                ) : <span className="adm-muted adm-small">Personal project</span>}
                <div className="adm-row-actions">
                  <button type="button" className="adm-icon-btn" onClick={() => open({ id: p.id, name: p.name, description: p.description, url: p.url })} aria-label={`Edit ${p.name}`}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit project' : 'Add project'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="project-form" className="adm-btn adm-btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save project'}
            </button>
          </>
        }
      >
        {editing && (
          <form id="project-form" className="adm-form" onSubmit={onSubmit}>
            <label className="adm-field">
              <span>Name</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Fitness Temple" />
            </label>
            <label className="adm-field">
              <span>Description</span>
              <textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="What it is and what you learned building it." />
            </label>
            <label className="adm-field">
              <span>Link <small>(optional — GitHub or live site)</small></span>
              <input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://github.com/KRRISH972/…" />
            </label>
            {formError && <p className="adm-form-error" role="alert">{formError}</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this project?"
        body={<><strong>{toDelete?.name}</strong> will be removed from your portfolio.</>}
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
