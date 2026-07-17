import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

/**
 * BillingPage
 *
 * Shows the org's current subscription tier and lets the Owner
 * upgrade to Pro (opens Stripe Checkout) or manage their subscription
 * (opens Stripe Customer Portal).
 *
 * IMPORTANT: The success banner shown after checkout is purely cosmetic —
 * it reflects what the user just did on Stripe's side. The actual
 * subscription_tier in the database is updated by the webhook, which
 * may arrive a few seconds after the redirect. We re-fetch billing
 * status on mount to show the most current state.
 */

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
  const [error, setError] = useState('');

  const isOwner = auth?.role === 'owner';
  const showSuccess = searchParams.get('success') === 'true';
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
      // Redirect the browser to Stripe's hosted checkout page
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
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

        {/* Post-checkout banners */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-5 py-4">
            <p className="font-medium">Payment received — welcome to Pro!</p>
            <p className="text-sm mt-1 text-green-600">
              Your plan will update within a few seconds as we process the
              confirmation from Stripe.
            </p>
          </div>
        )}
        {showCancelled && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl px-5 py-4">
            Checkout was cancelled. No charge was made.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-5 py-4">
            {error}
          </div>
        )}

        {/* Current plan card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500">Current plan</p>
              <p className="text-2xl font-bold text-gray-900 capitalize mt-0.5">
                {tier}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                tier === 'pro'
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tier === 'pro' ? 'Active' : 'Free tier'}
            </span>
          </div>

          {/* Feature list */}
          <ul className="space-y-2">
            {(TIER_FEATURES[tier] || TIER_FEATURES.free).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0"
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
                  className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Redirecting to Stripe…' : 'Upgrade to Pro'}
                </button>
              ) : (
                <button
                  onClick={handleManage}
                  disabled={loading}
                  className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Opening portal…' : 'Manage subscription'}
                </button>
              )}
            </div>
          )}

          {!isOwner && (
            <p className="text-sm text-gray-400 pt-1">
              Only the Owner can manage billing.
            </p>
          )}
        </div>

        {/* Plan comparison — only shown on free tier */}
        {tier === 'free' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              What you get with Pro
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-gray-500 uppercase text-xs tracking-wide">
                  Free
                </p>
                {TIER_FEATURES.free.map((f) => (
                  <p key={f} className="text-gray-600">{f}</p>
                ))}
              </div>
              <div className="space-y-2">
                <p className="font-medium text-brand-600 uppercase text-xs tracking-wide">
                  Pro
                </p>
                {TIER_FEATURES.pro.map((f) => (
                  <p key={f} className="text-gray-900 font-medium">{f}</p>
                ))}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="mt-5 w-full bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Redirecting to Stripe…' : 'Upgrade to Pro — Test mode'}
              </button>
            )}
          </div>
        )}

        {/* Test mode notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-sm text-yellow-800">
          <p className="font-medium">Stripe test mode</p>
          <p className="mt-1">
            Use card number <code className="font-mono bg-yellow-100 px-1 rounded">4242 4242 4242 4242</code>,
            any future expiry, any CVC. No real charge is made.
          </p>
        </div>
      </div>
    </Layout>
  );
}
