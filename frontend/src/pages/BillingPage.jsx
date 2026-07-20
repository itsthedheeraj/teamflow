import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const TIER_FEATURES = {
  free: [
    'Up to 3 team members',
    'Up to 20 tasks',
    'All core features',
  ],
  pro: [
    'Up to 20 team members',
    'Unlimited tasks',
    'Priority support',
    'All core features',
  ],
};

export default function BillingPage() {
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const isOwner       = auth?.role === 'owner';
  const showSuccess   = searchParams.get('success')   === 'true';
  const showCancelled = searchParams.get('cancelled') === 'true';

  useEffect(() => {
    api.get('/billing/status')
      .then((data) => setBilling(data.billing))
      .catch((err) => setError(err.message));
  }, []);

  async function handleUpgrade() {
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/billing/checkout', {});
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleManage() {
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/billing/portal', {});
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const tier = billing?.subscription_tier ?? auth?.org?.subscriptionTier ?? 'free';

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-tx-primary">Billing</h1>

        {/* Post-checkout banners */}
        {showSuccess && (
          <div className="bg-status-success-bg border border-status-success-text/20
            text-status-success-text rounded-xl px-5 py-4">
            <p className="font-medium">Payment received — welcome to Pro!</p>
            <p className="text-sm mt-1 opacity-80">
              Your plan will update within a few seconds as we process the
              confirmation from Stripe.
            </p>
          </div>
        )}
        {showCancelled && (
          <div className="bg-status-warning-bg border border-status-warning-text/20
            text-status-warning-text rounded-xl px-5 py-4">
            Checkout was cancelled. No charge was made.
          </div>
        )}
        {error && (
          <div className="bg-status-danger-bg border border-status-danger-text/20
            text-status-danger-text text-sm rounded-xl px-5 py-4">
            {error}
          </div>
        )}

        {/* Current plan card */}
        <div className="bg-surface-1 border border-line rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-tx-muted">Current plan</p>
              <p className="text-2xl font-bold text-tx-primary capitalize mt-0.5">
                {tier}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              tier === 'pro'
                ? 'bg-status-pro-bg text-status-pro-text'
                : 'bg-surface-2 text-tx-muted'
            }`}>
              {tier === 'pro' ? 'Active' : 'Free tier'}
            </span>
          </div>

          {/* Feature list */}
          <ul className="space-y-2">
            {(TIER_FEATURES[tier] || TIER_FEATURES.free).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-tx-secondary">
                <svg
                  className="w-4 h-4 text-status-success-text flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {/* Actions — owner only */}
          {isOwner && (
            <div className="pt-2 flex gap-3 flex-wrap">
              {tier === 'free' ? (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="bg-accent text-white px-5 py-2.5 rounded-lg text-sm font-medium
                    hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? 'Redirecting to Stripe…' : 'Upgrade to Pro'}
                </button>
              ) : (
                <button
                  onClick={handleManage}
                  disabled={loading}
                  className="bg-surface-1 border border-line text-tx-secondary px-5 py-2.5
                    rounded-lg text-sm font-medium hover:bg-surface-2
                    disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Opening portal…' : 'Manage subscription'}
                </button>
              )}
            </div>
          )}

          {!isOwner && (
            <p className="text-sm text-tx-muted pt-1">
              Only the Owner can manage billing.
            </p>
          )}
        </div>

        {/* Plan comparison — free tier only */}
        {tier === 'free' && (
          <div className="bg-surface-1 border border-line rounded-xl p-6">
            <h2 className="font-semibold text-tx-primary mb-4">
              What you get with Pro
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-tx-muted uppercase text-xs tracking-wide">
                  Free
                </p>
                {TIER_FEATURES.free.map((f) => (
                  <p key={f} className="text-tx-secondary">{f}</p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="font-medium text-accent uppercase text-xs tracking-wide">
                  Pro
                </p>
                {TIER_FEATURES.pro.map((f) => (
                  <p key={f} className="text-tx-primary font-medium">{f}</p>
                ))}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="mt-5 w-full bg-accent text-white py-2.5 rounded-lg text-sm font-medium
                  hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Redirecting to Stripe…' : 'Upgrade to Pro — Test mode'}
              </button>
            )}
          </div>
        )}

        {/* Stripe test mode notice */}
        <div className="bg-status-warning-bg border border-status-warning-text/20
          rounded-xl px-5 py-4 text-sm text-status-warning-text">
          <p className="font-medium">Stripe test mode</p>
          <p className="mt-1">
            Use card number{' '}
            <code className="font-mono bg-status-warning-text/10 px-1 rounded">
              4242 4242 4242 4242
            </code>
            , any future expiry, any CVC. No real charge is made.
          </p>
        </div>
      </div>
    </Layout>
  );
}
