/**
 * Seed Script — TeamFlow Demo Data
 *
 * Creates three organisations with realistic demo data so the app
 * never looks empty when you open it for the first time.
 *
 * Org layout:
 *
 *  1. "Acme Corp"   — FREE tier, near limits (2/3 members, 18/20 tasks)
 *     Shows the usage bar approaching the limit and the "Upgrade" nudge.
 *     Login: alice@acme.example  / password: Seedpass1!
 *            bob@acme.example    / password: Seedpass1!
 *
 *  2. "Beta Labs"   — PRO tier, healthy usage (4 members, 35 tasks)
 *     Demonstrates what Pro looks like — no usage warnings.
 *     Login: carol@beta.example  / password: Seedpass1!
 *            dave@beta.example   / password: Seedpass1!
 *            eve@beta.example    / password: Seedpass1!
 *            frank@beta.example  / password: Seedpass1!
 *
 *  3. "Solo Studio" — FREE tier, light usage (1 member, 3 tasks)
 *     Demonstrates a single-person workspace with room to grow.
 *     Login: grace@solo.example  / password: Seedpass1!
 *
 * Run:
 *   cd backend && npm run db:seed
 *
 * The script is idempotent — re-running it skips orgs/users whose
 * email or slug already exists (ON CONFLICT DO NOTHING), so you can
 * safely run it multiple times without duplicating data.
 *
 * NOTE: The seed script connects as DATABASE_SUPERUSER_URL because it
 * needs to bypass RLS (it inserts rows into org-scoped tables directly
 * without going through the normal request pipeline). This is correct
 * and intentional — seed scripts are an admin-level operation, not a
 * user request. The application server still uses app_user (non-superuser)
 * for all normal requests.
 */
require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { syncMemberCount, syncTaskCount } = require('../services/meteringService');

const SEED_PASSWORD = 'Seedpass1!';
const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────
// Seed data definition
// ─────────────────────────────────────────────
const ORGS = [
  {
    name: 'Acme Corp',
    slug: 'acme-corp-demo',
    tier: 'free',
    users: [
      { email: 'alice@acme.example', role: 'owner' },
      { email: 'bob@acme.example',   role: 'member' },
    ],
    projects: [
      {
        name: 'Website Redesign',
        description: 'Overhaul the marketing site for Q4 launch.',
        tasks: [
          { title: 'Audit existing pages',         status: 'done',        assignIdx: 0 },
          { title: 'Create new wireframes',         status: 'done',        assignIdx: 1 },
          { title: 'Design component library',      status: 'in_progress', assignIdx: 0 },
          { title: 'Build homepage',               status: 'in_progress', assignIdx: 1 },
          { title: 'Build pricing page',           status: 'todo',        assignIdx: 0 },
          { title: 'Write hero copy',              status: 'todo',        assignIdx: 1 },
          { title: 'SEO meta tags',                status: 'todo',        assignIdx: 0 },
          { title: 'Accessibility audit',          status: 'todo',        assignIdx: 1 },
          { title: 'Performance review',           status: 'todo',        assignIdx: 0 },
          { title: 'Cross-browser testing',        status: 'todo',        assignIdx: 1 },
        ],
      },
      {
        name: 'Q4 Marketing Campaign',
        description: 'Product Hunt launch + email drip sequence.',
        tasks: [
          { title: 'Draft Product Hunt listing',   status: 'done',        assignIdx: 0 },
          { title: 'Record demo video',            status: 'in_progress', assignIdx: 1 },
          { title: 'Write email sequence (5 emails)', status: 'todo',     assignIdx: 0 },
          { title: 'Set up drip automation',       status: 'todo',        assignIdx: 1 },
          { title: 'Create social graphics',       status: 'todo',        assignIdx: 0 },
          { title: 'Schedule launch tweets',       status: 'todo',        assignIdx: 1 },
          { title: 'Brief press contacts',         status: 'todo',        assignIdx: 0 },
          { title: 'Prepare FAQ doc',              status: 'todo',        assignIdx: 1 },
        ],
      },
    ],
    // Total tasks = 10 + 8 = 18 out of 20 limit — near the edge
  },

  {
    name: 'Beta Labs',
    slug: 'beta-labs-demo',
    tier: 'pro',
    users: [
      { email: 'carol@beta.example', role: 'owner' },
      { email: 'dave@beta.example',  role: 'admin' },
      { email: 'eve@beta.example',   role: 'member' },
      { email: 'frank@beta.example', role: 'member' },
    ],
    projects: [
      {
        name: 'TeamFlow Integration',
        description: 'Integrate TeamFlow API into our internal tooling.',
        tasks: [
          { title: 'Read API docs',                status: 'done',        assignIdx: 0 },
          { title: 'Auth handshake prototype',     status: 'done',        assignIdx: 1 },
          { title: 'Org switcher component',       status: 'done',        assignIdx: 2 },
          { title: 'Task sync service',            status: 'in_progress', assignIdx: 1 },
          { title: 'Webhook receiver',             status: 'in_progress', assignIdx: 3 },
          { title: 'Error handling + retries',     status: 'todo',        assignIdx: 1 },
          { title: 'Rate limit handling',          status: 'todo',        assignIdx: 2 },
          { title: 'Write integration tests',      status: 'todo',        assignIdx: 0 },
          { title: 'Load test with 50 orgs',       status: 'todo',        assignIdx: 3 },
          { title: 'Security review',              status: 'todo',        assignIdx: 0 },
        ],
      },
      {
        name: 'Platform Hardening',
        description: 'Reliability and observability improvements.',
        tasks: [
          { title: 'Add structured logging',       status: 'done',        assignIdx: 2 },
          { title: 'Set up Sentry',                status: 'done',        assignIdx: 3 },
          { title: 'Add health-check endpoints',   status: 'done',        assignIdx: 1 },
          { title: 'Configure alerting rules',     status: 'in_progress', assignIdx: 2 },
          { title: 'Database connection pooling',  status: 'in_progress', assignIdx: 0 },
          { title: 'Redis failover setup',         status: 'todo',        assignIdx: 1 },
          { title: 'Backup restore drill',         status: 'todo',        assignIdx: 3 },
          { title: 'Dependency audit',             status: 'todo',        assignIdx: 0 },
          { title: 'Docker compose update',        status: 'todo',        assignIdx: 2 },
          { title: 'CI/CD pipeline review',        status: 'todo',        assignIdx: 1 },
        ],
      },
      {
        name: 'Customer Success Sprint',
        description: 'Reduce churn by improving onboarding.',
        tasks: [
          { title: 'User interview synthesis',     status: 'done',        assignIdx: 0 },
          { title: 'Map onboarding funnel',        status: 'done',        assignIdx: 3 },
          { title: 'Redesign welcome email',       status: 'in_progress', assignIdx: 2 },
          { title: 'Add in-app tooltips',          status: 'in_progress', assignIdx: 1 },
          { title: 'Empty state illustrations',    status: 'todo',        assignIdx: 2 },
          { title: 'Checklist widget',             status: 'todo',        assignIdx: 3 },
          { title: 'Video walkthrough (2 min)',    status: 'todo',        assignIdx: 0 },
          { title: 'NPS survey implementation',   status: 'todo',        assignIdx: 1 },
          { title: 'Cohort retention analysis',   status: 'todo',        assignIdx: 3 },
          { title: 'A/B test onboarding copy',    status: 'todo',        assignIdx: 2 },
          { title: 'Segment event tracking',      status: 'todo',        assignIdx: 0 },
          { title: 'Help docs update',            status: 'todo',        assignIdx: 1 },
          { title: 'Intercom knowledge base sync', status: 'todo',       assignIdx: 3 },
          { title: 'Demo account refresh',        status: 'todo',        assignIdx: 2 },
          { title: 'Churn post-mortem report',    status: 'todo',        assignIdx: 0 },
        ],
      },
    ],
    // Total tasks = 10 + 10 + 15 = 35 — Pro plan, no limits
  },

  {
    name: 'Solo Studio',
    slug: 'solo-studio-demo',
    tier: 'free',
    users: [
      { email: 'grace@solo.example', role: 'owner' },
    ],
    projects: [
      {
        name: 'Portfolio Site v2',
        description: 'Personal portfolio refresh.',
        tasks: [
          { title: 'Sketch new layout',           status: 'done',        assignIdx: 0 },
          { title: 'Pick colour palette',         status: 'in_progress', assignIdx: 0 },
          { title: 'Build with Astro',            status: 'todo',        assignIdx: 0 },
        ],
      },
    ],
    // Total tasks = 3 — light usage, plenty of room
  },
];

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function seed() {
  // The seed script uses the SUPERUSER connection so it can bypass RLS
  // and insert rows directly into org-scoped tables. The app server
  // itself never uses this connection string.
  const superUrl = process.env.DATABASE_SUPERUSER_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: superUrl });
  await client.connect();
  console.log('Connected for seeding (superuser).');

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
  let totalOrgs = 0, totalUsers = 0, totalProjects = 0, totalTasks = 0;

  for (const orgDef of ORGS) {
    console.log(`\nSeeding org: ${orgDef.name}`);

    // ── 1. Organisation ──────────────────────────────────────────────
    const { rows: [org] } = await client.query(
      `INSERT INTO organizations (name, slug, subscription_tier)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             subscription_tier = EXCLUDED.subscription_tier
       RETURNING id`,
      [orgDef.name, orgDef.slug, orgDef.tier]
    );
    const orgId = org.id;
    totalOrgs++;
    console.log(`  Org id: ${orgId}`);

    // ── 2. Users ─────────────────────────────────────────────────────
    const userIds = [];
    for (const userDef of orgDef.users) {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        [userDef.email, passwordHash]
      );
      const userId = user.id;
      userIds.push(userId);

      await client.query(
        `INSERT INTO org_members (org_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [orgId, userId, userDef.role]
      );
      console.log(`  User: ${userDef.email} (${userDef.role})`);
      totalUsers++;
    }

    // ── 3. Projects + Tasks ──────────────────────────────────────────
    for (const projDef of orgDef.projects) {
      const { rows: [project] } = await client.query(
        `INSERT INTO projects (org_id, name, description, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [orgId, projDef.name, projDef.description || null, userIds[0]]
      );

      // ON CONFLICT DO NOTHING returns no row if it skipped — re-fetch
      let projectId;
      if (project) {
        projectId = project.id;
        totalProjects++;
      } else {
        const { rows: [existing] } = await client.query(
          `SELECT id FROM projects WHERE org_id = $1 AND name = $2`,
          [orgId, projDef.name]
        );
        projectId = existing.id;
      }
      console.log(`  Project: ${projDef.name}`);

      for (const taskDef of projDef.tasks) {
        const assignedTo = userIds[taskDef.assignIdx % userIds.length];
        await client.query(
          `INSERT INTO tasks
             (org_id, project_id, title, status, assigned_to, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [orgId, projectId, taskDef.title, taskDef.status, assignedTo, userIds[0]]
        );
        totalTasks++;
      }
      console.log(`    ${projDef.tasks.length} tasks seeded`);
    }

    // ── 4. Sync Redis counters from DB ───────────────────────────────
    // Pass the superuser `client` explicitly so syncTaskCount and
    // syncMemberCount bypass RLS. Without it they would use the app
    // pool (app_user connection), which has RLS active but no
    // app.current_org_id set → COUNT(*) returns 0 silently.
    try {
      await syncMemberCount(orgId, client);
      await syncTaskCount(orgId, client);
      console.log(`  Redis counters synced for ${orgDef.name}`);
    } catch (redisErr) {
      // Redis may not be running during CI — non-fatal
      console.warn(`  Warning: Redis sync skipped (${redisErr.message})`);
    }
  }

  await client.end();

  console.log(`
╔═══════════════════════════════════════════════╗
║              Seed complete                    ║
╠═══════════════════════════════════════════════╣
║  Orgs:     ${String(totalOrgs).padEnd(35)}║
║  Users:    ${String(totalUsers).padEnd(35)}║
║  Projects: ${String(totalProjects).padEnd(35)}║
║  Tasks:    ${String(totalTasks).padEnd(35)}║
╠═══════════════════════════════════════════════╣
║  Demo logins (all password: Seedpass1!)       ║
║                                               ║
║  Free / near-limits org (Acme Corp):          ║
║    alice@acme.example  — Owner                ║
║    bob@acme.example    — Member               ║
║                                               ║
║  Pro org (Beta Labs):                         ║
║    carol@beta.example  — Owner                ║
║    dave@beta.example   — Admin                ║
║    eve@beta.example    — Member               ║
║    frank@beta.example  — Member               ║
║                                               ║
║  Free / light usage (Solo Studio):            ║
║    grace@solo.example  — Owner                ║
╚═══════════════════════════════════════════════╝
`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
