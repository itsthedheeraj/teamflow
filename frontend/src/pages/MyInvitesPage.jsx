import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailOpen, Check, X, Bell, ExternalLink, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

export default function MyInvitesPage() {
  const { updateOrg }           = useAuth();
  const { showToast, confirm }  = useUI();
  const navigate                = useNavigate();

  const [invites, setInvites]             = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(false);

  async function loadData() {
    try {
      const [invitesRes, notificationsRes] = await Promise.all([
        api.get('/auth/me/invites'),
        api.get('/notifications'),
      ]);
      setInvites(invitesRes.invites || []);
      setNotifications(notificationsRes.notifications || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAccept(token) {
    setLoading(true);
    try {
      const res = await api.post('/auth/accept-invite', { token });
      showToast(`Successfully joined ${res.org.name}! Switching workspace...`, 'success');
      setTimeout(() => {
        updateOrg(res.token, res.org, res.role);
        navigate('/projects');
      }, 1500);
    } catch (err) {
      showToast(err.message, 'error');
      setLoading(false);
    }
  }

  async function handleDecline(token) {
    const confirmed = await confirm('Are you sure you want to decline this invite?');
    if (!confirmed) return;
    setLoading(true);
    try {
      await api.delete(`/auth/me/invites/${token}`);
      showToast('Invite declined successfully.', 'success');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReadNotification(id, link) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ));
      if (link) navigate(link);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDeleteNotification(id) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter((n) => n.id !== id));
      showToast('Notification deleted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-tx-primary flex items-center gap-2">
          <MailOpen size={24} className="text-accent" />
          My Invites &amp; Notifications
        </h1>

        {/* ── Pending Invites ────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-tx-primary">
            Pending Workspace Invites
          </h2>

          <div className="bg-surface-1 border border-line rounded-xl overflow-hidden">
            {invites.length === 0 ? (
              <div className="px-5 py-10 text-center text-tx-muted">
                <p>You have no pending workspace invites.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center
                      justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-tx-primary truncate">
                        {inv.org_name}
                      </p>
                      <p className="text-sm text-tx-muted mt-0.5">
                        Invited by{' '}
                        <span className="font-medium text-tx-secondary">
                          {inv.inviter_email}
                        </span>{' '}
                        as a{' '}
                        <span className="capitalize font-medium text-tx-secondary">
                          {inv.role}
                        </span>
                      </p>
                      <p className="text-xs text-tx-muted mt-1">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAccept(inv.token)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-accent text-white
                          px-4 py-2 rounded-lg text-sm font-medium
                          hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <Check size={16} strokeWidth={2} />
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(inv.token)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-surface-1 border border-line
                          text-tx-secondary px-4 py-2 rounded-lg text-sm font-medium
                          hover:bg-surface-2 transition-colors disabled:opacity-50"
                      >
                        <X size={16} strokeWidth={2} />
                        Decline
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Notifications ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-tx-primary flex items-center gap-2">
            <Bell size={18} className="text-tx-muted" />
            Notifications
          </h2>

          <div className="bg-surface-1 border border-line rounded-xl overflow-hidden">
            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center text-tx-muted">
                <p>You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`flex flex-col sm:flex-row sm:items-center
                      justify-between gap-4 px-5 py-4 transition-colors ${
                        notif.is_read
                          ? 'bg-surface-0 opacity-70'
                          : 'hover:bg-surface-2'
                      }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${
                        notif.is_read
                          ? 'text-tx-muted'
                          : 'text-tx-primary font-medium'
                      }`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-tx-muted mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {notif.link && (
                        <button
                          onClick={() => handleReadNotification(notif.id, notif.link)}
                          className="flex items-center gap-1.5 bg-accent-bg text-accent-text
                            px-3 py-1.5 rounded-lg text-xs font-medium
                            hover:opacity-80 transition-opacity"
                        >
                          <ExternalLink size={14} />
                          View
                        </button>
                      )}
                      {!notif.is_read && (
                        <button
                          onClick={() => handleReadNotification(notif.id)}
                          className="flex items-center gap-1.5 bg-surface-1 border border-line
                            text-tx-secondary px-3 py-1.5 rounded-lg text-xs font-medium
                            hover:bg-surface-2 transition-colors"
                        >
                          <Check size={14} />
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notif.id)}
                        title="Delete Notification"
                        className="flex items-center gap-1.5 bg-surface-1 border border-line
                          text-status-danger-text px-3 py-1.5 rounded-lg text-xs font-medium
                          hover:bg-status-danger-bg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
