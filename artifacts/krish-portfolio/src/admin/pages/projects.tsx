import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, FolderKanban, Images, ListChecks, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from '@/hooks/use-toast';
import { projectPath } from '@/data/projects';
import { META_MAX, META_MIN } from '@/seo/score';
import { type AdminProject, deleteProject, listProjects, moveProject, requestSiteRebuild } from '../api';
import { ConfirmDialog, EmptyState, PageHeader, Skeleton } from '../ui';

async function rebuildLiveSite() {
  const r = await requestSiteRebuild();
  toast({ title: r.ok ? 'Updating the live site' : 'Live site not rebuilt', description: r.message });
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'projects'], queryFn: listProjects });
  const [toDelete, setToDelete] = useState<AdminProject | null>(null);
  const rebuildTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'projects'] });

  // Reordering several times in a row triggers one rebuild, a few seconds after the last move
  // (or straight away when leaving the page before then).
  const scheduleRebuild = () => {
    clearTimeout(rebuildTimer.current);
    rebuildTimer.current = setTimeout(() => {
      rebuildTimer.current = undefined;
      void rebuildLiveSite();
    }, 4000);
  };
  useEffect(() => () => {
    if (rebuildTimer.current) {
      clearTimeout(rebuildTimer.current);
      void rebuildLiveSite();
    }
  }, []);

  const move = useMutation({
    mutationFn: ({ id, dir }: { id: string; dir: -1 | 1 }) => moveProject(id, dir),
    onSuccess: () => { refresh(); scheduleRebuild(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      refresh();
      toast({ title: 'Project deleted', description: toDelete?.name });
      setToDelete(null);
      void rebuildLiveSite();
    },
  });

  return (
    <div className="adm-page">
      <PageHeader
        title="Projects"
        subtitle="The projects in the “Things built to learn” section and on /projects, in display order."
        actions={<Link href="/projects/new" className="adm-btn adm-btn-primary"><Plus size={16} /> Add project</Link>}
      />

      {isLoading ? <Skeleton rows={5} /> : !data?.length ? (
        <EmptyState
          icon={<FolderKanban size={26} />}
          title="No projects yet"
          body="Add the first thing you've built."
          action={<Link href="/projects/new" className="adm-btn adm-btn-primary"><Plus size={16} /> Add project</Link>}
        />
      ) : (
        <div className="adm-project-grid">
          {data.map((p, i) => {
            const cover = p.gallery[0];
            const metaLen = p.metaDescription.trim().length;
            return (
              <article key={p.id} className="adm-project adm-rise" style={{ animationDelay: `${i * 0.05}s` }}>
                <Link href={`/projects/${p.id}`} className="adm-project-cover" aria-label={`Edit ${p.name}`}>
                  {cover ? <img src={cover.thumb || cover.url} alt="" loading="lazy" /> : <span>{p.name}</span>}
                  <span className="adm-project-num">{String(i + 1).padStart(2, '0')}</span>
                </Link>
                <div className="adm-project-top">
                  <h3>
                    {p.featured && <Star size={15} className="adm-star" aria-label="Featured" />}
                    {p.name}
                  </h3>
                  <div className="adm-project-order">
                    <button type="button" className="adm-icon-btn" disabled={i === 0 || move.isPending} onClick={() => move.mutate({ id: p.id, dir: -1 })} aria-label="Move up">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className="adm-icon-btn" disabled={i === data.length - 1 || move.isPending} onClick={() => move.mutate({ id: p.id, dir: 1 })} aria-label="Move down">
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
                <p>{p.description || <span className="adm-muted">No description.</span>}</p>
                <div className="adm-project-meta">
                  {p.badge && <span className="adm-chip">{p.badge}</span>}
                  <span className="adm-chip"><Images size={12} /> {p.gallery.length}</span>
                  <span className="adm-chip"><ListChecks size={12} /> {p.features.length}</span>
                  <span className={`adm-chip ${metaLen >= META_MIN && metaLen <= META_MAX ? 'adm-chip-ok' : 'adm-chip-warn'}`} title="Meta description length">
                    SEO {metaLen ? `${metaLen} chars` : 'no meta'}
                  </span>
                </div>
                <div className="adm-project-foot">
                  <a href={projectPath(p.slug)} target="_blank" rel="noreferrer" className="adm-link">
                    <ExternalLink size={14} /> /projects/{p.slug}
                  </a>
                  <div className="adm-row-actions">
                    <Link href={`/projects/${p.id}`} className="adm-icon-btn" aria-label={`Edit ${p.name}`}>
                      <Pencil size={16} />
                    </Link>
                    <button type="button" className="adm-icon-btn adm-icon-danger" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
