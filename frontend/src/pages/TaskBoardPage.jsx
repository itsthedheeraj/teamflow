import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const STATUSES = ['todo', 'in_progress', 'done'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const STATUS_COLORS = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
};

export default function TaskBoardPage() {
  const { projectId } = useParams();
  const { auth } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canManage = auth?.role === 'admin' || auth?.role === 'owner' || project?.team_lead_id === auth?.user?.id;

  async function load() {
    try {
      const [projData, tasksData, membersData] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/tasks?projectId=${projectId}`),
        api.get('/team/members'),
      ]);
      setProject(projData.project);
      setTasks(tasksData.tasks || []);
      setMembers(membersData.members || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [projectId]);

  function resetForm() {
    setForm({ title: '', description: '', assignedTo: '' });
    setEditingTask(null);
    setShowForm(false);
  }

  function startEdit(task) {
    setForm({
      title: task.title,
      description: task.description || '',
      assignedTo: task.assigned_to || '',
    });
    setEditingTask(task);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        assignedTo: form.assignedTo || undefined,
      };
      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, payload);
      } else {
        await api.post('/tasks', { ...payload, projectId });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId, status) {
    try {
      await api.patch(`/tasks/${taskId}`, { status });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(taskId) {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/dashboard" className="hover:text-gray-900">Projects</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{project?.name ?? '…'}</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
            {project?.description && (
              <p className="mt-1 text-sm text-gray-500">{project.description}</p>
            )}
          </div>
          {canManage && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              + Add task
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Task form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-semibold text-gray-800">
              {editingTask ? 'Edit task' : 'New task'}
            </h2>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
            />
            <div>
              <label className="block text-sm text-gray-600 mb-1">Assign to</label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none w-full"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name ? `${m.name} (${m.email})` : m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Task board — columns by status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-xs text-gray-400">{tasksByStatus[status].length}</span>
              </div>

              {tasksByStatus[status].length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-24 flex items-center justify-center text-xs text-gray-400">
                  No tasks
                </div>
              ) : (
                tasksByStatus[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManage={canManage}
                    onStatusChange={handleStatusChange}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                    currentUserId={auth?.user?.id}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function TaskCard({ task, canManage, onStatusChange, onEdit, onDelete, currentUserId }) {
  const isAssignedToMe = task.assigned_to === currentUserId;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>
        <div className="flex gap-1.5 flex-shrink-0">
          {canManage && (
            <button
              onClick={() => onEdit(task)}
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              Edit
            </button>
          )}
          {canManage && (
            <button
              onClick={() => onDelete(task.id)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Del
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Status dropdown */}
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          disabled={!canManage && !isAssignedToMe}
          className={`text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
            !canManage && !isAssignedToMe ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
          }`}
          title={!canManage && !isAssignedToMe ? "You can only change the status of tasks assigned to you" : ""}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        {task.assigned_to_email && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isAssignedToMe
                ? 'bg-brand-50 text-brand-600 font-medium'
                : 'bg-gray-100 text-gray-500'
            }`}
            title={task.assigned_to_name ? `${task.assigned_to_name} (${task.assigned_to_email})` : task.assigned_to_email}
          >
            {isAssignedToMe ? 'You' : (task.assigned_to_name || task.assigned_to_email.split('@')[0])}
          </span>
        )}
      </div>
    </div>
  );
}
