import { Link, Navigate } from 'react-router-dom';
import { Zap, Users, FolderOpen, TrendingUp, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/**
 * LandingPage — public front door.
 *
 * Does NOT use Layout.jsx (that shell is for authenticated users).
 * Has its own minimal nav + footer, including the theme toggle.
 *
 * Logged-in visitors are immediately redirected to /projects.
 */
export default function LandingPage() {
  const { auth } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (auth) return <Navigate to="/projects" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface-1 border-b border-line">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Zap size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-tx-primary tracking-tight">
              TeamFlow
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-2 transition-colors"
            >
              {theme === 'dark'
                ? <Sun  size={16} strokeWidth={1.8} />
                : <Moon size={16} strokeWidth={1.8} />}
            </button>

            <Link
              to="/login"
              className="text-sm font-medium text-tx-secondary hover:text-tx-primary
                transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-2"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium bg-accent text-white px-4 py-1.5
                rounded-lg hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Eyebrow pill */}
          <span className="inline-block mb-5 px-3 py-1 text-xs font-semibold tracking-wide
            text-accent bg-accent-bg rounded-full">
            Free to start · No card required
          </span>

          {/* Headline */}
          <h1 className="text-5xl font-bold text-tx-primary leading-[1.15] tracking-tight">
            The team workspace{' '}
            <span className="text-accent">that scales with you</span>
          </h1>

          {/* Sub-heading */}
          <p className="mt-5 text-lg text-tx-secondary leading-relaxed max-w-xl mx-auto">
            TeamFlow gives your whole organization a shared home — invite
            teammates, track projects together, and upgrade your plan only
            when you actually need more room to grow.
          </p>

          {/* CTA row */}
          <div className="mt-9 flex items-center justify-center gap-5 flex-wrap">
            <Link
              to="/signup"
              className="inline-block bg-accent text-white text-sm font-semibold
                px-7 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium text-tx-muted hover:text-tx-primary transition-colors"
            >
              Already have a workspace? Sign in →
            </Link>
          </div>
        </section>

        {/* ── Illustration ───────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          {/*
            The SVG illustration has a hard-coded sky-blue background (#dbeafe).
            We wrap it in a container that adapts: on light mode the blue border
            stays; on dark mode we add a subtle overlay ring so the illustration
            doesn't float against the dark page with no separation.
          */}
          <div className="rounded-2xl overflow-hidden border border-line
            ring-1 ring-line shadow-sm">
            <PuzzleIllustration />
          </div>
        </section>

        {/* ── What you get ───────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <p className="text-center text-xs font-semibold text-tx-muted
            uppercase tracking-widest mb-12">
            What you get
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              Icon={Users}
              iconBg="bg-accent-bg"
              iconColor="text-accent"
              title="Organization accounts"
              description="Your whole team shares one workspace. Assign Owner, Admin, or Member roles so the right people have the right access."
            />
            <FeatureCard
              Icon={FolderOpen}
              iconBg="bg-violet-500/10"
              iconColor="text-violet-500"
              title="Shared task tracking"
              description="Create projects, assign tasks, and move work from To Do to Done. Everyone sees the same board, always in sync."
            />
            <FeatureCard
              Icon={TrendingUp}
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-500"
              title="Plans that fit your team"
              description="Start free with up to 3 teammates. Upgrade to Pro when you need more — limits are enforced automatically."
            />
            <FeatureCard
              Icon={ShieldCheck}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-500"
              title="Your data stays yours"
              description="Every organization's data is strictly isolated — no org can ever see another's projects, tasks, or members."
            />
          </div>
        </section>

        {/* ── Bottom CTA band ────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="rounded-2xl bg-surface-2 border border-line
            px-8 py-14 text-center">
            <h2 className="text-2xl font-bold text-tx-primary">
              Ready to bring your team together?
            </h2>
            <p className="mt-3 text-tx-secondary text-base max-w-md mx-auto">
              Set up your workspace in under a minute. Free forever for small teams.
            </p>
            <Link
              to="/signup"
              className="inline-block mt-7 bg-accent text-white text-sm font-semibold
                px-7 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Create your free workspace
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface-1">
        <div className="max-w-6xl mx-auto px-6 py-7 flex flex-col sm:flex-row
          items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center">
              <Zap size={10} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-tx-primary">TeamFlow</span>
          </div>

          <p className="text-xs text-tx-muted text-center">
            © 2026 TeamFlow. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-xs text-tx-muted">
            <Link to="/login"  className="hover:text-tx-primary transition-colors">Sign in</Link>
            <Link to="/signup" className="hover:text-tx-primary transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function FeatureCard({ Icon, iconBg, iconColor, title, description }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconColor}
        flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <h3 className="text-sm font-semibold text-tx-primary">{title}</h3>
      <p className="text-sm text-tx-muted leading-relaxed">{description}</p>
    </div>
  );
}

/**
 * PuzzleIllustration
 *
 * Original flat-design SVG illustration. The sky-blue background (#dbeafe)
 * is intentional — it's part of the illustration art, not a page background.
 * On dark mode the illustration still looks correct because it's self-contained
 * with its own palette; the surrounding wrapper (ring + border) handles the
 * transition between the illustration and the dark page background.
 */
function PuzzleIllustration() {
  return (
    <svg
      viewBox="0 0 900 420"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full"
      aria-label="Team collaboratively assembling puzzle piece blocks"
    >
      {/* ── Sky background ── */}
      <rect width="900" height="420" fill="#dbeafe" />

      {/* ── Decorative dashed arc lines ── */}
      <path d="M 60 380 Q 200 100 440 80" fill="none" stroke="#93c5fd" strokeWidth="2" strokeDasharray="8 7" />
      <path d="M 30 360 Q 180 120 420 95" fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 8" />
      <path d="M 840 380 Q 710 140 500 90" fill="none" stroke="#93c5fd" strokeWidth="2" strokeDasharray="8 7" />

      {/* ── Clouds ── */}
      <ellipse cx="780" cy="52" rx="28" ry="16" fill="white" />
      <ellipse cx="800" cy="48" rx="22" ry="14" fill="white" />
      <ellipse cx="760" cy="55" rx="20" ry="12" fill="white" />
      <ellipse cx="848" cy="72" rx="18" ry="10" fill="white" />
      <ellipse cx="862" cy="68" rx="14" ry="9"  fill="white" />

      {/* ── Left plant ── */}
      <rect x="38" y="330" width="8" height="70" rx="4" fill="#4ade80" />
      <ellipse cx="42" cy="310" rx="22" ry="30" fill="#86efac" />
      <ellipse cx="22" cy="330" rx="16" ry="22" fill="#4ade80" />
      <ellipse cx="62" cy="325" rx="18" ry="24" fill="#86efac" />
      <line x1="42" y1="290" x2="42" y2="330" stroke="#4ade80" strokeWidth="1.5" />
      <line x1="22" y1="318" x2="42" y2="328" stroke="#4ade80" strokeWidth="1.2" />

      {/* ── Right plant ── */}
      <rect x="852" y="330" width="8" height="70" rx="4" fill="#4ade80" />
      <ellipse cx="856" cy="310" rx="22" ry="30" fill="#86efac" />
      <ellipse cx="836" cy="325" rx="18" ry="24" fill="#4ade80" />
      <ellipse cx="876" cy="330" rx="16" ry="22" fill="#86efac" />
      <line x1="856" y1="290" x2="856" y2="330" stroke="#4ade80" strokeWidth="1.5" />
      <line x1="876" y1="318" x2="856" y2="328" stroke="#4ade80" strokeWidth="1.2" />

      {/* ── Bottom row of puzzle pieces ── */}
      <g>
        <rect x="230" y="258" width="110" height="110" rx="4" fill="#3b82f6" />
        <circle cx="340" cy="313" r="14" fill="#3b82f6" />
        <circle cx="285" cy="258" r="13" fill="#dbeafe" />
        <circle cx="285" cy="368" r="14" fill="#3b82f6" />
      </g>
      <g>
        <rect x="340" y="258" width="110" height="110" rx="4" fill="#fbbf24" />
        <circle cx="340" cy="313" r="14" fill="#fbbf24" />
        <circle cx="450" cy="313" r="14" fill="#fbbf24" />
        <circle cx="395" cy="258" r="13" fill="#dbeafe" />
        <circle cx="395" cy="368" r="14" fill="#fbbf24" />
      </g>
      <g>
        <rect x="450" y="258" width="110" height="110" rx="4" fill="#1f2937" />
        <circle cx="450" cy="313" r="14" fill="#1f2937" />
        <circle cx="560" cy="313" r="14" fill="#1f2937" />
        <circle cx="505" cy="258" r="13" fill="#dbeafe" />
        <circle cx="505" cy="368" r="14" fill="#1f2937" />
      </g>
      <g>
        <rect x="560" y="258" width="110" height="110" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="560" cy="313" r="14" fill="#f1f5f9" />
        <circle cx="615" cy="258" r="13" fill="#dbeafe" />
        <circle cx="615" cy="368" r="14" fill="#f1f5f9" />
      </g>

      {/* ── Middle row ── */}
      <g>
        <rect x="285" y="155" width="110" height="110" rx="4" fill="#f97316" />
        <circle cx="340" cy="265" r="13" fill="#f97316" />
        <circle cx="395" cy="210" r="14" fill="#f97316" />
        <circle cx="340" cy="155" r="13" fill="#dbeafe" />
      </g>
      <g>
        <rect x="395" y="155" width="110" height="110" rx="4" fill="#ef4444" />
        <circle cx="395" cy="210" r="14" fill="#ef4444" />
        <circle cx="505" cy="210" r="14" fill="#ef4444" />
        <circle cx="450" cy="265" r="13" fill="#ef4444" />
        <circle cx="450" cy="155" r="13" fill="#dbeafe" />
      </g>
      <g>
        <rect x="565" y="138" width="110" height="110" rx="4" fill="#f9fafb" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="565" cy="193" r="14" fill="#f9fafb" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="620" cy="248" r="14" fill="#f9fafb" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="620" cy="138" r="13" fill="#dbeafe" />
      </g>

      {/* ── Top piece ── */}
      <g>
        <rect x="340" y="75" width="110" height="90" rx="4" fill="#60a5fa" />
        <circle cx="395" cy="165" r="13" fill="#60a5fa" />
        <circle cx="340" cy="120" r="14" fill="#60a5fa" />
      </g>

      {/* ── Person 1 ── */}
      <rect x="118" y="310" width="14" height="60" rx="7" fill="#374151" transform="rotate(-8 125 310)" />
      <rect x="136" y="310" width="14" height="62" rx="7" fill="#374151" transform="rotate(5 143 310)" />
      <ellipse cx="113" cy="370" rx="12" ry="6" fill="#1f2937" />
      <ellipse cx="148" cy="373" rx="12" ry="6" fill="#1f2937" />
      <rect x="108" y="248" width="52" height="68" rx="12" fill="#f97316" />
      <rect x="157" y="220" width="12" height="50" rx="6" fill="#fde68a" transform="rotate(20 163 220)" />
      <rect x="80"  y="268" width="32" height="12" rx="6" fill="#fde68a" transform="rotate(-10 96 274)" />
      <circle cx="134" cy="232" r="24" fill="#fde68a" />
      <ellipse cx="134" cy="215" rx="24" ry="12" fill="#1f2937" />
      <rect x="110" y="215" width="10" height="50" rx="5" fill="#1f2937" />
      <rect x="148" y="215" width="10" height="45" rx="5" fill="#1f2937" />

      {/* ── Person 2 ── */}
      <rect x="228" y="310" width="14" height="65" rx="7" fill="#374151" transform="rotate(-12 235 310)" />
      <rect x="248" y="310" width="14" height="65" rx="7" fill="#6b7280" transform="rotate(12 255 310)" />
      <ellipse cx="219" cy="374" rx="13" ry="6" fill="#1f2937" />
      <ellipse cx="262" cy="376" rx="13" ry="6" fill="#374151" />
      <rect x="218" y="248" width="54" height="68" rx="12" fill="#2563eb" />
      <rect x="188" y="255" width="34" height="12" rx="6" fill="#fde68a" transform="rotate(-15 205 261)" />
      <rect x="268" y="262" width="28" height="11" rx="5" fill="#fde68a" transform="rotate(20 282 267)" />
      <circle cx="245" cy="234" r="24" fill="#fde68a" />
      <ellipse cx="245" cy="250" rx="12" ry="5" fill="#d97706" opacity="0.5" />
      <ellipse cx="245" cy="218" rx="22" ry="10" fill="#374151" />

      {/* ── Person 3 (seated) ── */}
      <rect x="374" y="148" width="12" height="42" rx="6" fill="#374151" transform="rotate(-5 380 148)" />
      <rect x="395" y="148" width="12" height="45" rx="6" fill="#374151" transform="rotate(8 401 148)" />
      <ellipse cx="372" cy="190" rx="10" ry="5" fill="#1f2937" />
      <ellipse cx="409" cy="192" rx="10" ry="5" fill="#1f2937" />
      <rect x="365" y="95" width="50" height="58" rx="12" fill="#3b82f6" />
      <rect x="350" y="118" width="30" height="10" rx="5" fill="#fde68a" transform="rotate(-20 365 123)" />
      <rect x="408" y="118" width="28" height="10" rx="5" fill="#fde68a" transform="rotate(20 422 123)" />
      <rect x="361" y="108" width="58" height="36" rx="4" fill="#1e3a5f" />
      <rect x="364" y="111" width="52" height="30" rx="3" fill="#dbeafe" />
      <rect x="368" y="116" width="32" height="3" rx="1.5" fill="#93c5fd" />
      <rect x="368" y="122" width="24" height="3" rx="1.5" fill="#93c5fd" />
      <rect x="368" y="128" width="28" height="3" rx="1.5" fill="#93c5fd" />
      <rect x="354" y="144" width="72" height="5" rx="2.5" fill="#374151" />
      <circle cx="390" cy="72" r="22" fill="#fde68a" />
      <ellipse cx="390" cy="56" rx="20" ry="10" fill="#374151" />
      <rect x="415" y="30" width="66" height="32" rx="10" fill="white" />
      <polygon points="425,62 432,75 442,62" fill="white" />
      <circle cx="430" cy="46" r="4" fill="#93c5fd" />
      <circle cx="448" cy="46" r="4" fill="#93c5fd" />
      <circle cx="466" cy="46" r="4" fill="#93c5fd" />

      {/* ── Person 4 ── */}
      <rect x="490" y="312" width="14" height="60" rx="7" fill="#374151" />
      <rect x="510" y="312" width="14" height="58" rx="7" fill="#6b7280" transform="rotate(4 517 312)" />
      <ellipse cx="497" cy="372" rx="12" ry="6" fill="#1f2937" />
      <ellipse cx="525" cy="370" rx="12" ry="6" fill="#374151" />
      <rect x="482" y="248" width="52" height="68" rx="12" fill="#60a5fa" />
      <rect x="530" y="195" width="12" height="60" rx="6" fill="#fde68a" transform="rotate(15 536 195)" />
      <rect x="460" y="272" width="26" height="11" rx="5" fill="#fde68a" transform="rotate(-10 473 277)" />
      <circle cx="508" cy="232" r="23" fill="#fde68a" />
      <ellipse cx="508" cy="216" rx="21" ry="9" fill="#374151" />

      {/* ── Person 5 ── */}
      <rect x="638" y="308" width="14" height="64" rx="7" fill="#374151" transform="rotate(-6 645 308)" />
      <rect x="658" y="308" width="14" height="62" rx="7" fill="#374151" transform="rotate(6 665 308)" />
      <ellipse cx="632" cy="372" rx="12" ry="6" fill="#1f2937" />
      <ellipse cx="671" cy="370" rx="12" ry="6" fill="#1f2937" />
      <rect x="628" y="248" width="54" height="66" rx="12" fill="#ef4444" />
      <rect x="594" y="218" width="38" height="12" rx="6" fill="#fde68a" transform="rotate(-25 613 224)" />
      <rect x="680" y="210" width="12" height="45" rx="6" fill="#fde68a" transform="rotate(18 686 210)" />
      <circle cx="655" cy="232" r="23" fill="#fde68a" />
      <ellipse cx="655" cy="216" rx="23" ry="11" fill="#1f2937" />
      <rect x="632" y="215" width="9" height="48" rx="4.5" fill="#1f2937" />
      <rect x="669" y="215" width="9" height="44" rx="4.5" fill="#1f2937" />

      {/* ── Ground shadows ── */}
      <ellipse cx="160"  cy="390" rx="50"  ry="6" fill="#93c5fd" opacity="0.35" />
      <ellipse cx="290"  cy="392" rx="45"  ry="5" fill="#93c5fd" opacity="0.3"  />
      <ellipse cx="450"  cy="385" rx="180" ry="7" fill="#93c5fd" opacity="0.3"  />
      <ellipse cx="655"  cy="390" rx="55"  ry="6" fill="#93c5fd" opacity="0.35" />
    </svg>
  );
}
