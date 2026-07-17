import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function ProjectsPage() {
  const { auth } = useAuth();
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canManage = auth?.role === 'admin' || auth?.role === 'owner';

  async function loadProjects() {
    try {
      const data = await api.get('/projects');
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadProjects(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/projects', { name, description });
      setName(''); setDescription(''); setShowForm(false);
      loadProjects();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    try {
      await api.delete(`/projects/${id}`);
      loadProjects();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          {canManage && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="self-start sm:self-auto bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 whitespace-nowrap"
            >
              + New project
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/projects/${p.id}`}
                    className="font-semibold text-gray-900 hover:text-brand-600 leading-snug"
                  >
                    {p.name}
                  </Link>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
                    >
                      Delete
                    </button>
                  )}
                </div>
                {p.description && (
                  <p className="mt-1.5 text-sm text-gray-500 line-clamp-2">
                    {p.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-400">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
