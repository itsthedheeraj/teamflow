import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

export default function ProjectsPage() {
  const { auth } = useAuth();
  const { showToast, confirm } = useUI();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  const canManage = auth?.role === 'admin' || auth?.role === 'owner';

  async function loadData() {
    try {
      const [projectsRes, teamRes] = await Promise.all([
        api.get('/projects'),
        canManage ? api.get('/team/members') : Promise.resolve({ members: [] }),
      ]);
      setProjects(projectsRes.projects || []);
      setTeamMembers(teamRes.members || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/projects', { name, description, team_lead_id: teamLeadId });
      setName(''); setDescription(''); setTeamLeadId(''); setShowForm(false);
      loadData();
      showToast('Project created', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = await confirm('Delete this project and all its tasks?');
    if (!confirmed) return;
    try {
      await api.delete(`/projects/${id}`);
      loadData();
      showToast('Project deleted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Categorize projects for display
  const filteredProjects = projects.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (p.name && p.name.toLowerCase().includes(q)) ||
           (p.description && p.description.toLowerCase().includes(q));
  });

  const allProjects = filteredProjects;
  const myLedProjects = filteredProjects.filter(p => p.team_lead_id === auth?.user?.id);
  const myAssignedProjects = filteredProjects.filter(p => p.has_assigned_tasks && p.team_lead_id !== auth?.user?.id);
  const otherProjects = filteredProjects.filter(p => p.team_lead_id !== auth?.user?.id && !p.has_assigned_tasks);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {canManage && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="self-start sm:self-auto bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 whitespace-nowrap shrink-0"
              >
                + New project
              </button>
            )}
          </div>
        </div>

        {/* Create project form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-semibold text-gray-800">New project</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
            />
            {canManage && (
              <select
                value={teamLeadId}
                onChange={(e) => setTeamLeadId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              >
                <option value="" disabled>Select a Team Lead</option>
                {teamMembers.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.name ? `${m.name} (${m.email})` : m.email} ({m.role})</option>
                ))}
              </select>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create project'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Project list */}
        {projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No projects yet.</p>
            {canManage && (
              <p className="mt-1 text-sm">Create your first project above.</p>
            )}
          </div>
        ) : canManage ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">All Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {allProjects.map((p) => <ProjectCard key={p.id} project={p} canManage={canManage} handleDelete={handleDelete} />)}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {myLedProjects.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Projects I Lead</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {myLedProjects.map((p) => <ProjectCard key={p.id} project={p} canManage={canManage} handleDelete={handleDelete} />)}
                </div>
              </div>
            )}
            {myAssignedProjects.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800">Projects I'm Collaborating On</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {myAssignedProjects.map((p) => <ProjectCard key={p.id} project={p} canManage={canManage} handleDelete={handleDelete} />)}
                </div>
              </div>
            )}
            {otherProjects.length > 0 && (
              <div className="space-y-4 opacity-60">
                <h2 className="text-lg font-semibold text-gray-800">Other Workspace Projects</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {otherProjects.map((p) => <ProjectCard key={p.id} project={p} locked={true} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function ProjectCard({ project, canManage, handleDelete, locked }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 transition-shadow ${locked ? 'cursor-not-allowed bg-gray-50' : 'hover:shadow-sm'}`}>
      <div className="flex items-start justify-between gap-2">
        {locked ? (
          <span className="font-semibold text-gray-500 leading-snug flex items-center gap-2" title="You don't have permission to access this project">
            🔒 {project.name}
          </span>
        ) : (
          <Link
            to={`/projects/${project.id}`}
            className="font-semibold text-gray-900 hover:text-brand-600 leading-snug"
          >
            {project.name}
          </Link>
        )}
        {canManage && !locked && handleDelete && (
          <button
            onClick={() => handleDelete(project.id)}
            className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
          >
            Delete
          </button>
        )}
      </div>
      {project.description && (
        <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">
          {project.description}
        </p>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Created {new Date(project.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
