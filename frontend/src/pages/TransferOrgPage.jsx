import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Zap, Sun, Moon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';

/**
 * TransferOrgPage
 *
 * Standalone page — intentionally does NOT use <Layout> so that it works
 * for users who have no active workspace (auth.org === null).
 */
export default function TransferOrgPage() {
  const { token }              = useParams();
  const navigate               = useNavigate();
  const { logout }             = useAuth();
  const { showToast }          = useUI();
  const { theme, toggleTheme } = useTheme();

  const [isAccepting, setIsAccepting] = useState(false);

  async function handleAccept() {
    setIsAccepting(true);
    try {
      await api.post('/team/transfer/accept', { token });
      showToast(
        'Workspace ownership transferred! Please log in again to get your new permissions.',
        'success'
      );
      setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      showToast(err.message, 'error');
      setIsAccepting(false);
    }
  }

  function handleCancel() {
    navigate('/invites');
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Minimal nav bar */}
      <header className="bg-surface-1 border-b border-line px-6 h-14 flex items-center
        justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold text-tx-primary tracking-tight">
            TeamFlow
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary
            hover:bg-surface-2 transition-colors"
        >
          {theme === 'dark'
            ? <Sun  size={16} strokeWidth={1.8} />
            : <Moon size={16} strokeWidth={1.8} />}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center pt-20 px-4">
        <div className="max-w-md w-full bg-surface-1 border border-line
          rounded-2xl p-8 shadow-sm text-center">
          {/* Icon */}
          <div className="w-12 h-12 bg-accent-bg text-accent rounded-xl
            flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} />
          </div>

          <h1 className="text-2xl font-bold text-tx-primary mb-2">
            Accept Workspace Ownership
          </h1>
          <p className="text-sm text-tx-secondary mb-8">
            You have been invited to take full ownership of a workspace. Once you accept,
            the previous owner will be demoted to an admin and you will become the new owner.
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleCancel}
              disabled={isAccepting}
              className="px-4 py-2 text-sm font-medium text-tx-secondary
                bg-surface-2 hover:bg-line rounded-lg transition-colors
                disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="px-4 py-2 text-sm font-medium text-white bg-accent
                hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
            >
              {isAccepting ? 'Accepting...' : 'Accept Ownership'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
