import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

/**
 * SidebarOrgSwitcher
 *
 * Trigger: bordered pill showing org initial + name + chevron.
 * Dropdown: same logic as OrgSwitcher.jsx — calls /auth/switch-org
 * and reloads the page to re-scope all data to the new org.
 *
 * Kept as a separate component from OrgSwitcher so the old top-nav
 * version can coexist if needed, and to keep this file self-contained.
 */

// Deterministic color per org initial for visual variety
const ORG_COLORS = [
  'bg-violet-500', 'bg-rose-500', 'bg-amber-500',
  'bg-teal-500',   'bg-sky-500',  'bg-indigo-500',
  'bg-pink-500',   'bg-emerald-500',
];

function orgColor(name = '') {
  const idx = (name.charCodeAt(0) || 0) % ORG_COLORS.length;
  return ORG_COLORS[idx];
}

export default function SidebarOrgSwitcher() {
  const { auth, updateOrg } = useAuth();
  const { showToast } = useUI();
  const [orgs, setOrgs] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    api.get('/auth/me/orgs').then((d) => setOrgs(d.orgs || []));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setIsCreating(false);
        setNewOrgName('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleSwitch(orgId) {
    if (orgId === auth?.org?.id) { setOpen(false); return; }
    setSwitching(true);
    try {
      const data = await api.post('/auth/switch-org', { orgId });
      updateOrg(data.token, data.org, data.role);
      setOpen(false);
      window.location.reload();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSwitching(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setSwitching(true);
    try {
      const data = await api.post('/auth/me/orgs', { orgName: newOrgName });
      updateOrg(data.token, data.org, data.role);
      setOpen(false);
      window.location.reload();
    } catch (err) {
      showToast(err.message, 'error');
      setSwitching(false);
    }
  }

  const name = auth?.org?.name ?? '';
  const initial = name[0]?.toUpperCase() ?? '?';
  const color = orgColor(name);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className={`w-6 h-6 rounded-md ${color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
          {initial}
        </span>
        <span className="flex-1 text-xs font-medium text-gray-800 truncate min-w-0">
          {name || 'No Workspace'}
        </span>
        <ChevronDown
          size={13}
          className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl z-50 py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">
            Workspaces
          </p>
          {orgs.map((org) => {
            const active = org.id === auth.org?.id;
            return (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
              >
                <span className={`w-5 h-5 rounded-md ${orgColor(org.name)} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                  {org.name[0]?.toUpperCase()}
                </span>
                <span className={`flex-1 truncate ${active ? 'font-semibold text-brand-700' : 'text-gray-700'}`}>
                  {org.name}
                </span>
                {active && <Check size={12} className="text-brand-600 flex-shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })}
          
          <div className="border-t border-gray-100 mt-1">
            {isCreating ? (
              <form onSubmit={handleCreate} className="px-3 py-2 flex flex-col gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace name..."
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  disabled={switching}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={switching || !newOrgName.trim()}
                    className="flex-1 bg-brand-600 text-white text-xs font-medium py-1.5 rounded hover:bg-brand-700 disabled:opacity-50"
                  >
                    {switching ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setNewOrgName('');
                    }}
                    disabled={switching}
                    className="flex-1 bg-gray-100 text-gray-600 text-xs font-medium py-1.5 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                <div className="w-5 h-5 rounded-md bg-brand-100 flex items-center justify-center flex-shrink-0">
                  <Plus size={12} strokeWidth={2.5} />
                </div>
                <span className="font-medium">Create workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
