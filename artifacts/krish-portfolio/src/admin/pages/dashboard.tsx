import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileText, FolderKanban, Mail, PenLine, Plus, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { listMessages, listPosts, listProjects } from '../api';
import { useAdminAuth } from '../auth';
import { CountUp, relativeTime, Skeleton } from '../ui';

export default function DashboardPage() {
  const { session } = useAdminAuth();
  const posts = useQuery({ queryKey: ['admin', 'posts'], queryFn: listPosts });
  const projects = useQuery({ queryKey: ['admin', 'projects'], queryFn: listProjects });
  const messages = useQuery({ queryKey: ['admin', 'messages'], queryFn: listMessages });

  const published = posts.data?.filter((p) => p.status === 'published').length ?? 0;
  const drafts = posts.data?.filter((p) => p.status === 'draft').length ?? 0;
  const unread = messages.data?.filter((m) => !m.read).length ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = session?.email.split('@')[0] ?? 'there';

  const stats = [
    { label: 'Published posts', value: published, icon: FileText, href: '/posts' },
    { label: 'Drafts', value: drafts, icon: PenLine, href: '/posts' },
    { label: 'Projects', value: projects.data?.length ?? 0, icon: FolderKanban, href: '/projects' },
    { label: 'Unread messages', value: unread, icon: Mail, href: '/messages' },
  ];

  return (
    <div className="adm-page">
      <section className="adm-hero adm-rise">
        <div>
          <p className="adm-eyebrow"><Sparkles size={14} /> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{greeting}, <em>{name}</em>.</h1>
          <p>Here's what's happening with your portfolio today.</p>
        </div>
        <div className="adm-hero-actions">
          <Link href="/posts/new" className="adm-btn adm-btn-primary"><Plus size={16} /> New post</Link>
          <Link href="/projects" className="adm-btn adm-btn-ghost">Manage projects</Link>
        </div>
      </section>

      <section className="adm-stats">
        {stats.map((s, i) => (
          <Link key={s.label} href={s.href} className="adm-stat adm-rise" style={{ animationDelay: `${0.08 + i * 0.06}s` }}>
            <span className="adm-stat-icon"><s.icon size={20} /></span>
            <span className="adm-stat-value">{posts.isLoading ? '–' : <CountUp value={s.value} />}</span>
            <span className="adm-stat-label">{s.label}</span>
          </Link>
        ))}
      </section>

      <section className="adm-two-col">
        <div className="adm-card adm-rise" style={{ animationDelay: '.3s' }}>
          <header className="adm-card-head">
            <h2>Recent posts</h2>
            <Link href="/posts" className="adm-link">All posts <ArrowRight size={14} /></Link>
          </header>
          {posts.isLoading ? <Skeleton rows={4} /> : (
            <ul className="adm-list">
              {posts.data!.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} className="adm-list-row">
                    <div>
                      <strong>{p.title}</strong>
                      <small>{p.category} · updated {relativeTime(p.updatedAt)}</small>
                    </div>
                    <span className={`adm-status adm-status-${p.status}`}>{p.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="adm-card adm-rise" style={{ animationDelay: '.38s' }}>
          <header className="adm-card-head">
            <h2>Latest messages</h2>
            <Link href="/messages" className="adm-link">Inbox <ArrowRight size={14} /></Link>
          </header>
          {messages.isLoading ? <Skeleton rows={3} /> : messages.data!.length === 0 ? (
            <p className="adm-muted">No messages yet.</p>
          ) : (
            <ul className="adm-list">
              {messages.data!.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <Link href="/messages" className="adm-list-row">
                    <span className="adm-avatar adm-avatar-sm">{m.name.replace(/^Sample:\s*/, '')[0]}</span>
                    <div className="adm-grow">
                      <strong>{m.name}{!m.read && <span className="adm-unread-dot" aria-label="unread" />}</strong>
                      <small className="adm-truncate">{m.message}</small>
                    </div>
                    <small className="adm-muted">{relativeTime(m.createdAt)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
