import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Inbox, Mail, MailOpen, Reply, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { deleteMessage, listMessages, setMessageRead } from '../api';
import { ConfirmDialog, EmptyState, PageHeader, relativeTime, Skeleton } from '../ui';

type Filter = 'all' | 'unread';

export default function MessagesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'messages'], queryFn: listMessages });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'messages'] });
  const markRead = useMutation({ mutationFn: ({ id, read }: { id: string; read: boolean }) => setMessageRead(id, read), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: () => {
      refresh();
      toast({ title: 'Message deleted' });
      setConfirmDelete(false);
      setSelectedId(null);
    },
  });

  const list = useMemo(() => (data ?? []).filter((m) => filter === 'all' || !m.read), [data, filter]);
  const selected = data?.find((m) => m.id === selectedId) ?? null;
  const unread = data?.filter((m) => !m.read).length ?? 0;

  // Opening a message marks it as read.
  useEffect(() => {
    if (selected && !selected.read) markRead.mutate({ id: selected.id, read: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return (
    <div className="adm-page">
      <PageHeader
        title="Messages"
        subtitle={unread ? `${unread} unread message${unread === 1 ? '' : 's'} from your contact form.` : 'Messages sent through your contact form.'}
      />

      <div className={`adm-inbox adm-rise${selected ? ' has-selection' : ''}`}>
        <div className="adm-inbox-list">
          <div className="adm-tabs adm-tabs-sm">
            {(['all', 'unread'] as Filter[]).map((f) => (
              <button key={f} type="button" className={`adm-tab${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : 'Unread'}
                <span className="adm-tab-count">{f === 'all' ? data?.length ?? 0 : unread}</span>
              </button>
            ))}
          </div>
          {isLoading ? <div className="adm-pad"><Skeleton rows={4} /></div> : list.length === 0 ? (
            <EmptyState icon={<Inbox size={24} />} title={filter === 'unread' ? 'All caught up' : 'Inbox is empty'} body={filter === 'unread' ? 'No unread messages.' : 'Messages from your contact form will show up here.'} />
          ) : (
            <ul>
              {list.map((m, i) => (
                <li key={m.id} className="adm-row-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <button
                    type="button"
                    className={`adm-inbox-item${m.id === selectedId ? ' is-active' : ''}${m.read ? '' : ' is-unread'}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <span className="adm-avatar adm-avatar-sm">{m.name.replace(/^Sample:\s*/, '')[0]}</span>
                    <span className="adm-grow">
                      <span className="adm-inbox-top">
                        <strong>{m.name}</strong>
                        <small>{relativeTime(m.createdAt)}</small>
                      </span>
                      <small className="adm-truncate">{m.message}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="adm-inbox-read">
          {selected ? (
            <article key={selected.id} className="adm-message adm-rise">
              <button type="button" className="adm-link adm-inbox-back" onClick={() => setSelectedId(null)}>
                <ArrowLeft size={16} /> Inbox
              </button>
              <header className="adm-message-head">
                <span className="adm-avatar">{selected.name.replace(/^Sample:\s*/, '')[0]}</span>
                <div className="adm-grow">
                  <h2>{selected.name}</h2>
                  <a href={`mailto:${selected.email}`} className="adm-muted">{selected.email}</a>
                </div>
                <small className="adm-muted">{new Date(selected.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>
              </header>
              <p className="adm-message-body">{selected.message}</p>
              <div className="adm-message-actions">
                <a
                  className="adm-btn adm-btn-primary"
                  href={`mailto:${selected.email}?subject=${encodeURIComponent('Re: your message on my portfolio')}`}
                >
                  <Reply size={16} /> Reply by email
                </a>
                <button type="button" className="adm-btn adm-btn-ghost" onClick={() => markRead.mutate({ id: selected.id, read: !selected.read })}>
                  {selected.read ? <><Mail size={16} /> Mark unread</> : <><MailOpen size={16} /> Mark read</>}
                </button>
                <button type="button" className="adm-btn adm-btn-ghost adm-text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </article>
          ) : (
            <EmptyState icon={<MailOpen size={26} />} title="Select a message" body="Pick a message from the list to read it here." />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this message?"
        body={<>The message from <strong>{selected?.name}</strong> will be permanently removed.</>}
        busy={remove.isPending}
        onConfirm={() => selected && remove.mutate(selected.id)}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
