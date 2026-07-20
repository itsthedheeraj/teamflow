import { useState, useEffect } from 'react';
import { Send, Trash2, Copy, CheckCircle } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// ─── Role pill styles — use status tokens so they adapt to dark mode ─
const ROLE_PILL = {
  owner:  'bg-status-pro-bg text-status-pro-text',
  admin:  'bg-accent-bg text-accent-text',
  member: 'bg-surface-2 text-tx-muted',
};

// ─── Avatar colors — deterministic per email initial ─────────────────
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-rose-500',    'bg-amber-500',
  'bg-teal-500',   'bg-sky-500',     'bg-indigo-500',
  'bg-pink-500',   'bg-emerald-500', 'bg-orange-500',
];

function avatarColor(email = '') {
  const idx = (email.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function TeamPage() {
  const { auth }            = useAuth();
  const { showToast, confirm } = useUI();

  const [members, setMembers]                   = useState([]);
  const [invites, setInvites]                   = useState([]);
  const [inviteEmail, setInviteEmail]           = useState('');
  const [loading, setLoading]                   = useState(false);
  const [failedInviteLink, setFailedInviteLink] = useState(null);
  const [copied, setCopied]                     = useState(false);

  const isAdmin = auth?.role === 'admin' || auth?.role === 'owner';
  const isOwner = auth?.role === 'owner';

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

  async function handleInvite(e) {
    e.preventDefault();
    setLoading(true);
    setFailedInviteLink(null);
    try {
      const data = await api.post('/team/invite', { email: inviteEmail, role: 'member' });
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email:     data.email,
            inviter_name: data.inviterName,
            org_name:     data.orgName,
            invite_link:  data.inviteUrl,
          },
          EMAILJS_PUBLIC_KEY
        );
        showToast(`Invite sent to ${inviteEmail}.`, 'success');
      } catch (emailErr) {
        console.error('[EmailJS] Invite email failed:', emailErr);
        setFailedInviteLink(data.inviteUrl);
        showToast(
          'Invite created, but email delivery failed — copy the link below to share manually.',
          'error'
        );
      }
      setInviteEmail('');
      loadTeam();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!failedInviteLink) return;
    try {
      await navigator.clipboard.writeText(failedInviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy — please copy the link manually.', 'error');
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-tx-primary">Team</h1>

        {/* ── Card 1: Invite a teammate ─────────────────────────── */}
        {isAdmin && (
          <div className="bg-surface-1 border border-line rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-tx-primary">
              Invite a teammate
            </h2>

            <form
              onSubmit={handleInvite}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="flex-1 border border-line-strong rounded-lg px-3 py-2 text-sm
                  bg-surface-2 text-tx-primary placeholder:text-tx-muted
                  focus:outline-none focus:ring-2 focus:ring-accent min-w-0"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-1.5 bg-accent text-white
                  px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90
                  disabled:opacity-50 transition-opacity flex-shrink-0"
              >
                <Send size={14} strokeWidth={2} />
                {loading ? 'Sending…' : 'Send invite'}
              </button>
            </form>

            {/* EmailJS fallback — only shown on delivery failure */}
            {failedInviteLink && (
              <div className="mt-2 rounded-lg border border-status-warning-text/30
                bg-status-warning-bg px-3 py-2.5">
                <p className="text-xs font-medium text-status-warning-text mb-1.5">
                  Email delivery failed — share this link manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs text-status-warning-text
                    bg-status-warning-text/10 rounded px-2 py-1 truncate">
                    {failedInviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title="Copy invite link"
                    className="flex-shrink-0 text-status-warning-text/70
                      hover:text-status-warning-text transition-colors"
                  >
                    {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Card 2: Members list ──────────────────────────────── */}
        <div className="bg-surface-1 border border-line rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="text-sm font-semibold text-tx-primary">
              Members
              <span className="ml-2 text-xs font-medium text-tx-muted">
                {members.length}
              </span>
            </h2>
          </div>

          <ul className="divide-y divide-line">
            {members.map((m) => {
              const initial    = m.name?.[0]?.toUpperCase() || m.email[0]?.toUpperCase() || '?';
              const bgColor    = avatarColor(m.email);
              const isSelf     = m.user_id === auth?.user?.id;
              const isOwnerRow = m.role === 'owner';

              return (
                <li key={m.user_id} className="flex items-center gap-3 px-5 py-3.5">
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full ${bgColor} text-white text-xs font-bold
                    flex items-center justify-center flex-shrink-0`}>
                    {initial}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tx-primary truncate">
                      {m.name || m.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-tx-muted font-normal">(you)</span>
                      )}
                    </p>
                    {m.name && (
                      <p className="text-xs text-tx-secondary truncate mt-0.5">{m.email}</p>
                    )}
                    <p className="text-xs text-tx-muted mt-0.5">
                      Joined {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Role pill + remove */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize
                      ${ROLE_PILL[m.role]}`}>
                      {m.role}
                    </span>
                    {isAdmin && !isSelf && !isOwnerRow && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        title="Remove member"
                        className="text-tx-muted hover:text-status-danger-text transition-colors"
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

        {/* ── Pending invites ───────────────────────────────────── */}
        {isAdmin && pendingInvites.length > 0 && (
          <div className="bg-surface-1 border border-line rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-sm font-semibold text-tx-primary">
                Pending invites
                <span className="ml-2 text-xs font-medium text-tx-muted">
                  {pendingInvites.length}
                </span>
              </h2>
            </div>
            <ul className="divide-y divide-line">
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-surface-2 text-tx-muted text-xs
                    font-bold flex items-center justify-center flex-shrink-0">
                    {inv.email[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-tx-primary truncate">
                      {inv.email}
                    </p>
                    <p className="text-xs text-tx-muted mt-0.5">
                      <span className="capitalize">{inv.role}</span>
                      {' · '}Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    title="Revoke invite"
                    className="text-tx-muted hover:text-status-danger-text
                      transition-colors flex-shrink-0"
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
