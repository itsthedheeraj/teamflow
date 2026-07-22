import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';
import { MessageSquare, Plus, X, Calendar, Edit2, Trash2, Github, Settings, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';

const STATUSES = ['todo', 'in_progress', 'done'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

// Status badge: uses semantic status tokens so they adapt to dark mode
const STATUS_COLORS = {
  todo:        'bg-surface-2 text-tx-secondary',
  in_progress: 'bg-status-warning-bg text-status-warning-text',
  done:        'bg-status-success-bg text-status-success-text',
};

const getRepoPath = (urlOrPath) => {
  if (!urlOrPath) return '';
  try {
    const url = new URL(urlOrPath);
    return url.pathname.replace(/^\/|\/$/g, '');
  } catch (e) {
    return urlOrPath.replace(/^\/|\/$/g, '');
  }
};

export default function TaskBoardPage() {
  const { projectId } = useParams();
  const { auth }      = useAuth();
  const { showToast, confirm } = useUI();

  const [project, setProject]         = useState(null);
  const [tasks, setTasks]             = useState([]);
  const [members, setMembers]         = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm]               = useState({ title: '', description: '', assignedTo: '' });
  const [loading, setLoading]         = useState(false);

  // GitHub integration state
  const [repoData, setRepoData]       = useState(null);
  const [commitData, setCommitData]   = useState(null);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [repoInput, setRepoInput]     = useState('');
  const [repoLoading, setRepoLoading] = useState(false);

  const canManage =
    auth?.role === 'admin' ||
    auth?.role === 'owner' ||
    project?.team_lead_id === auth?.user?.id;

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
      setRepoInput(projData.project?.github_repo || '');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  useEffect(() => { load(); }, [projectId]);

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
    fetchGithub();
  }, [project?.github_repo]);

  async function handleSaveRepo(e) {
    e.preventDefault();
    setRepoLoading(true);
    try {
      await api.patch(`/projects/${projectId}`, { github_repo: repoInput });
      await load();
      setShowRepoModal(false);
      showToast('GitHub repository updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRepoLoading(false);
    }
  }

  function resetForm() {
    setForm({ title: '', description: '', assignedTo: '' });
    setEditingTask(null);
    setShowForm(false);
  }

  function startEdit(task) {
    setForm({
      title:      task.title,
      description: task.description || '',
      assignedTo:  task.assigned_to || '',
    });
    setEditingTask(task);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title:       form.title,
        description: form.description || undefined,
        assignedTo:  form.assignedTo  || undefined,
      };
      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, payload);
      } else {
        await api.post('/tasks', { ...payload, projectId });
      }
      resetForm();
      load();
      if (!editingTask) window.dispatchEvent(new Event('usage:refresh'));
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
      window.dispatchEvent(new Event('usage:refresh'));
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
        <div className="flex items-center gap-2 text-sm text-tx-muted">
          <Link to="/projects" className="hover:text-tx-primary transition-colors">
            Projects
          </Link>
          <span>/</span>
          <span className="text-tx-primary font-medium">{project?.name ?? '…'}</span>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-tx-primary truncate">{project?.name}</h1>
              {canManage && (
                <button
                  onClick={() => setShowRepoModal(true)}
                  className="flex items-center gap-1.5 p-1.5 px-3 border border-line-strong text-tx-secondary hover:text-tx-primary hover:bg-surface-2 rounded-md transition-colors text-sm font-medium"
                  title="Manage GitHub Link"
                >
                  <Github size={16} />
                  GitHub Link
                </button>
              )}
            </div>
            {project?.description && (
              <p className="mt-1 text-sm text-tx-secondary">{project.description}</p>
            )}
            
            {project?.github_repo && repoData && (
              <div className="mt-4 p-4 bg-surface-2 border border-line rounded-lg">
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex items-center gap-1.5 text-tx-primary font-medium text-sm">
                    <Github size={14} />
                    <a href={repoData.html_url} target="_blank" rel="noreferrer" className="hover:underline">
                      {repoData.full_name || getRepoPath(project.github_repo)}
                    </a>
                  </div>
                  {repoData.description && (
                    <p className="text-sm text-tx-secondary italic">
                      {repoData.description}
                    </p>
                  )}
                  {commitData && (
                    <div className="text-xs text-tx-secondary truncate mt-1">
                      <span className="font-semibold text-[10px] uppercase tracking-wider text-tx-muted bg-surface-2 px-1.5 py-0.5 rounded mr-1.5">Latest Commit</span>
                      <a href={commitData.html_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        {commitData.commit.message}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {canManage && (
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium
                  hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                + Add task
              </button>
              <button
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-accent hover:text-white hover:bg-accent px-4 py-2 rounded-lg transition-colors border border-accent/20 bg-accent/5 whitespace-nowrap"
                onClick={(e) => e.preventDefault()}
              >
                <Sparkles size={14} />
                Get suggestion
              </button>
            </div>
          )}
        </div>

        {/* Task form Modal */}
        <Modal 
          isOpen={showForm} 
          onClose={resetForm}
          title={editingTask ? 'Edit task' : 'New task'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title"
              required
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              rows={3}
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none resize-none"
            />
            <div>
              <label className="block text-sm text-tx-secondary mb-1">Assign to</label>
              <select
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="border border-line-strong rounded-lg px-3 py-2 text-sm
                  bg-surface-2 text-tx-primary focus:outline-none w-full"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name ? `${m.name} (${m.email})` : m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-line">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-sm text-tx-secondary hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium
                  hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Saving…' : editingTask ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </form>
        </Modal>

        {/* GitHub Repo Modal */}
        <Modal
          isOpen={showRepoModal}
          onClose={() => setShowRepoModal(false)}
          title="Project Settings"
        >
          <form onSubmit={handleSaveRepo} className="space-y-4">
            <div>
              <label className="block text-sm text-tx-primary font-medium mb-1">
                GitHub Repository
              </label>
              <p className="text-xs text-tx-muted mb-2">
                Link a public GitHub repository (e.g. <code>owner/repo</code>) to see the latest commits.
              </p>
              <input
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="e.g. facebook/react"
                className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                  bg-surface-2 text-tx-primary placeholder:text-tx-muted
                  focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRepoModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-tx-secondary hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={repoLoading}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium
                  hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {repoLoading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Task board — columns by status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-xs text-tx-muted">{tasksByStatus[status].length}</span>
              </div>

              {tasksByStatus[status].length === 0 ? (
                <div className="border-2 border-dashed border-line-dashed rounded-xl h-24
                  flex items-center justify-center text-xs text-tx-muted">
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

// ─── TaskCard ─────────────────────────────────────────────────────

function TaskCard({ task, canManage, onStatusChange, onEdit, onDelete, currentUserId, onUpdateNote }) {
  const isAssignedToMe = task.assigned_to === currentUserId;
  const [isEditingNote,   setIsEditingNote]   = useState(false);
  const [noteText,        setNoteText]        = useState(task.latest_note || '');
  const [isNoteExpanded,  setIsNoteExpanded]  = useState(false);
  const [isDescExpanded,  setIsDescExpanded]  = useState(false);
  const noteRef = useRef(null);
  const descRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (noteRef.current && !noteRef.current.contains(e.target)) setIsNoteExpanded(false);
      if (descRef.current && !descRef.current.contains(e.target)) setIsDescExpanded(false);
    }
    if (isNoteExpanded || isDescExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNoteExpanded, isDescExpanded]);

  function handleSaveNote() {
    onUpdateNote(task.id, noteText);
    setIsEditingNote(false);
  }

  const formattedDate = new Date(task.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const formattedNoteDate = task.latest_note_updated_at
    ? new Date(task.latest_note_updated_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : '';

  return (
    <div className="bg-surface-1 border border-line rounded-xl p-4 space-y-4
      shadow-sm hover:shadow-md transition-shadow group">

      {/* Header: Title & Actions */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[15px] font-semibold text-tx-primary leading-snug">
          {task.title}
        </p>
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {canManage && (
            <button
              onClick={() => onEdit(task)}
              className="p-1 text-tx-muted hover:text-accent hover:bg-accent-bg rounded transition-colors"
              title="Edit Task"
            >
              <Edit2 size={14} />
            </button>
          )}
          {canManage && (
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 text-tx-muted hover:text-status-danger-text
                hover:bg-status-danger-bg rounded transition-colors"
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
          <p className={`text-sm text-tx-secondary ${isDescExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {task.description}
          </p>
          {task.description.length > 80 && !isDescExpanded && (
            <button
              onClick={() => setIsDescExpanded(true)}
              className="text-[11px] text-accent font-medium hover:underline mt-1 block"
            >
              Read more
            </button>
          )}
        </div>
      )}

      {/* Latest Note */}
      <div className="mt-2">
        {!isEditingNote ? (
          <div className="relative">
            {task.latest_note ? (
              <div
                ref={noteRef}
                className="bg-status-note-bg border border-status-note-border
                  rounded-lg p-3 space-y-1.5 group/note relative"
              >
                <div className="flex items-center gap-1.5 text-xs text-status-note-text/70 font-medium">
                  <MessageSquare size={12} className="text-status-note-text opacity-70" />
                  <span>
                    Latest Note by{' '}
                    {task.latest_note_by_name ||
                      (task.latest_note_by_email && task.latest_note_by_email.split('@')[0]) ||
                      'Someone'}
                  </span>
                  <span className="opacity-50">• {formattedNoteDate}</span>
                </div>
                <p className={`text-sm text-status-note-text ${isNoteExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                  {task.latest_note}
                </p>
                {task.latest_note.length > 50 && !isNoteExpanded && (
                  <button
                    onClick={() => setIsNoteExpanded(true)}
                    className="text-[11px] text-status-note-text/80 font-medium hover:underline block"
                  >
                    Read more
                  </button>
                )}
                <button
                  onClick={() => { setNoteText(task.latest_note || ''); setIsEditingNote(true); }}
                  className="absolute top-2 right-2 p-1 text-transparent
                    group-hover/note:text-status-note-text/50
                    hover:!text-status-note-text hover:bg-status-note-border/30
                    rounded transition-all"
                  title="Edit Note"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingNote(true)}
                className="flex items-center gap-1.5 text-xs font-medium
                  text-tx-muted hover:text-accent transition-colors"
              >
                <Plus size={13} strokeWidth={2.5} /> Add Note
              </button>
            )}
          </div>
        ) : (
          <div className="bg-surface-2 border border-line rounded-lg p-2.5 space-y-2">
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What's the latest update?"
              className="w-full text-sm bg-surface-1 border border-line rounded p-2
                text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIsEditingNote(false)}
                className="text-xs font-medium text-tx-muted hover:text-tx-primary px-2 py-1 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="text-xs font-medium bg-accent text-white
                  hover:opacity-90 px-3 py-1 rounded shadow-sm transition-opacity"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Meta & Status */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-line mt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-tx-muted" title="Created on">
            <Calendar size={13} />
            <span>{formattedDate}</span>
          </div>

          {task.assigned_to_email && (
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full
                text-[10px] font-bold text-white shadow-sm ring-2 ring-surface-1 ${
                  isAssignedToMe ? 'bg-accent' : 'bg-tx-muted'
                }`}
              title={
                task.assigned_to_name
                  ? `${task.assigned_to_name} (${task.assigned_to_email})`
                  : task.assigned_to_email
              }
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
          title={
            !canManage && !isAssignedToMe
              ? 'You can only change the status of tasks assigned to you'
              : ''
          }
          className={`text-xs font-medium border border-line rounded-md px-2 py-1
            focus:outline-none focus:ring-1 focus:ring-accent shadow-sm
            bg-surface-2 text-tx-primary transition-colors ${
              !canManage && !isAssignedToMe
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-surface-1'
            }`}
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
    </div>
  );
}
