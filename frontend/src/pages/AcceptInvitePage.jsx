import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { setAuth }    = useAuth();
  const { theme, toggleTheme } = useTheme();

  const token = searchParams.get('token');

  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <p className="text-status-danger-text">Invalid invite link — no token found.</p>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/accept-invite', { token, name, password });
      setAuth({
        token: data.token,
        user:  data.user,
        org:   data.org,
        role:  data.role,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4">
      {/* Theme toggle — top-right */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="fixed top-4 right-4 p-2 rounded-lg text-tx-muted
          hover:text-tx-primary hover:bg-surface-2 transition-colors"
      >
        {theme === 'dark'
          ? <Sun  size={17} strokeWidth={1.8} />
          : <Moon size={17} strokeWidth={1.8} />}
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-tx-primary">TeamFlow</h1>
          <p className="mt-2 text-tx-secondary">You've been invited to join a workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-1 shadow-sm rounded-xl p-8 space-y-5 border border-line"
        >
          <h2 className="text-xl font-semibold text-tx-primary">Accept your invite</h2>

          {error && (
            <div className="bg-status-danger-bg border border-status-danger-text/20
              text-status-danger-text text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">
              Choose a password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              minLength={8}
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-tx-muted">
              Already have an account? Leave this blank — you'll be added automatically.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium
              hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Joining…' : 'Join workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
