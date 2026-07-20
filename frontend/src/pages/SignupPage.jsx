import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [form, setForm]     = useState({ name: '', email: '', password: '' });
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
      const data = await api.post('/auth/signup', form);
      setAuth({
        token: data.token,
        user:  data.user,
        org:   data.org || null,
        role:  data.role || null,
      });
      navigate('/projects');
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
          <p className="mt-2 text-tx-secondary">Create an account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface-1 shadow-sm rounded-xl p-8 space-y-5
            border border-line"
        >
          <h2 className="text-xl font-semibold text-tx-primary">Get started</h2>

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
              Full Name
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Doe"
              required
              className="w-full border border-line-strong rounded-lg px-3 py-2 text-sm
                bg-surface-2 text-tx-primary placeholder:text-tx-muted
                focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tx-secondary mb-1">
              Work email
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
              Choose a password
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 8 characters"
              required
              minLength={8}
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-tx-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
