const pool = require('../db/pool');

async function createNotification(client, { userId, orgId, message, link }) {
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO notifications (user_id, org_id, message, link)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, orgId, message, link]
  );
  return rows[0];
}

async function listUnreadNotifications(client, userId, orgId) {
  const db = client || pool;
  const { rows } = await db.query(
    `SELECT * FROM notifications 
     WHERE user_id = $1 AND org_id = $2 AND is_read = false
     ORDER BY created_at DESC`,
    [userId, orgId]
  );
  return rows;
}

async function markNotificationAsRead(client, notificationId, userId, orgId) {
  const db = client || pool;
  const { rows } = await db.query(
    `UPDATE notifications 
     SET is_read = true 
     WHERE id = $1 AND user_id = $2 AND org_id = $3
     RETURNING *`,
    [notificationId, userId, orgId]
  );
  return rows[0];
}

module.exports = {
  createNotification,
  listUnreadNotifications,
  markNotificationAsRead
};
