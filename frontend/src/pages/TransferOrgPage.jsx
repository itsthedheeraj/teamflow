import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import Layout from '../components/Layout';

export default function TransferOrgPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { auth, refreshUser } = useAuth();
  const { showToast } = useUI();
  
  const [isAccepting, setIsAccepting] = useState(false);

  async function handleAccept() {
    setIsAccepting(true);
    try {
      await api.post('/team/transfer/accept', { token });
      showToast('Workspace ownership transferred successfully!', 'success');
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      showToast(err.message, 'error');
      setIsAccepting(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Building2 size={24} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accept Workspace Ownership</h1>
        <p className="text-sm text-gray-600 mb-8">
          You have been invited to take full ownership of a workspace. Once you accept, the previous owner will be demoted to an admin.
        </p>
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
    </Layout>
  );
}
