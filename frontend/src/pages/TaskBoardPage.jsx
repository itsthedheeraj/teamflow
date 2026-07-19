import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';
import { MessageSquare, Plus, X, Calendar, Edit2, Trash2 } from 'lucide-react';

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
  const { showToast, confirm } = useUI();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '' });
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
      showToast(err.message, 'error');
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
      showToast(editingTask ? 'Task updated' : 'Task created', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(taskId, newStatus) {
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      await load();
      showToast('Status updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleUpdateNote(taskId, noteText) {
    try {
      await api.patch(`/tasks/${taskId}`, { latestNote: noteText });
      await load();
      showToast('Note saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleDelete(taskId) {
    const confirmed = await confirm('Delete this task?');
    if (!confirmed) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      load();
      showToast('Task deleted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
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
                    onUpdateNote={handleUpdateNote}
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

function TaskCard({ task, canManage, onStatusChange, onEdit, onDelete, currentUserId, onUpdateNote }) {
  const isAssignedToMe = task.assigned_to === currentUserId;
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(task.latest_note || '');
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const noteRef = useRef(null);
  const descRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (noteRef.current && !noteRef.current.contains(e.target)) {
        setIsNoteExpanded(false);
      }
      if (descRef.current && !descRef.current.contains(e.target)) {
        setIsDescExpanded(false);
      }
    }
    if (isNoteExpanded || isDescExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNoteExpanded, isDescExpanded]);

  const handleSaveNote = () => {
    onUpdateNote(task.id, noteText);
    setIsEditingNote(false);
  };

  const formattedDate = new Date(task.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  });
  
  const formattedNoteDate = task.latest_note_updated_at ? new Date(task.latest_note_updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }) : '';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm hover:shadow-md transition-shadow group">
      
      {/* Header: Title & Actions */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold text-gray-900 leading-snug">{task.title}</p>
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {canManage && (
            <button
              onClick={() => onEdit(task)}
              className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded"
              title="Edit Task"
            >
              <Edit2 size={14} />
            </button>
          )}
          {canManage && (
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete Task"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div ref={descRef}>
          <p className={`text-sm text-gray-600 ${isDescExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {task.description}
          </p>
          {task.description.length > 80 && !isDescExpanded && (
            <button 
              onClick={() => setIsDescExpanded(true)}
              className="text-[11px] text-brand-600 font-medium hover:underline mt-1 block"
            >
              Read more
            </button>
          )}
        </div>
      )}

      {/* Latest Note Section */}
      <div className="mt-2">
        {!isEditingNote ? (
          <div className="relative">
            {task.latest_note ? (
              <div ref={noteRef} className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 space-y-1.5 group/note relative">
                <div className="flex items-center gap-1.5 text-xs text-amber-800/70 font-medium">
                  <MessageSquare size={12} className="text-amber-500" />
                  <span>Latest Note by {task.latest_note_by_name || (task.latest_note_by_email && task.latest_note_by_email.split('@')[0]) || 'Someone'}</span>
                  <span className="text-amber-800/40">• {formattedNoteDate}</span>
                </div>
                <p className={`text-sm text-amber-900 ${isNoteExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>{task.latest_note}</p>
                
                {task.latest_note && task.latest_note.length > 50 && !isNoteExpanded && (
                  <button 
                    onClick={() => setIsNoteExpanded(true)}
                    className="text-[11px] text-amber-700 font-medium hover:underline block"
                  >
                    Read more
                  </button>
                )}
                
                <button
                  onClick={() => { setNoteText(task.latest_note || ''); setIsEditingNote(true); }}
                  className="absolute top-2 right-2 p-1 text-amber-600/0 group-hover/note:text-amber-600/50 hover:!text-amber-600 hover:bg-amber-100 rounded transition-all"
                  title="Edit Note"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingNote(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-600 transition-colors"
              >
                <Plus size={13} strokeWidth={2.5} /> Add Note
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-2">
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What's the latest update?"
              className="w-full text-sm bg-white border border-gray-200 rounded p-2 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsEditingNote(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 px-3 py-1 rounded shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Meta & Status */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 mt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400" title="Created on">
            <Calendar size={13} />
            <span>{formattedDate}</span>
          </div>

          {task.assigned_to_email && (
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shadow-sm ring-2 ring-white ${
                isAssignedToMe ? 'bg-brand-500' : 'bg-gray-400'
              }`}
              title={task.assigned_to_name ? `${task.assigned_to_name} (${task.assigned_to_email})` : task.assigned_to_email}
            >
              {(task.assigned_to_name?.[0] || task.assigned_to_email[0]).toUpperCase()}
            </div>
          )}
        </div>

        {/* Status dropdown */}
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          disabled={!canManage && !isAssignedToMe}
          className={`text-xs font-medium border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-sm ${
            !canManage && !isAssignedToMe ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'bg-white hover:bg-gray-50'
          }`}
          title={!canManage && !isAssignedToMe ? "You can only change the status of tasks assigned to you" : ""}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
    </div>
  );
}
