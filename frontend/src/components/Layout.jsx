import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Users,
  CreditCard,
  LogOut,
  Zap,
  Menu,
  X,
  MailOpen,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SidebarOrgSwitcher from './SidebarOrgSwitcher';
import SidebarUsageWidget from './SidebarUsageWidget';

/**
 * Layout — authenticated app shell.
 *
 * DESKTOP (md+, ≥768px):
 *   Fixed 220px sidebar on the left, main content offset by ml-[220px].
 *
 * MOBILE (<768px):
 *   Sidebar is completely off-screen (translateX -100%). A top bar with
 *   a hamburger icon toggles it open as a full-height overlay.
 *
 * Theme toggle (sun/moon) sits at the bottom of the sidebar,
 * next to the user profile row, and in the mobile top bar.
 */

const NAV_LINKS = [
  { to: '/projects', label: 'Projects',      Icon: FolderOpen },
  { to: '/invites',  label: 'My Invites',    Icon: MailOpen },
  { to: '/team',     label: 'Team & Invites',Icon: Users,      minRole: 'admin' },
  { to: '/billing',  label: 'Billing',       Icon: CreditCard, minRole: 'owner' },
  { to: '/settings', label: 'Settings',      Icon: Settings },
];

const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

function meetsRole(userRole, minRole) {
  if (!minRole) return true;
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[minRole] ?? 99);
}

export default function Layout({ children }) {
  const { auth, logout }    = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate            = useNavigate();
  const { pathname }        = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  // Close sidebar when navigating (mobile)
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setSidebarOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const userInitial =
    auth?.user?.name?.[0]?.toUpperCase() ||
    auth?.user?.email?.[0]?.toUpperCase() ||
    '?';

  // ── Theme toggle button (reused in sidebar + mobile top bar) ──
  const ThemeToggle = ({ className = '' }) => (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex-shrink-0 p-1.5 rounded-lg text-tx-muted
        hover:text-tx-primary hover:bg-surface-2
        transition-colors ${className}`}
    >
      {theme === 'dark'
        ? <Sun  size={15} strokeWidth={1.8} />
        : <Moon size={15} strokeWidth={1.8} />}
    </button>
  );

  // ── Sidebar contents (shared between desktop and mobile overlay) ──
  const sidebarContents = (
    <>
      {/* Logo */}
      <div className="px-4 h-14 flex items-center gap-2.5 border-b border-line flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-bold text-tx-primary tracking-tight">
          TeamFlow
        </span>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="ml-auto md:hidden text-tx-muted hover:text-tx-primary p-1 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* Org switcher */}
      <div className="px-3 py-3 border-b border-line flex-shrink-0">
        <SidebarOrgSwitcher />
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_LINKS.filter(({ minRole }) => meetsRole(auth?.role, minRole)).map(
          ({ to, label, Icon }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-bg text-accent-text'
                    : 'text-tx-secondary hover:bg-surface-2 hover:text-tx-primary'
                }`}
              >
                <Icon
                  size={16}
                  className={active ? 'text-accent' : 'text-tx-muted'}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {label}
              </Link>
            );
          }
        )}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 border-t border-line">
        {auth?.org && <SidebarUsageWidget />}

        {/* User row + theme toggle */}
        <div className="px-3 py-3 flex items-center gap-2.5">
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-accent-bg text-accent-text text-xs font-bold flex items-center justify-center flex-shrink-0">
            {userInitial}
          </div>

          {/* Name + email */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {auth?.user?.name && (
              <span className="text-sm font-medium text-tx-primary truncate leading-tight">
                {auth.user.name}
              </span>
            )}
            <span className={`text-xs text-tx-muted truncate leading-tight ${auth?.user?.name ? 'mt-0.5' : ''}`}>
              {auth?.user?.email}
            </span>
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Sign out */}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex-shrink-0 text-tx-muted hover:text-tx-primary transition-colors p-1"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-surface-0">

      {/* ── DESKTOP sidebar (hidden below md) ─────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[220px] flex-col bg-surface-1 border-r border-line z-30">
        {sidebarContents}
      </aside>

      {/* ── MOBILE backdrop ───────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── MOBILE sidebar overlay ────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className={`
          fixed inset-y-0 left-0 w-[220px] flex flex-col
          bg-surface-1 border-r border-line z-50
          transform transition-transform duration-200 ease-in-out
          md:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContents}
      </aside>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-[220px]">

        {/* Mobile top bar — visible only below md */}
        <header className="md:hidden sticky top-0 z-30 h-14 bg-surface-1 border-b border-line flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-tx-muted hover:text-tx-primary p-1 -ml-1 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
              <Zap size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-tx-primary tracking-tight">
              TeamFlow
            </span>
          </div>

          {/* Theme toggle in mobile top bar too */}
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 w-full flex flex-col">
          {!auth?.org && !pathname.startsWith('/invites') && !pathname.startsWith('/settings') ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <h2 className="text-2xl font-bold text-tx-primary">Welcome to TeamFlow!</h2>
              <p className="mt-2 text-tx-secondary max-w-sm">
                You don't belong to any workspace yet. Create a new workspace from the sidebar menu to get started.
              </p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
