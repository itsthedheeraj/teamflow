import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, Github, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/projects';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(''); // clear error when typing
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
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-surface-0">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-accent text-white p-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TeamFlow</h1>
        </div>
        
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Manage better projects.<br/>Empower every team.
          </h2>
          <p className="text-white/80 text-lg mb-12">
            From tasks to GitHub integration — everything in one place.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <span className="text-white/90 font-medium">Custom task boards</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <CheckSquare size={20} className="text-white" />
              </div>
              <span className="text-white/90 font-medium">Progress tracking</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Github size={20} className="text-white" />
              </div>
              <span className="text-white/90 font-medium">One-click GitHub integration</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-white/70 text-sm">
            Trusted by top engineering teams and open source communities.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 bg-surface-0">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-tx-primary mb-2">Welcome back</h2>
            <p className="text-tx-secondary text-sm">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-status-danger-bg border border-status-danger-text/20 p-3 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="text-status-danger-text shrink-0 mt-0.5" size={16} />
                <p className="text-status-danger-text text-sm font-medium">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1.5">
                Email address
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="w-full border border-line-strong rounded-lg px-4 py-2.5 text-sm
                  bg-surface-1 text-tx-primary placeholder:text-tx-muted
                  focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full border border-line-strong rounded-lg pl-4 pr-10 py-2.5 text-sm
                    bg-surface-1 text-tx-primary placeholder:text-tx-muted
                    focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted hover:text-tx-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium
                hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="mt-8 text-center space-y-4">
              <p className="text-sm text-tx-muted">New to TeamFlow?</p>
              <Link
                to="/signup"
                className="block w-full border border-line-strong py-2.5 rounded-lg text-sm font-medium text-tx-primary hover:bg-surface-2 transition-colors"
              >
                Create an account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
