import { useState, useEffect } from 'react';
import { Settings, Lock, Folder, Building2 } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

const EMAILJS_SERVICE_ID           = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TRANSFER_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TRANSFER_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY           = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function SettingsPage() {
  const { auth }        = useAuth();
  const { showToast }   = useUI();

  const [activeTab, setActiveTab] = useState('security');

  // Security tab
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Projects tab
  const [projects, setProjects]           = useState([]);
  const [teamMembers, setTeamMembers]     = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Workspace transfer tab
  const [isTransferringOrg, setIsTransferringOrg]       = useState(false);
  const [selectedNewOrgOwner, setSelectedNewOrgOwner]   = useState('');

  useEffect(() => {
    if (activeTab === 'projects' || activeTab === 'workspace') {
      loadProjectsData();
    }
  }, [activeTab]);

  async function loadProjectsData() {
    if (!auth?.org?.id) return;
    setLoadingProjects(true);
    try {
      const [projectsRes, teamRes] = await Promise.all([
        api.get('/projects'),
        api.get('/team/members'),
      ]);
      setProjects(projectsRes.projects || []);
      setTeamMembers(teamRes.members || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setIsChangingPassword(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      showToast('Password successfully changed!', 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleTransferProject(projectId, newLeadId) {
    if (!newLeadId) return;
    try {
      await api.patch(`/projects/${projectId}`, { team_lead_id: newLeadId });
      showToast('Project transferred successfully.', 'success');
      loadProjectsData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleTransferOrg(e) {
    e.preventDefault();
    if (!selectedNewOrgOwner) return;
    setIsTransferringOrg(true);
    try {
      const data = await api.post('/team/transfer/request', { email: selectedNewOrgOwner });
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TRANSFER_TEMPLATE_ID,
          {
            to_email:           data.toEmail,
            current_owner_name: data.ownerName,
            org_name:           data.orgName,
            transfer_link:      data.transferUrl,
          },
          EMAILJS_PUBLIC_KEY
        );
        showToast(
          'Transfer request sent! They will receive an email with a link to accept it.',
          'success'
        );
      } catch (emailErr) {
        console.error('[EmailJS] Transfer email failed:', emailErr);
        showToast(
          'Transfer request created, but email delivery failed. The recipient will still see a notification inside TeamFlow if they have an account.',
          'error'
        );
      }
      setSelectedNewOrgOwner('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsTransferringOrg(false);
    }
  }

  // ─── Shared tab button class helper ──────────────────────────────
  function tabClass(tab) {
    return `w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
      rounded-xl transition-colors ${
        activeTab === tab
          ? 'bg-accent-bg text-accent-text'
          : 'text-tx-secondary hover:bg-surface-2'
      }`;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-tx-primary flex items-center gap-2">
          <Settings size={24} className="text-accent" />
          Settings
        </h1>

        <div className="flex flex-col md:flex-row gap-8">

          {/* ── Tab sidebar ────────────────────────────────────── */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-1">
            <button onClick={() => setActiveTab('security')} className={tabClass('security')}>
              <Lock size={18} />
              Security
            </button>
            <button onClick={() => setActiveTab('projects')} className={tabClass('projects')}>
              <Folder size={18} />
              Projects
            </button>
            {auth?.role === 'owner' && (
              <button onClick={() => setActiveTab('workspace')} className={tabClass('workspace')}>
                <Building2 size={18} />
                Workspace
              </button>
            )}
          </div>

          {/* ── Content panel ──────────────────────────────────── */}
          <div className="flex-1 bg-surface-1 border border-line rounded-2xl
            p-6 sm:p-8 shadow-sm">

            {/* Security tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-tx-primary">Change Password</h2>
                  <p className="text-sm text-tx-secondary mt-1">
                    Ensure your account is using a long, random password to stay secure.
                  </p>
                </div>

                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-tx-secondary mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-line-strong rounded-lg px-4 py-2.5
                        bg-surface-2 text-tx-primary
                        focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tx-secondary mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-line-strong rounded-lg px-4 py-2.5
                        bg-surface-2 text-tx-primary
                        focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="bg-accent text-white px-5 py-2.5 rounded-lg text-sm font-medium
                      hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

            {/* Projects tab */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-tx-primary">Project Transfer</h2>
                  <p className="text-sm text-tx-secondary mt-1">
                    Transfer ownership of projects you manage to other team members.
                  </p>
                </div>

                {loadingProjects ? (
                  <p className="text-sm text-tx-muted">Loading projects...</p>
                ) : projects.length === 0 ? (
                  <div className="bg-surface-2 rounded-xl p-6 text-center text-sm text-tx-muted">
                    You do not manage any projects currently.
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {projects.map((project) => (
                      <li
                        key={project.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center
                          justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-semibold text-tx-primary">
                            {project.name}
                          </p>
                          <p className="text-xs text-tx-muted mt-1">
                            Created {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <select
                            onChange={(e) => handleTransferProject(project.id, e.target.value)}
                            value={project.team_lead_id || ''}
                            className="flex-1 sm:w-48 border border-line-strong rounded-lg
                              px-3 py-2 text-sm bg-surface-2 text-tx-primary
                              focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="">Select new lead...</option>
                            {teamMembers.map((member) => (
                              <option key={member.id} value={member.user_id}>
                                {member.name || member.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Workspace transfer tab */}
            {activeTab === 'workspace' && auth?.role === 'owner' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-tx-primary">
                    Transfer Workspace Ownership
                  </h2>
                  <p className="text-sm text-tx-secondary mt-1">
                    Select a member to transfer full ownership to. They will receive an
                    email with a link to accept. Once accepted, you will be demoted to admin.
                  </p>
                </div>

                <form onSubmit={handleTransferOrg} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-tx-secondary mb-1.5">
                      New Owner Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Enter their email address..."
                      value={selectedNewOrgOwner}
                      onChange={(e) => setSelectedNewOrgOwner(e.target.value)}
                      className="w-full border border-line-strong rounded-lg px-3 py-2.5
                        text-sm bg-surface-2 text-tx-primary placeholder:text-tx-muted
                        focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTransferringOrg || !selectedNewOrgOwner}
                    className="bg-accent text-white px-5 py-2.5 rounded-lg text-sm font-medium
                      hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isTransferringOrg ? 'Sending Request...' : 'Send Transfer Request'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
