import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/projects';

  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      setAuth({
        token: data.token,
        user:  data.user,
        org:   data.org,
        role:  data.role,
      });
      navigate(from);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 px-4">
      {/* Theme toggle — top-right corner */}
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
          <p className="mt-2 text-tx-secondary">Sign in to your workspace</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-1 shadow-sm rounded-xl p-8 space-y-5
            border border-line"
        >
          <h2 className="text-xl font-semibold text-tx-primary">Welcome back</h2>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-tx-muted
              hover:text-tx-primary transition-colors -mt-1"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Back
          </Link>

          {error && (
            <div className="bg-status-danger-bg border border-status-danger-text/20
              text-status-danger-text text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              required
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Your password"
              required
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-2 rounded-lg text-sm font-medium
              hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-tx-muted">
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent hover:underline font-medium">
              Create a workspace
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
