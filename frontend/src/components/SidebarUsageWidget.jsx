import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * SidebarUsageWidget
 *
 * Compact usage card shown at the bottom of the sidebar.
 * Shows: plan label, members usage bar, tasks usage bar,
 * and an "Upgrade to Pro" button when on the free tier.
 *
 * Upgrade button is only shown when:
 *   - tier === 'free'
 *   - the current user is the owner (only owners can manage billing)
 *
 * Renders nothing if the usage fetch fails or data hasn't loaded.
 */
export default function SidebarUsageWidget() {
  const { auth } = useAuth();
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    function fetchUsage() {
      api.get('/usage')
        .then((d) => setUsage(d.usage))
        .catch(() => {});
    }
    
    fetchUsage();
    
    window.addEventListener('usage:refresh', fetchUsage);
    return () => window.removeEventListener('usage:refresh', fetchUsage);
  }, [auth?.org?.id]);

  if (!usage) return null;

  const { tier, members, tasks } = usage;
  const isFree = tier === 'free';
  const isOwner = auth?.role === 'owner';

  return (
    <div className="mx-3 mb-2 p-3 rounded-xl border border-gray-100 bg-gray-50 space-y-2.5">
      {/* Plan label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {isFree ? 'Free plan' : 'Pro plan'}
        </span>
        {!isFree && (
          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md">
            Pro
          </span>
        )}
      </div>

      {/* Members meter */}
      {!members.unlimited && (
        <UsageMeter
          label="Members"
          current={members.current}
          limit={members.limit}
        />
      )}

      {/* Tasks meter */}
      {!tasks.unlimited && (
        <UsageMeter
          label="Tasks"
          current={tasks.current}
          limit={tasks.limit}
        />
      )}

      {/* Upgrade button — free tier + owner only */}
      {isFree && isOwner && (
        <Link
          to="/billing"
          className="flex items-center justify-center gap-1.5 w-full mt-1 py-1.5 px-3 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
        >
          Upgrade to Pro
          <ArrowUpRight size={12} strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}

function UsageMeter({ label, current, limit }) {
  const pct = Math.min((current / limit) * 100, 100);
  const barColor =
    pct >= 100 ? 'bg-red-500'
    : pct >= 80 ? 'bg-amber-400'
    : 'bg-brand-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{current}/{limit}</span>
      </div>
      <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
