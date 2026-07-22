import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';
import { Trash2, Github, Sparkles } from 'lucide-react';

const getRepoPath = (urlOrPath) => {
  if (!urlOrPath) return '';
  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\/|\/$/g, '');
  } catch (e) {
    return urlOrPath.replace(/^\/|\/$/g, '');
  }
};

export default function ProjectsPage() {
  const { auth } = useAuth();
  const { showToast, confirm } = useUI();
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teamLeadId, setTeamLeadId] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  const canManage = auth?.role === 'admin' || auth?.role === 'owner';

  async function loadData() {
    if (!auth?.org?.id) return;
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
      await api.post('/projects', { name, description, team_lead_id: teamLeadId, github_repo: githubRepo });
      setName(''); setDescription(''); setTeamLeadId(''); setGithubRepo(''); setShowForm(false);
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

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const allProjects = filteredProjects;
  const myLedProjects = filteredProjects.filter((p) => p.team_lead_id === auth?.user?.id);
  const myAssignedProjects = filteredProjects.filter((p) => p.has_assigned_tasks && p.team_lead_id !== auth?.user?.id);
  const otherProjects = filteredProjects.filter((p) => p.team_lead_id !== auth?.user?.id && !p.has_assigned_tasks);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-tx-primary">Projects</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-1 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {canManage && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="self-start sm:self-auto bg-accent text-white px-4 py-2
                  rounded-lg text-sm font-medium hover:opacity-90 transition-opacity
                  whitespace-nowrap shrink-0"
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
            className="bg-surface-1 border border-line rounded-xl p-6 space-y-4"
          >
            <h2 className="font-semibold text-tx-primary">New project</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              required
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none resize-none"
            />
            <input
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="GitHub Repository (e.g. facebook/react) (optional)"
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {canManage && (
              <select
                value={teamLeadId}
                onChange={(e) => setTeamLeadId(e.target.value)}
                required
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                  bg-surface-2 text-tx-primary
                  focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="" disabled>Select a Team Lead</option>
                {teamMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name ? `${m.name} (${m.email})` : m.email} ({m.role})
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium
                  hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Creating…' : 'Create project'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-tx-secondary
                  hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Project list */}
        {projects.length === 0 ? (
          <div className="text-center py-16 text-tx-muted">
            <p className="text-lg">No projects yet.</p>
            {canManage && (
              <p className="mt-1 text-sm">Create your first project above.</p>
            )}
          </div>
        ) : canManage ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-tx-primary">All Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {allProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  canManage={canManage}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {myLedProjects.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-tx-primary">Projects I Lead</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {myLedProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} canManage={canManage} handleDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
            {myAssignedProjects.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-tx-primary">Projects I'm Collaborating On</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {myAssignedProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} canManage={canManage} handleDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
            {otherProjects.length > 0 && (
              <div className="space-y-4 opacity-60">
                <h2 className="text-lg font-semibold text-tx-primary">Other Workspace Projects</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {otherProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} locked />
                  ))}
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
  const [repoData, setRepoData] = useState(null);
  const [commitData, setCommitData] = useState(null);

  useEffect(() => {
    async function fetchGithub() {
      const repoPath = getRepoPath(project?.github_repo);
      if (!repoPath) return;
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${repoPath}`);
        if (repoRes.ok) {
          setRepoData(await repoRes.json());
        }

        const commitRes = await fetch(`https://api.github.com/repos/${repoPath}/commits?per_page=1`);
        if (commitRes.ok) {
          const commits = await commitRes.json();
          setCommitData(commits[0]);
        }
      } catch (err) {
        console.error('Failed to fetch github data', err);
      }
    }
    if (!locked) {
      fetchGithub();
    }
  }, [project?.github_repo, locked]);

  return (
    <div className={`bg-surface-3 border border-line rounded-xl p-5 transition-shadow flex flex-col justify-between
      ${locked ? 'cursor-not-allowed opacity-60' : 'hover:shadow-sm'}`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          {locked ? (
            <span
              className="font-semibold text-tx-muted leading-snug flex items-center gap-2"
              title="You don't have permission to access this project"
            >
              🔒 {project.name}
            </span>
          ) : (
            <Link
              to={`/projects/${project.id}`}
              className="font-semibold text-tx-primary hover:text-accent leading-snug transition-colors truncate"
            >
              {project.name}
            </Link>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {project.github_repo && !locked && (
              <a
                href={`https://github.com/${getRepoPath(project.github_repo)}`}
                target="_blank"
                rel="noreferrer"
                className="text-tx-muted hover:text-tx-primary transition-colors p-1"
                title="View on GitHub"
              >
                <Github size={16} />
              </a>
            )}
            {canManage && !locked && handleDelete && (
              <button
                onClick={() => handleDelete(project.id)}
                className="text-status-danger-text/60 hover:text-status-danger-text transition-colors p-1"
                title="Delete Project"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {project.description && (
          <p className="mt-2 text-sm text-tx-secondary line-clamp-2">
            {project.description}
          </p>
        )}

        {project.github_repo && (
          <div className="mt-4 p-3 bg-surface-1 border border-line rounded-lg flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-tx-primary font-medium text-sm">
              <Github size={14} />
              <a href={`https://github.com/${getRepoPath(project.github_repo)}`} target="_blank" rel="noreferrer" className="hover:underline truncate">
                {repoData?.full_name || getRepoPath(project.github_repo)}
              </a>
              {!repoData && <span className="text-[10px] bg-surface-2 text-tx-muted px-1.5 py-0.5 rounded shrink-0">Private</span>}
            </div>
            {repoData?.description && (
              <p className="text-xs text-tx-muted line-clamp-1 italic">
                {repoData.description}
              </p>
            )}
            {commitData && (
              <div className="text-xs text-tx-secondary truncate flex items-center gap-1.5 mt-1 border-t border-line-strong pt-2">
                <span className="font-semibold text-[10px] uppercase tracking-wider text-tx-muted shrink-0 bg-surface-2 px-1.5 py-0.5 rounded">Latest Commit</span>
                <a href={commitData.html_url} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate">
                  {commitData.commit.message}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-line-strong">
        <p className="text-xs text-tx-muted">
          Created {new Date(project.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
