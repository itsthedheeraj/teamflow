import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';

/**
 * TransferOrgPage
 *
 * Standalone page — intentionally does NOT use <Layout> so that it works
 * correctly for users who have no active workspace (auth.org === null).
 * Layout's SidebarOrgSwitcher and SidebarUsageWidget both assume an active
 * org and would crash or redirect no-org users.
 */
export default function TransferOrgPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useUI();

  const [isAccepting, setIsAccepting] = useState(false);

  async function handleAccept() {
    setIsAccepting(true);
    try {
      await api.post('/team/transfer/accept', { token });
      showToast(
        'Workspace ownership transferred! Please log in again to get your new permissions.',
        'success'
      );
      // Small delay so the toast is visible before redirect
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal nav bar */}
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <Zap size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold text-gray-900 tracking-tight">TeamFlow</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center pt-20 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accept Workspace Ownership</h1>
          <p className="text-sm text-gray-600 mb-8">
            You have been invited to take full ownership of a workspace. Once you accept, the
            previous owner will be demoted to an admin and you will become the new owner.
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={handleCancel}
              disabled={isAccepting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isAccepting ? 'Accepting...' : 'Accept Ownership'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
