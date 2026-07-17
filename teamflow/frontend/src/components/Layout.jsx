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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
 *   a hamburger icon (☰) toggles it open as a full-height overlay on top
 *   of the content. A semi-transparent backdrop closes it when tapped.
 *   Main content takes the full screen width (no ml-[220px]).
 *
 * Sidebar is never "shrunk" on mobile — it's either fully visible
 * (overlay) or fully hidden. This prevents the squeezed-content problem.
 */

const NAV_LINKS = [
  { to: '/projects', label: 'Projects', Icon: FolderOpen },
  { to: '/team',     label: 'Team',     Icon: Users,      minRole: 'admin' },
  { to: '/billing',  label: 'Billing',  Icon: CreditCard, minRole: 'owner' },
];

const ROLE_RANK = { member: 0, admin: 1, owner: 2 };

function meetsRole(userRole, minRole) {
  if (!minRole) return true;
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[minRole] ?? 99);
}

export default function Layout({ children }) {
  const { auth, logout } = useAuth();
  const navigate   = useNavigate();
  const { pathname } = useLocation();
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

  const userInitial = auth?.user?.email?.[0]?.toUpperCase() ?? '?';

  // ── Sidebar contents (shared between desktop and mobile overlay) ──
  const sidebarContents = (
    <>
      {/* Logo */}
      <div className="px-4 h-14 flex items-center gap-2.5 border-b border-gray-100 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-bold text-gray-900 tracking-tight">
          TeamFlow
        </span>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="ml-auto md:hidden text-gray-400 hover:text-gray-700 p-1"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* Org switcher */}
      <div className="px-3 py-3 border-b border-gray-100 flex-shrink-0">
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
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon
                  size={16}
                  className={active ? 'text-brand-600' : 'text-gray-400'}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {label}
              </Link>
            );
          }
        )}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 border-t border-gray-100">
        <SidebarUsageWidget />

        {/* User row */}
        <div className="px-3 py-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {userInitial}
          </div>
          <span className="flex-1 text-xs text-gray-600 truncate min-w-0">
            {auth?.user?.email}
          </span>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <LogOut size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── DESKTOP sidebar (hidden below md) ─────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-[220px] flex-col bg-white border-r border-gray-200 z-30">
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
          bg-white border-r border-gray-200 z-50
          transform transition-transform duration-200 ease-in-out
          md:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContents}
      </aside>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen
                      md:ml-[220px]">

        {/* Mobile top bar — visible only below md */}
        <header className="md:hidden sticky top-0 z-30 h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-800 p-1 -ml-1"
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
              <Zap size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">
              TeamFlow
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 w-full">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
