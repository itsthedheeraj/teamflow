import { useState, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

// ─── Role pill styles ─────────────────────────────────────────────
const ROLE_PILL = {
  owner:  'bg-purple-100 text-purple-700',
  admin:  'bg-blue-100   text-blue-700',
  member: 'bg-gray-100   text-gray-600',
};

// ─── Avatar colors — deterministic per email initial ─────────────
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-rose-500',    'bg-amber-500',
  'bg-teal-500',   'bg-sky-500',     'bg-indigo-500',
  'bg-pink-500',   'bg-emerald-500', 'bg-orange-500',
];

function avatarColor(email = '') {
  const idx = (email.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Component ───────────────────────────────────────────────────
export default function TeamPage() {
  const { auth } = useAuth();
  const { showToast, confirm } = useUI();
  const [members, setMembers]       = useState([]);
  const [invites, setInvites]       = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = auth?.role === 'admin' || auth?.role === 'owner';
  const isOwner = auth?.role === 'owner';

  // ── Data loading ──────────────────────────────────────────────
  async function loadTeam() {
    if (!auth?.org?.id) return;
    try {
      const [membersData, invitesData] = await Promise.all([
        api.get('/team/members'),
        isAdmin
          ? api.get('/team/invites')
          : Promise.resolve({ invites: [] }),
      ]);
      setMembers(membersData.members || []);
      setInvites(invitesData.invites || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  useEffect(() => { loadTeam(); }, []);

  // ── Actions ───────────────────────────────────────────────────
  async function handleInvite(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/team/invite', { email: inviteEmail, role: 'member' });
      showToast(`Invite sent to ${inviteEmail}.`, 'success');
      setInviteEmail('');
      loadTeam();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await api.patch(`/team/members/${userId}/role`, { role: newRole });
      loadTeam();
      showToast('Role updated successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRemove(userId) {
    const confirmed = await confirm('Remove this member from the organization?');
    if (!confirmed) return;
    try {
      await api.delete(`/team/members/${userId}`);
      loadTeam();
      window.dispatchEvent(new Event('usage:refresh'));
      showToast('Member removed', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRevokeInvite(inviteId) {
    try {
      await api.delete(`/team/invites/${inviteId}`);
      loadTeam();
      showToast('Invite revoked', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const pendingInvites = invites.filter((i) => !i.accepted_at);

  // ── Render ────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Team</h1>

        {/* ── Card 1: Invite a teammate ────────────────────────── */}
        {isAdmin && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Invite a teammate
            </h2>

            {/* Stacks vertically on mobile, single row on sm+ */}
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-0"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <Send size={14} strokeWidth={2} />
                  {loading ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Card 2: Members list ─────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Members
              <span className="ml-2 text-xs font-medium text-gray-400">
                {members.length}
              </span>
            </h2>
          </div>

          <ul className="divide-y divide-gray-100">
            {members.map((m) => {
              const initial  = m.name?.[0]?.toUpperCase() || m.email[0]?.toUpperCase() || '?';
              const bgColor  = avatarColor(m.email);
              const isSelf   = m.user_id === auth?.user?.id;
              const isOwnerRow = m.role === 'owner';

              return (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full ${bgColor} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                  >
                    {initial}
                  </div>

                  {/* Email + joined date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.name || m.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          (you)
                        </span>
                      )}
                    </p>
                    {m.name && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {m.email}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Right side: role + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_PILL[m.role]}`}
                    >
                      {m.role}
                    </span>

                    {/* Trash icon — admin/owner can remove non-owners who aren't themselves */}
                    {isAdmin && !isSelf && !isOwnerRow && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        title="Remove member"
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Pending invites ──────────────────────────────────── */}
        {isAdmin && pendingInvites.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">
                Pending invites
                <span className="ml-2 text-xs font-medium text-gray-400">
                  {pendingInvites.length}
                </span>
              </h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {pendingInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  {/* Placeholder avatar */}
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {inv.email[0]?.toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      <span className="capitalize">{inv.role}</span>
                      {' · '}Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    title="Revoke invite"
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
