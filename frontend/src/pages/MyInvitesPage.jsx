import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailOpen, Check, X, Bell, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function MyInvitesPage() {
  const { updateOrg } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      const [invitesRes, notificationsRes] = await Promise.all([
        api.get('/auth/me/invites'),
        api.get('/notifications')
      ]);
      setInvites(invitesRes.invites || []);
      setNotifications(notificationsRes.notifications || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAccept(token) {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/accept-invite', { token });
      setSuccess(`Successfully joined ${res.org.name}! Switching workspace...`);
      setTimeout(() => {
        updateOrg(res.token, res.org, res.role);
        navigate('/projects');
      }, 1500);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleDecline(token) {
    if (!window.confirm('Are you sure you want to decline this invite?')) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.delete(`/auth/me/invites/${token}`);
      setSuccess('Invite declined successfully.');
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReadNotification(id, link) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.filter(n => n.id !== id));
      if (link) {
        navigate(link);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MailOpen size={24} className="text-brand-600" />
          My Invites & Notifications
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
            {success}
          </div>
        )}

        {/* Pending Invites Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Pending Workspace Invites</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {invites.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-500">
                <p>You have no pending workspace invites.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 truncate">
                        {inv.org_name}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Invited by <span className="font-medium text-gray-700">{inv.inviter_email}</span> as a <span className="capitalize font-medium">{inv.role}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAccept(inv.token)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                      >
                        <Check size={16} strokeWidth={2} />
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(inv.token)}
                        disabled={loading}
                        className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
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

        {/* Notifications Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Bell size={18} className="text-gray-500" />
            Unread Notifications
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-500">
                <p>You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <li key={notif.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {notif.link && (
                        <button
                          onClick={() => handleReadNotification(notif.id, notif.link)}
                          className="flex items-center gap-1.5 bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-100 transition-colors"
                        >
                          <ExternalLink size={14} />
                          View
                        </button>
                      )}
                      <button
                        onClick={() => handleReadNotification(notif.id)}
                        className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Check size={14} />
                        Mark Read
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
