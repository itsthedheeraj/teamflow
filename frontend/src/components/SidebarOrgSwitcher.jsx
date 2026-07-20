import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

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
  const { showToast }       = useUI();
  const [orgs, setOrgs]         = useState([]);
  const [open, setOpen]         = useState(false);
  const [switching, setSwitching]   = useState(false);
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

  const name    = auth?.org?.name ?? '';
  const initial = name[0]?.toUpperCase() ?? '?';
  const color   = orgColor(name);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg
          border border-line bg-surface-1 hover:bg-surface-2
          transition-colors text-left"
      >
        <span className={`w-6 h-6 rounded-md ${color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
          {initial}
        </span>
        <span className="flex-1 text-xs font-medium text-tx-primary truncate min-w-0">
          {name || 'No Workspace'}
        </span>
        <ChevronDown
          size={13}
          className={`text-tx-muted flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full
          bg-surface-2 border border-line rounded-xl z-50 py-1 overflow-hidden
          shadow-lg">
          <p className="px-3 py-1.5 text-xs text-tx-muted font-medium uppercase tracking-wide">
            Workspaces
          </p>

          {orgs.map((org) => {
            const active = org.id === auth.org?.id;
            return (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs
                  hover:bg-surface-1 transition-colors"
              >
                <span className={`w-5 h-5 rounded-md ${orgColor(org.name)} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                  {org.name[0]?.toUpperCase()}
                </span>
                <span className={`flex-1 truncate ${
                  active ? 'font-semibold text-accent-text' : 'text-tx-secondary'
                }`}>
                  {org.name}
                </span>
                {active && <Check size={12} className="text-accent flex-shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })}

          <div className="border-t border-line mt-1">
            {isCreating ? (
              <form onSubmit={handleCreate} className="px-3 py-2 flex flex-col gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace name..."
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  disabled={switching}
                  className="w-full text-xs border border-line-strong rounded px-2 py-1.5
                    bg-surface-1 text-tx-primary placeholder:text-tx-muted
                    focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={switching || !newOrgName.trim()}
                    className="flex-1 bg-accent text-white text-xs font-medium py-1.5 rounded
                      hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {switching ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreating(false); setNewOrgName(''); }}
                    disabled={switching}
                    className="flex-1 bg-surface-1 text-tx-secondary text-xs font-medium py-1.5
                      rounded hover:bg-surface-0 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs
                  text-accent hover:bg-accent-bg transition-colors"
              >
                <div className="w-5 h-5 rounded-md bg-accent-bg flex items-center justify-center flex-shrink-0">
                  <Plus size={12} strokeWidth={2.5} className="text-accent" />
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
