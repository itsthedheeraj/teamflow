import { Link, Navigate } from 'react-router-dom';
import { Zap, Users, FolderOpen, TrendingUp, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * LandingPage — public front door.
 *
 * Does NOT use Layout.jsx (that shell is for authenticated users).
 * Has its own minimal nav + footer.
 *
 * Logged-in visitors are immediately redirected to /projects.
 */
export default function LandingPage() {
  const { auth } = useAuth();

  if (auth) return <Navigate to="/projects" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">
              TeamFlow
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 transition-colors"
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
          <span className="inline-block mb-5 px-3 py-1 text-xs font-semibold tracking-wide text-brand-600 bg-brand-50 rounded-full">
            Free to start · No card required
          </span>

          {/* Headline */}
          <h1 className="text-5xl font-bold text-gray-900 leading-[1.15] tracking-tight">
            The team workspace{' '}
            <span className="text-brand-600">that scales with you</span>
          </h1>

          {/* Sub-heading */}
          <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-xl mx-auto">
            TeamFlow gives your whole organization a shared home — invite
            teammates, track projects together, and upgrade your plan only
            when you actually need more room to grow.
          </p>

          {/* CTA row */}
          <div className="mt-9 flex items-center justify-center gap-5 flex-wrap">
            <Link
              to="/signup"
              className="inline-block bg-brand-600 text-white text-sm font-semibold px-7 py-3 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Get started free
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
            >
              Already have a workspace? Sign in →
            </Link>
          </div>
        </section>

        {/* ── Illustration ───────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="rounded-2xl overflow-hidden border border-[#c8dff5]">
            <PuzzleIllustration />
          </div>
        </section>

        {/* ── What you get ───────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-12">
            What you get
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              Icon={Users}
              iconBg="bg-brand-50"
              iconColor="text-brand-600"
              title="Organization accounts"
              description="Your whole team shares one workspace. Assign Owner, Admin, or Member roles so the right people have the right access."
            />
            <FeatureCard
              Icon={FolderOpen}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              title="Shared task tracking"
              description="Create projects, assign tasks, and move work from To Do to Done. Everyone sees the same board, always in sync."
            />
            <FeatureCard
              Icon={TrendingUp}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              title="Plans that fit your team"
              description="Start free with up to 3 teammates. Upgrade to Pro when you need more — limits are enforced automatically."
            />
            <FeatureCard
              Icon={ShieldCheck}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              title="Your data stays yours"
              description="Every organization's data is strictly isolated — no org can ever see another's projects, tasks, or members."
            />
          </div>
        </section>

        {/* ── Bottom CTA band ────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-8 py-14 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Ready to bring your team together?
            </h2>
            <p className="mt-3 text-gray-500 text-base max-w-md mx-auto">
              Set up your workspace in under a minute. Free forever for small
              teams.
            </p>
            <Link
              to="/signup"
              className="inline-block mt-7 bg-brand-600 text-white text-sm font-semibold px-7 py-3 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Create your free workspace
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-brand-600 flex items-center justify-center">
              <Zap size={10} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-gray-900">TeamFlow</span>
          </div>

          <p className="text-xs text-gray-400 text-center">
            © 2026 TeamFlow. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link to="/login"  className="hover:text-gray-700 transition-colors">Sign in</Link>
            <Link to="/signup" className="hover:text-gray-700 transition-colors">Sign up</Link>
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
      <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

/**
 * PuzzleIllustration
 *
 * Original flat-design SVG illustration: five people in dynamic poses
 * collaboratively assembling a stack of colorful puzzle-piece blocks.
 * Inspired by the reference image — recreated as original vector art.
 *
 * Palette:
 *   Sky background : #dbeafe  (brand-100)
 *   Puzzle blue    : #3b82f6  (brand-500)
 *   Puzzle orange  : #f97316
 *   Puzzle yellow  : #fbbf24
 *   Puzzle black   : #1f2937
 *   Puzzle white   : #f9fafb
 *   Puzzle coral   : #ef4444
 *   People skin    : #fde68a / #fbbf24
 *   Shirt blues    : #2563eb, #60a5fa
 *   Shirt coral    : #f97316
 *   Pants          : #374151, #1f2937, #6b7280
 *   Plant greens   : #86efac, #4ade80
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
      {/* Cloud right */}
      <ellipse cx="780" cy="52" rx="28" ry="16" fill="white" />
      <ellipse cx="800" cy="48" rx="22" ry="14" fill="white" />
      <ellipse cx="760" cy="55" rx="20" ry="12" fill="white" />
      {/* Cloud far right small */}
      <ellipse cx="848" cy="72" rx="18" ry="10" fill="white" />
      <ellipse cx="862" cy="68" rx="14" ry="9"  fill="white" />

      {/* ── Left plant ── */}
      <rect x="38" y="330" width="8" height="70" rx="4" fill="#4ade80" />
      <ellipse cx="42" cy="310" rx="22" ry="30" fill="#86efac" />
      <ellipse cx="22" cy="330" rx="16" ry="22" fill="#4ade80" />
      <ellipse cx="62" cy="325" rx="18" ry="24" fill="#86efac" />
      {/* leaf vein */}
      <line x1="42" y1="290" x2="42" y2="330" stroke="#4ade80" strokeWidth="1.5" />
      <line x1="22" y1="318" x2="42" y2="328" stroke="#4ade80" strokeWidth="1.2" />

      {/* ── Right plant ── */}
      <rect x="852" y="330" width="8" height="70" rx="4" fill="#4ade80" />
      <ellipse cx="856" cy="310" rx="22" ry="30" fill="#86efac" />
      <ellipse cx="836" cy="325" rx="18" ry="24" fill="#4ade80" />
      <ellipse cx="876" cy="330" rx="16" ry="22" fill="#86efac" />
      <line x1="856" y1="290" x2="856" y2="330" stroke="#4ade80" strokeWidth="1.5" />
      <line x1="876" y1="318" x2="856" y2="328" stroke="#4ade80" strokeWidth="1.2" />

      {/* ══════════════════════════════════════════
          PUZZLE BLOCKS  (viewBox origin: bottom row y=260, top row y=160)
          Each piece is a rect with a notch-bump/socket drawn in path form.
          Simplified: rectangles + half-circles for connectors.
      ══════════════════════════════════════════ */}

      {/* ── Bottom row of puzzle pieces ── */}

      {/* Piece B1 — blue (bottom-left) */}
      <g>
        <rect x="230" y="258" width="110" height="110" rx="4" fill="#3b82f6" />
        {/* right tab out */}
        <circle cx="340" cy="313" r="14" fill="#3b82f6" />
        {/* top socket in */}
        <circle cx="285" cy="258" r="13" fill="#dbeafe" />
        {/* bottom tab out */}
        <circle cx="285" cy="368" r="14" fill="#3b82f6" />
      </g>

      {/* Piece B2 — yellow/gold (bottom-center-left) */}
      <g>
        <rect x="340" y="258" width="110" height="110" rx="4" fill="#fbbf24" />
        {/* left socket */}
        <circle cx="340" cy="313" r="14" fill="#fbbf24" />
        {/* right tab */}
        <circle cx="450" cy="313" r="14" fill="#fbbf24" />
        {/* top socket */}
        <circle cx="395" cy="258" r="13" fill="#dbeafe" />
        {/* bottom tab */}
        <circle cx="395" cy="368" r="14" fill="#fbbf24" />
      </g>

      {/* Piece B3 — black (bottom-center-right) */}
      <g>
        <rect x="450" y="258" width="110" height="110" rx="4" fill="#1f2937" />
        {/* left socket */}
        <circle cx="450" cy="313" r="14" fill="#1f2937" />
        {/* right tab */}
        <circle cx="560" cy="313" r="14" fill="#1f2937" />
        {/* top socket */}
        <circle cx="505" cy="258" r="13" fill="#dbeafe" />
        {/* bottom tab */}
        <circle cx="505" cy="368" r="14" fill="#1f2937" />
      </g>

      {/* Piece B4 — white/light (bottom-right) */}
      <g>
        <rect x="560" y="258" width="110" height="110" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
        {/* left socket */}
        <circle cx="560" cy="313" r="14" fill="#f1f5f9" />
        {/* top socket */}
        <circle cx="615" cy="258" r="13" fill="#dbeafe" />
        {/* bottom tab */}
        <circle cx="615" cy="368" r="14" fill="#f1f5f9" />
      </g>

      {/* ── Middle row ── */}

      {/* Piece M1 — orange (mid-left) */}
      <g>
        <rect x="285" y="155" width="110" height="110" rx="4" fill="#f97316" />
        {/* bottom tab covers socket */}
        <circle cx="340" cy="265" r="13" fill="#f97316" />
        {/* right tab */}
        <circle cx="395" cy="210" r="14" fill="#f97316" />
        {/* top socket */}
        <circle cx="340" cy="155" r="13" fill="#dbeafe" />
      </g>

      {/* Piece M2 — coral/red (mid-center) */}
      <g>
        <rect x="395" y="155" width="110" height="110" rx="4" fill="#ef4444" />
        {/* left socket */}
        <circle cx="395" cy="210" r="14" fill="#ef4444" />
        {/* right tab */}
        <circle cx="505" cy="210" r="14" fill="#ef4444" />
        {/* bottom tab */}
        <circle cx="450" cy="265" r="13" fill="#ef4444" />
        {/* top socket */}
        <circle cx="450" cy="155" r="13" fill="#dbeafe" />
      </g>

      {/* Piece M3 — white large (mid-right, being held up) */}
      <g>
        <rect x="565" y="138" width="110" height="110" rx="4" fill="#f9fafb" stroke="#e2e8f0" strokeWidth="1.5" />
        {/* left tab */}
        <circle cx="565" cy="193" r="14" fill="#f9fafb" stroke="#e2e8f0" strokeWidth="1.5" />
        {/* bottom tab */}
        <circle cx="620" cy="248" r="14" fill="#f9fafb" stroke="#e2e8f0" strokeWidth="1.5" />
        {/* top socket */}
        <circle cx="620" cy="138" r="13" fill="#dbeafe" />
      </g>

      {/* ── Top piece (blue-grey, person sitting on it) ── */}
      <g>
        <rect x="340" y="75" width="110" height="90" rx="4" fill="#60a5fa" />
        {/* bottom tab */}
        <circle cx="395" cy="165" r="13" fill="#60a5fa" />
        {/* left tab */}
        <circle cx="340" cy="120" r="14" fill="#60a5fa" />
      </g>

      {/* ══════════════════════════════════════════
          PEOPLE
      ══════════════════════════════════════════ */}

      {/* ── Person 1 — woman left, arms raised, yellow outfit ── */}
      {/* legs */}
      <rect x="118" y="310" width="14" height="60" rx="7" fill="#374151" transform="rotate(-8 125 310)" />
      <rect x="136" y="310" width="14" height="62" rx="7" fill="#374151" transform="rotate(5 143 310)" />
      {/* shoes */}
      <ellipse cx="113" cy="370" rx="12" ry="6" fill="#1f2937" />
      <ellipse cx="148" cy="373" rx="12" ry="6" fill="#1f2937" />
      {/* body — coral top */}
      <rect x="108" y="248" width="52" height="68" rx="12" fill="#f97316" />
      {/* right arm up */}
      <rect x="157" y="220" width="12" height="50" rx="6" fill="#fde68a" transform="rotate(20 163 220)" />
      {/* left arm out */}
      <rect x="80"  y="268" width="32" height="12" rx="6" fill="#fde68a" transform="rotate(-10 96 274)" />
      {/* head */}
      <circle cx="134" cy="232" r="24" fill="#fde68a" />
      {/* hair — long dark */}
      <ellipse cx="134" cy="215" rx="24" ry="12" fill="#1f2937" />
      <rect x="110" y="215" width="10" height="50" rx="5" fill="#1f2937" />
      <rect x="148" y="215" width="10" height="45" rx="5" fill="#1f2937" />

      {/* ── Person 2 — man center-left, walking, blue shirt ── */}
      {/* legs — stride pose */}
      <rect x="228" y="310" width="14" height="65" rx="7" fill="#374151" transform="rotate(-12 235 310)" />
      <rect x="248" y="310" width="14" height="65" rx="7" fill="#6b7280" transform="rotate(12 255 310)" />
      {/* shoes */}
      <ellipse cx="219" cy="374" rx="13" ry="6" fill="#1f2937" />
      <ellipse cx="262" cy="376" rx="13" ry="6" fill="#374151" />
      {/* body — blue */}
      <rect x="218" y="248" width="54" height="68" rx="12" fill="#2563eb" />
      {/* left arm forward carrying piece */}
      <rect x="188" y="255" width="34" height="12" rx="6" fill="#fde68a" transform="rotate(-15 205 261)" />
      {/* right arm back */}
      <rect x="268" y="262" width="28" height="11" rx="5" fill="#fde68a" transform="rotate(20 282 267)" />
      {/* head */}
      <circle cx="245" cy="234" r="24" fill="#fde68a" />
      {/* beard stubble */}
      <ellipse cx="245" cy="250" rx="12" ry="5" fill="#d97706" opacity="0.5" />
      {/* hair */}
      <ellipse cx="245" cy="218" rx="22" ry="10" fill="#374151" />

      {/* ── Person 3 — seated on top puzzle, laptop, speech bubble ── */}
      {/* legs dangling */}
      <rect x="374" y="148" width="12" height="42" rx="6" fill="#374151" transform="rotate(-5 380 148)" />
      <rect x="395" y="148" width="12" height="45" rx="6" fill="#374151" transform="rotate(8 401 148)" />
      {/* shoes */}
      <ellipse cx="372" cy="190" rx="10" ry="5" fill="#1f2937" />
      <ellipse cx="409" cy="192" rx="10" ry="5" fill="#1f2937" />
      {/* body — blue */}
      <rect x="365" y="95" width="50" height="58" rx="12" fill="#3b82f6" />
      {/* arms holding laptop */}
      <rect x="350" y="118" width="30" height="10" rx="5" fill="#fde68a" transform="rotate(-20 365 123)" />
      <rect x="408" y="118" width="28" height="10" rx="5" fill="#fde68a" transform="rotate(20 422 123)" />
      {/* laptop */}
      <rect x="361" y="108" width="58" height="36" rx="4" fill="#1e3a5f" />
      <rect x="364" y="111" width="52" height="30" rx="3" fill="#dbeafe" />
      {/* screen lines */}
      <rect x="368" y="116" width="32" height="3" rx="1.5" fill="#93c5fd" />
      <rect x="368" y="122" width="24" height="3" rx="1.5" fill="#93c5fd" />
      <rect x="368" y="128" width="28" height="3" rx="1.5" fill="#93c5fd" />
      {/* laptop base */}
      <rect x="354" y="144" width="72" height="5" rx="2.5" fill="#374151" />
      {/* head */}
      <circle cx="390" cy="72" r="22" fill="#fde68a" />
      {/* hair */}
      <ellipse cx="390" cy="56" rx="20" ry="10" fill="#374151" />
      {/* speech bubble */}
      <rect x="415" y="30" width="66" height="32" rx="10" fill="white" />
      <polygon points="425,62 432,75 442,62" fill="white" />
      {/* dots in bubble */}
      <circle cx="430" cy="46" r="4" fill="#93c5fd" />
      <circle cx="448" cy="46" r="4" fill="#93c5fd" />
      <circle cx="466" cy="46" r="4" fill="#93c5fd" />

      {/* ── Person 4 — standing center-right, reaching up ── */}
      {/* legs */}
      <rect x="490" y="312" width="14" height="60" rx="7" fill="#374151" />
      <rect x="510" y="312" width="14" height="58" rx="7" fill="#6b7280" transform="rotate(4 517 312)" />
      {/* shoes */}
      <ellipse cx="497" cy="372" rx="12" ry="6" fill="#1f2937" />
      <ellipse cx="525" cy="370" rx="12" ry="6" fill="#374151" />
      {/* body — blue */}
      <rect x="482" y="248" width="52" height="68" rx="12" fill="#60a5fa" />
      {/* right arm up reaching */}
      <rect x="530" y="195" width="12" height="60" rx="6" fill="#fde68a" transform="rotate(15 536 195)" />
      {/* left arm down */}
      <rect x="460" y="272" width="26" height="11" rx="5" fill="#fde68a" transform="rotate(-10 473 277)" />
      {/* head */}
      <circle cx="508" cy="232" r="23" fill="#fde68a" />
      {/* hair short */}
      <ellipse cx="508" cy="216" rx="21" ry="9" fill="#374151" />

      {/* ── Person 5 — woman right, holding large white piece ── */}
      {/* legs */}
      <rect x="638" y="308" width="14" height="64" rx="7" fill="#374151" transform="rotate(-6 645 308)" />
      <rect x="658" y="308" width="14" height="62" rx="7" fill="#374151" transform="rotate(6 665 308)" />
      {/* shoes */}
      <ellipse cx="632" cy="372" rx="12" ry="6" fill="#1f2937" />
      <ellipse cx="671" cy="370" rx="12" ry="6" fill="#1f2937" />
      {/* body — coral */}
      <rect x="628" y="248" width="54" height="66" rx="12" fill="#ef4444" />
      {/* left arm holding piece */}
      <rect x="594" y="218" width="38" height="12" rx="6" fill="#fde68a" transform="rotate(-25 613 224)" />
      {/* right arm up */}
      <rect x="680" y="210" width="12" height="45" rx="6" fill="#fde68a" transform="rotate(18 686 210)" />
      {/* head */}
      <circle cx="655" cy="232" r="23" fill="#fde68a" />
      {/* hair — long dark */}
      <ellipse cx="655" cy="216" rx="23" ry="11" fill="#1f2937" />
      <rect x="632" y="215" width="9" height="48" rx="4.5" fill="#1f2937" />
      <rect x="669" y="215" width="9" height="44" rx="4.5" fill="#1f2937" />

      {/* ── Ground shadow lines ── */}
      <ellipse cx="160"  cy="390" rx="50"  ry="6" fill="#93c5fd" opacity="0.35" />
      <ellipse cx="290"  cy="392" rx="45"  ry="5" fill="#93c5fd" opacity="0.3"  />
      <ellipse cx="450"  cy="385" rx="180" ry="7" fill="#93c5fd" opacity="0.3"  />
      <ellipse cx="655"  cy="390" rx="55"  ry="6" fill="#93c5fd" opacity="0.35" />
    </svg>
  );
}
