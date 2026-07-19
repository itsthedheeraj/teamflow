import { useState, useEffect } from 'react';
import { Settings, Lock, Folder, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

export default function SettingsPage() {
  const { auth } = useAuth();
  const { showToast } = useUI();
  
  const [activeTab, setActiveTab] = useState('security');
  
  // Security Tab State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Projects Tab State
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [isTransferringOrg, setIsTransferringOrg] = useState(false);
  const [selectedNewOrgOwner, setSelectedNewOrgOwner] = useState('');

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
        api.get('/team/members')
      ]);
      // Only show projects where user is team lead or admin/owner
      const managedProjects = (projectsRes.projects || []).filter(
        p => p.team_lead_id === auth.user.id || auth.role === 'admin' || auth.role === 'owner'
      );
      setProjects(managedProjects);
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
      await api.patch('/auth/change-password', {
        currentPassword,
        newPassword
      });
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
      await api.patch(`/projects/${projectId}`, {
        team_lead_id: newLeadId
      });
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
      await api.post('/team/transfer/request', {
        email: selectedNewOrgOwner
      });
      showToast('Workspace transfer request sent successfully! They will receive a notification to accept it.', 'success');
      setSelectedNewOrgOwner('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsTransferringOrg(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={24} className="text-brand-600" />
          Settings
        </h1>

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar / Tabs */}
          <div className="w-full md:w-64 flex-shrink-0 space-y-1">
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                activeTab === 'security'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Lock size={18} />
              Security
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                activeTab === 'projects'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Folder size={18} />
              Projects
            </button>
            {auth?.role === 'owner' && (
              <button
                onClick={() => setActiveTab('workspace')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  activeTab === 'workspace'
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Building2 size={18} />
                Workspace
              </button>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                  <p className="text-sm text-gray-500 mt-1">Ensure your account is using a long, random password to stay secure.</p>
                </div>
                
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Project Transfer</h2>
                  <p className="text-sm text-gray-500 mt-1">Transfer ownership of projects you manage to other team members.</p>
                </div>

                {loadingProjects ? (
                  <p className="text-sm text-gray-500">Loading projects...</p>
                ) : projects.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-500">
                    You do not manage any projects currently.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {projects.map((project) => (
                      <li key={project.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{project.name}</p>
                          <p className="text-xs text-gray-500 mt-1">Created {new Date(project.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <select
                            onChange={(e) => handleTransferProject(project.id, e.target.value)}
                            value={project.team_lead_id || ''}
                            className="flex-1 sm:w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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

            {activeTab === 'workspace' && auth?.role === 'owner' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Transfer Workspace Ownership</h2>
                  <p className="text-sm text-gray-500 mt-1">Select a member of your workspace to transfer full ownership to. They will receive a notification to accept the transfer. Once accepted, you will be demoted to an admin.</p>
                </div>

                <form onSubmit={handleTransferOrg} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New Owner Email</label>
                    <input
                      type="email"
                      required
                      placeholder="Enter their email address..."
                      value={selectedNewOrgOwner}
                      onChange={(e) => setSelectedNewOrgOwner(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTransferringOrg || !selectedNewOrgOwner}
                    className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
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
