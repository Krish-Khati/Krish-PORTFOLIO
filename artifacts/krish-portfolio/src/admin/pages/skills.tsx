import { type FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type AdminStat, type AdminTool, deleteStat, deleteTool, listStats, listTools,
  moveStat, moveTool, saveStat, saveTool,
} from '../api';
import { ConfirmDialog, EmptyState, ImagePicker, Modal, PageHeader, Skeleton } from '../ui';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');

export default function SkillsPage() {
  return (
    <div className="adm-page">
      <PageHeader title="Skills" subtitle="The tools and stats shown in the “My Capabilities” section." />
      <ToolsSection />
      <StatsSection />
    </div>
  );
}

function ToolsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'tools'], queryFn: listTools });
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<AdminTool | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'tools'] });

  const save = useMutation({
    mutationFn: saveTool,
    onSuccess: (_, input) => {
      refresh();
      toast({ title: input.id ? 'Tool updated' : 'Tool added', description: input.name });
      setAdding(false);
    },
    onError: (err) => toast({ title: 'Could not save', description: errorMessage(err) }),
  });
  const move = useMutation({ mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => moveTool(id, dir), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => deleteTool(id),
    onSuccess: () => {
      refresh();
      toast({ title: 'Tool deleted', description: toDelete?.name });
      setToDelete(null);
    },
    onError: (err) => toast({ title: 'Could not delete', description: errorMessage(err) }),
  });

  return (
    <section className="adm-card adm-rise" style={{ marginBottom: 22 }}>
      <div className="adm-section-head">
        <div>
          <h2 className="adm-section-title">Tools</h2>
          <p className="adm-muted adm-small">The icon grid under “My Capabilities.”</p>
        </div>
        <button type="button" className="adm-btn adm-btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add tool
        </button>
      </div>

      {isLoading ? <Skeleton rows={3} /> : !data?.length ? (
        <EmptyState icon={<Sparkles size={26} />} title="No tools yet" body="Add the first tool you use." />
      ) : (
        <div className="adm-images-projects">
          {data.map((tool, i) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              index={i}
              count={data.length}
              onMove={(dir) => move.mutate({ id: tool.id, dir })}
              onDelete={() => setToDelete(tool)}
              onSave={(patch) => save.mutate({ id: tool.id, name: tool.name, logoUrl: tool.logoUrl, ...patch })}
              busy={save.isPending}
            />
          ))}
        </div>
      )}

      <Modal
        open={adding}
        title="Add tool"
        onClose={() => setAdding(false)}
        footer={
          <>
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" form="add-tool-form" className="adm-btn adm-btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Add tool'}
            </button>
          </>
        }
      >
        <AddToolForm onSubmit={(input) => save.mutate(input)} />
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this tool?"
        body={<><strong>{toDelete?.name}</strong> will be removed from your capabilities grid.</>}
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

function AddToolForm({ onSubmit }: { onSubmit: (input: { name: string; logoUrl: string }) => void }) {
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the tool a name.');
    setError('');
    onSubmit({ name: trimmed, logoUrl });
  };

  return (
    <form id="add-tool-form" className="adm-form" onSubmit={submit}>
      <label className="adm-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude" autoFocus />
      </label>
      <div className="adm-field">
        <span>Logo <small>(optional — falls back to a line icon or initial)</small></span>
        <ImagePicker aspect="1 / 1" folder="tools" maxMB={2} value={logoUrl} onChange={setLogoUrl} />
      </div>
      {error && <p className="adm-form-error" role="alert">{error}</p>}
    </form>
  );
}

function ToolCard({
  tool, index, count, onMove, onDelete, onSave, busy,
}: {
  tool: AdminTool;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onSave: (patch: { name?: string; logoUrl?: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(tool.name);
  useEffect(() => setName(tool.name), [tool.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tool.name) onSave({ name: trimmed });
    else setName(tool.name);
  };

  return (
    <div className="adm-images-project adm-tool-card">
      <ImagePicker aspect="1 / 1" small folder="tools" maxMB={2} value={tool.logoUrl} busy={busy} onChange={(logoUrl) => onSave({ logoUrl })} />
      <input
        className="adm-tool-name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        aria-label={`${tool.name} name`}
      />
      <div className="adm-row-actions">
        <button type="button" className="adm-icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp size={14} /></button>
        <button type="button" className="adm-icon-btn" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown size={14} /></button>
        <button type="button" className="adm-icon-btn adm-icon-danger" onClick={onDelete} aria-label={`Delete ${tool.name}`}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function StatsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: listStats });
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [toDelete, setToDelete] = useState<AdminStat | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'stats'] });

  const save = useMutation({
    mutationFn: saveStat,
    onSuccess: (_, input) => {
      refresh();
      toast({ title: input.id ? 'Stat updated' : 'Stat added' });
      if (!input.id) { setValue(''); setLabel(''); }
    },
    onError: (err) => toast({ title: 'Could not save', description: errorMessage(err) }),
  });
  const move = useMutation({ mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => moveStat(id, dir), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => deleteStat(id),
    onSuccess: () => {
      refresh();
      toast({ title: 'Stat deleted' });
      setToDelete(null);
    },
    onError: (err) => toast({ title: 'Could not delete', description: errorMessage(err) }),
  });

  const addStat = () => {
    const v = value.trim();
    const l = label.trim();
    if (!v || !l) return;
    save.mutate({ value: v, label: l });
  };

  return (
    <section className="adm-card adm-rise" style={{ animationDelay: '.08s' }}>
      <h2 className="adm-section-title">Stats</h2>
      <p className="adm-muted adm-small">The counters below the tools grid — e.g. “500+ Development Hours.”</p>

      {isLoading ? <Skeleton rows={2} /> : !data?.length ? (
        <p className="adm-muted adm-small">No stats yet — add one below.</p>
      ) : (
        <div className="adm-stat-list">
          {data.map((stat, i) => (
            <StatRow
              key={stat.id}
              stat={stat}
              index={i}
              count={data.length}
              onMove={(dir) => move.mutate({ id: stat.id, dir })}
              onDelete={() => setToDelete(stat)}
              onSave={(patch) => save.mutate({ id: stat.id, value: stat.value, label: stat.label, ...patch })}
            />
          ))}
        </div>
      )}

      <div className="adm-stat-add">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value, e.g. 500+" aria-label="New stat value" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. Development Hours" aria-label="New stat label" />
        <button type="button" className="adm-icon-btn" onClick={addStat} disabled={!value.trim() || !label.trim() || save.isPending} aria-label="Add stat">
          <Plus size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this stat?"
        body={<><strong>{toDelete?.value} {toDelete?.label}</strong> will be removed.</>}
        busy={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}

function StatRow({
  stat, index, count, onMove, onDelete, onSave,
}: {
  stat: AdminStat;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onSave: (patch: { value?: string; label?: string }) => void;
}) {
  const [value, setValue] = useState(stat.value);
  const [label, setLabel] = useState(stat.label);
  useEffect(() => { setValue(stat.value); setLabel(stat.label); }, [stat.value, stat.label]);

  const commit = () => {
    const v = value.trim();
    const l = label.trim();
    const patch: { value?: string; label?: string } = {};
    if (v && v !== stat.value) patch.value = v;
    if (l && l !== stat.label) patch.label = l;
    if (Object.keys(patch).length) onSave(patch);
    if (!v) setValue(stat.value);
    if (!l) setLabel(stat.label);
  };

  return (
    <div className="adm-stat-row">
      <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} aria-label="Stat value" />
      <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={commit} aria-label="Stat label" />
      <div className="adm-row-actions">
        <button type="button" className="adm-icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp size={14} /></button>
        <button type="button" className="adm-icon-btn" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown size={14} /></button>
        <button type="button" className="adm-icon-btn adm-icon-danger" onClick={onDelete} aria-label="Delete stat"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
