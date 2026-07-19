/**
 * RBAC + Invite Flow integration tests.
 *
 * Tests:
 *  1. Members cannot access admin-only endpoints
 *  2. Admins can invite, owners can change roles
 *  3. Invite token flow: create → accept → member appears in list
 *  4. Cannot remove last owner
 *  5. Revoked invites cannot be accepted
 */
require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

let ownerToken, adminToken, memberToken;
let orgId, ownerId, adminId, memberId;
let pendingInviteId;

beforeAll(async () => {
  // Create owner user
  const ownerRes = await request(app)
    .post('/api/auth/signup')
    .send({
      email: `rbac-owner-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Owner',
    });
  ownerId = ownerRes.body.user.id;
  
  // Create org for owner
  const orgRes = await request(app)
    .post('/api/auth/me/orgs')
    .set('Authorization', `Bearer ${ownerRes.body.token}`)
    .send({ orgName: 'RBAC Test Org' });
    
  ownerToken = orgRes.body.token;
  orgId = orgRes.body.org.id;

  // Create a second user and add them as admin directly in DB
  const adminRes = await request(app)
    .post('/api/auth/signup')
    .send({
      email: `rbac-admin-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Admin User',
    });
  adminId = adminRes.body.user.id;

  await pool.query(
    `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'admin')
     ON CONFLICT DO NOTHING`,
    [orgId, adminId]
  );
  // Get a token for admin scoped to our test org
  const adminLoginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: adminRes.body.user.email,
      password: 'password123',
    });
  // Switch to our test org
  const adminSwitchRes = await request(app)
    .post('/api/auth/switch-org')
    .set('Authorization', `Bearer ${adminLoginRes.body.token}`)
    .send({ orgId });
  adminToken = adminSwitchRes.body.token;

  // Create a member
  const memberRes = await request(app)
    .post('/api/auth/signup')
    .send({
      email: `rbac-member-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Member User',
    });
  memberId = memberRes.body.user.id;

  await pool.query(
    `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT DO NOTHING`,
    [orgId, memberId]
  );
  const memberLoginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: memberRes.body.user.email,
      password: 'password123',
    });
  const memberSwitchRes = await request(app)
    .post('/api/auth/switch-org')
    .set('Authorization', `Bearer ${memberLoginRes.body.token}`)
    .send({ orgId });
  memberToken = memberSwitchRes.body.token;
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE email LIKE 'rbac-%'`);
  await pool.end();
});

// ─────────────────────────────────────────────
// Role enforcement
// ─────────────────────────────────────────────
describe('requireRole enforcement', () => {
  it('allows members to list team members (no role restriction)', async () => {
    const res = await request(app)
      .get('/api/team/members')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.members)).toBe(true);
  });

  it('blocks members from sending invites (requires admin)', async () => {
    const res = await request(app)
      .post('/api/team/invite')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: 'anyone@example.com', role: 'member' });
    expect(res.status).toBe(403);
  });

  it('allows admins to send invites', async () => {
    const res = await request(app)
      .post('/api/team/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `rbac-invitee-${Date.now()}@example.com`, role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.inviteUrl).toBeTruthy();
  });

  it('blocks admins from changing roles (owner only)', async () => {
    const res = await request(app)
      .patch(`/api/team/members/${memberId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('allows owner to change a member role', async () => {
    const res = await request(app)
      .patch(`/api/team/members/${memberId}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('admin');
    // restore
    await request(app)
      .patch(`/api/team/members/${memberId}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
  });
});

// ─────────────────────────────────────────────
// Invite flow
// ─────────────────────────────────────────────
describe('Invite token flow', () => {
  const inviteeEmail = `rbac-full-invite-${Date.now()}@example.com`;
  let inviteToken;

  it('creates an invite and returns an invite URL', async () => {
    const res = await request(app)
      .post('/api/team/invite')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: inviteeEmail, role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body.inviteUrl).toContain('accept-invite');

    // Extract token from URL
    inviteToken = new URL(res.body.inviteUrl).searchParams.get('token');
    expect(inviteToken).toBeTruthy();
  });

  it('accepts the invite and creates a new user in the org', async () => {
    const res = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'newpassword123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.role).toBe('member');
  });

  it('cannot accept the same invite twice', async () => {
    const res = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'newpassword123' });
    expect(res.status).toBe(409);
  });

  it('invitee now appears in the org member list', async () => {
    const res = await request(app)
      .get('/api/team/members')
      .set('Authorization', `Bearer ${ownerToken}`);
    const emails = res.body.members.map((m) => m.email);
    expect(emails).toContain(inviteeEmail);
  });
});

// ─────────────────────────────────────────────
// Safety guards
// ─────────────────────────────────────────────
describe('Owner safety guards', () => {
  it('cannot remove the last owner', async () => {
    const res = await request(app)
      .delete(`/api/team/members/${ownerId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    // Can't remove yourself
    expect(res.status).toBe(400);
  });

  it('cannot demote the last owner', async () => {
    const res = await request(app)
      .patch(`/api/team/members/${ownerId}/role`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'member' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// Revoked invite
// ─────────────────────────────────────────────
describe('Revoked invites', () => {
  let revokeToken;

  it('creates and then revokes an invite', async () => {
    const createRes = await request(app)
      .post('/api/team/invite')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `rbac-revoke-${Date.now()}@example.com`, role: 'member' });

    revokeToken = new URL(createRes.body.inviteUrl).searchParams.get('token');

    // Get invite ID from list
    const listRes = await request(app)
      .get('/api/team/invites')
      .set('Authorization', `Bearer ${ownerToken}`);

    const invite = listRes.body.invites.find((i) => i.accepted_at === null);
    expect(invite).toBeTruthy();

    const revokeRes = await request(app)
      .delete(`/api/team/invites/${invite.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revokeRes.status).toBe(200);
  });

  it('revoked invite cannot be accepted', async () => {
    const res = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: revokeToken, password: 'password123' });
    // Token was deleted from DB → 404
    expect(res.status).toBe(404);
  });
});
