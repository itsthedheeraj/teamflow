import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * UsageBar
 *
 * Displays two slim progress bars — one for members, one for tasks —
 * showing how close the org is to its tier limits.
 *
 * Shows an "Upgrade to Pro" nudge when either resource is at 80%+
 * of the Free tier limit. Only shown to org owners (they are the
 * only ones who can act on it).
 *
 * Fetches from GET /api/usage on mount. Non-blocking — if the fetch
 * fails the component renders nothing rather than crashing.
 */
export default function UsageBar() {
  const { auth } = useAuth();
  const [usage, setUsage] = useState(null);

  const isOwner = auth?.role === 'owner';

  useEffect(() => {
    api.get('/usage')
      .then((data) => setUsage(data.usage))
      .catch(() => {}); // silent — non-critical UI element
  }, [auth?.org?.id]); // re-fetch when org switches

  if (!usage) return null;

  const { members, tasks, tier } = usage;

  // Only show the bar if at least one resource is over 50% used
  const memberPct = members.unlimited ? 0 : (members.current / members.limit) * 100;
  const taskPct = tasks.unlimited ? 0 : (tasks.current / tasks.limit) * 100;
  const shouldShow = memberPct > 50 || taskPct > 50 || tier === 'free';

  if (!shouldShow) return null;

  const nearLimit = memberPct >= 80 || taskPct >= 80;

  return (
    <div className={`border-b px-4 py-2 text-xs ${
      nearLimit ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center gap-6 flex-wrap">

        {/* Members bar */}
        {!members.unlimited && (
          <UsageMeter
            label="Members"
            current={members.current}
            limit={members.limit}
          />
        )}

        {/* Tasks bar */}
        {!tasks.unlimited && (
          <UsageMeter
            label="Tasks"
            current={tasks.current}
            limit={tasks.limit}
          />
        )}

        {/* Upgrade nudge — owner only, free tier */}
        {tier === 'free' && nearLimit && isOwner && (
          <Link
            to="/billing"
            className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap"
          >
            Upgrade to Pro →
          </Link>
        )}

        {/* Soft nudge for non-owners */}
        {tier === 'free' && nearLimit && !isOwner && (
          <span className="ml-auto text-xs text-amber-600 whitespace-nowrap">
            Approaching plan limits
          </span>
        )}
      </div>
    </div>
  );
}

function UsageMeter({ label, current, limit }) {
  const pct = Math.min((current / limit) * 100, 100);
  const color =
    pct >= 100 ? 'bg-red-500'
    : pct >= 80 ? 'bg-amber-400'
    : 'bg-brand-500';

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <span className="text-gray-500 whitespace-nowrap">
        {label}: {current}/{limit}
      </span>
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
