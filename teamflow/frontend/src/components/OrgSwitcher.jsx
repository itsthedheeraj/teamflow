import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * OrgSwitcher
 *
 * Dropdown that shows all orgs the user belongs to.
 * Selecting a different org calls /auth/switch-org, gets a new JWT,
 * and updates the auth context — the whole app re-scopes to the new org.
 */
export default function OrgSwitcher() {
  const { auth, updateOrg } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    api.get('/auth/me/orgs').then((data) => setOrgs(data.orgs || []));
  }, []);

  async function handleSwitch(orgId) {
    if (orgId === auth.org.id) { setOpen(false); return; }
    setSwitching(true);
    try {
      const data = await api.post('/auth/switch-org', { orgId });
      updateOrg(data.token, data.org, data.role);
      setOpen(false);
      // Reload so all data re-fetches under new org context
      window.location.reload();
    } catch (err) {
      console.error('Org switch failed:', err.message);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors"
        disabled={switching}
      >
        <span className="w-5 h-5 rounded bg-brand-600 text-white text-xs flex items-center justify-center font-bold">
          {auth.org?.name?.[0]?.toUpperCase() ?? '?'}
        </span>
        <span className="max-w-[140px] truncate">{auth.org?.name}</span>
        <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
          <p className="px-3 py-1.5 text-xs text-gray-400 font-medium uppercase tracking-wide">
            Your workspaces
          </p>
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                org.id === auth.org?.id ? 'font-semibold text-brand-600' : 'text-gray-700'
              }`}
            >
              <span className="w-5 h-5 rounded bg-gray-200 text-gray-600 text-xs flex items-center justify-center font-bold flex-shrink-0">
                {org.name[0].toUpperCase()}
              </span>
              <span className="truncate">{org.name}</span>
              {org.id === auth.org?.id && (
                <svg className="w-3.5 h-3.5 ml-auto text-brand-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
