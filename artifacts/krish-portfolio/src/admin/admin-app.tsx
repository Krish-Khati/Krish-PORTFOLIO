import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink, FileText, FolderKanban, Images, LayoutDashboard, LogOut, Mail, Menu, Settings, X,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation } from 'wouter';
import { AdminAuthProvider, useAdminAuth } from './auth';
import { isSupabaseConnected, listMessages } from './api';
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import PostsPage from './pages/posts';
import PostEditorPage from './pages/post-editor';
import ProjectsPage from './pages/projects';
import ImagesPage from './pages/images';
import MessagesPage from './pages/messages';
import SettingsPage from './pages/settings';
import './admin.css';

export default function AdminApp() {
  const qc = useQueryClient();

  // Leaving the admin: refetch public content so edits show up on the site straight away.
  useEffect(() => () => void qc.invalidateQueries({ queryKey: ['public'] }), [qc]);

  // The public site hides the system cursor for its custom one; restore it in the admin.
  useEffect(() => {
    document.documentElement.classList.add('admin-mode');
    const prevTitle = document.title;
    document.title = 'Admin — Krish';
    return () => {
      document.documentElement.classList.remove('admin-mode');
      document.title = prevTitle;
    };
  }, []);

  return (
    <AdminAuthProvider>
      <AdminRoutes />
    </AdminAuthProvider>
  );
}

function AdminRoutes() {
  const { session, loading } = useAdminAuth();
  const [location] = useLocation();

  if (loading) return <div className="adm-boot" aria-busy="true"><span className="adm-logo adm-logo-lg">K</span></div>;
  if (!session) return location === '/login' ? <LoginPage /> : <Redirect to="/login" replace />;
  if (location === '/login') return <Redirect to="/" replace />;

  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/posts" component={PostsPage} />
        <Route path="/posts/new">{() => <PostEditorPage />}</Route>
        <Route path="/posts/:id">{(params) => <PostEditorPage id={params.id} />}</Route>
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/images" component={ImagesPage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route><Redirect to="/" replace /></Route>
      </Switch>
    </AdminLayout>
  );
}

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/posts', label: 'Blog posts', icon: FileText },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/images', label: 'Images', icon: Images },
  { href: '/messages', label: 'Messages', icon: Mail },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAdminAuth();
  const qc = useQueryClient();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: messages } = useQuery({ queryKey: ['admin', 'messages'], queryFn: listMessages });
  const unread = messages?.filter((m) => !m.read).length ?? 0;

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location]);

  const isActive = (href: string, exact?: boolean) => (exact ? location === href : location.startsWith(href));
  const initial = session?.email[0]?.toUpperCase() ?? 'A';

  return (
    <div className={`adm${open ? ' adm-nav-open' : ''}`}>
      <aside className="adm-sidebar" aria-label="Admin navigation">
        <div className="adm-brand">
          <span className="adm-logo">K</span>
          <div>
            <strong>Krish</strong>
            <small>Admin panel</small>
          </div>
          <button type="button" className="adm-icon-btn adm-sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="adm-nav">
          {nav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`adm-nav-link${isActive(item.href, item.exact) ? ' is-active' : ''}`}
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.href === '/messages' && unread > 0 && <span className="adm-nav-badge">{unread}</span>}
            </Link>
          ))}
        </nav>

        <div className="adm-sidebar-foot">
          <a href={import.meta.env.BASE_URL} target="_blank" rel="noreferrer" className="adm-nav-link">
            <ExternalLink size={18} /><span>View site</span>
          </a>
          <button type="button" className="adm-nav-link" onClick={() => { qc.removeQueries({ queryKey: ['admin'] }); void signOut(); }}>
            <LogOut size={18} /><span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="adm-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="adm-main">
        <header className="adm-topbar">
          <button type="button" className="adm-icon-btn adm-menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          {isSupabaseConnected ? (
            <span className="adm-live-pill"><span className="adm-live-dot" /> Live · Supabase</span>
          ) : (
            <span className="adm-demo-pill" title="Data is stored only in this browser until Supabase is connected">
              <span className="adm-demo-dot" /> Demo data · Supabase not connected
            </span>
          )}
          <div className="adm-user">
            <span className="adm-avatar">{initial}</span>
            <span className="adm-user-email">{session?.email}</span>
          </div>
        </header>
        <main className="adm-content" key={location}>
          {children}
        </main>
      </div>
    </div>
  );
}
