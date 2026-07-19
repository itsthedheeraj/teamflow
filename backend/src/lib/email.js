const { Resend } = require('resend');

/**
 * Email client — wraps Resend.
 *
 * Isolated in its own module so:
 *  - The Resend SDK is only instantiated once (singleton).
 *  - If the key is missing, sendInviteEmail returns early without
 *    crashing — invite creation continues unblocked.
 *  - Swapping to a different provider later means changing this
 *    file only, not hunting through service files.
 */

// Resend is instantiated at module load. If the key is missing/blank,
// the instance still exists — Resend will reject requests with a 401,
// which we catch in sendInviteEmail and log without throwing.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'TeamFlow <onboarding@resend.dev>';

/**
 * sendInviteEmail()
 *
 * Sends an invite email to the invited address.
 * NEVER throws — email failure must not block invite creation.
 * Returns true on success, false on any failure.
 *
 * @param {object} params
 * @param {string} params.toEmail       - Recipient email address
 * @param {string} params.inviterName   - Display name of the person who sent the invite
 * @param {string} params.orgName       - Name of the organization
 * @param {string} params.inviteUrl     - Full accept-invite URL with token
 * @param {string} params.role          - Role being granted (member / admin)
 */
async function sendInviteEmail({ toEmail, inviterName, orgName, inviteUrl, role }) {
  // If no API key is configured, skip silently and rely on console log
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_REPLACE_ME') {
    console.log('[email] RESEND_API_KEY not set — skipping email send.');
    return false;
  }

  const roleLabel = role === 'admin' ? 'Admin' : 'Member';

  // Plain-text fallback (shown by email clients that don't render HTML)
  const textBody = [
    `${inviterName} invited you to join ${orgName} on TeamFlow as a ${roleLabel}.`,
    '',
    'Accept your invite here (link expires in 48 hours):',
    inviteUrl,
    '',
    'If you did not expect this invite, you can safely ignore this email.',
  ].join('\n');

  // HTML email — intentionally simple and inline-styled for maximum
  // compatibility across email clients (Gmail, Outlook, Apple Mail).
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <!-- Logo / wordmark -->
              <p style="margin:0 0 28px;font-size:20px;font-weight:700;color:#111827;">TeamFlow</p>

              <!-- Heading -->
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">
                You've been invited to join <span style="color:#2563eb;">${escapeHtml(orgName)}</span>
              </h1>

              <!-- Body copy -->
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                <strong style="color:#374151;">${escapeHtml(inviterName)}</strong> invited you to join
                <strong style="color:#374151;">${escapeHtml(orgName)}</strong> on TeamFlow as a
                <strong style="color:#374151;">${escapeHtml(roleLabel)}</strong>.
                Click the button below to set up your account and start collaborating.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#2563eb;border-radius:8px;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Accept Invite
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <p style="margin:0 0 20px;font-size:13px;color:#9ca3af;">
                This invite link expires in <strong>48 hours</strong>.
                After that, you'll need to request a new invite.
              </p>

              <!-- Plain link fallback -->
              <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;word-break:break-all;">
                If the button doesn't work, copy this link into your browser:<br>
                <a href="${inviteUrl}" style="color:#2563eb;">${inviteUrl}</a>
              </p>

              <!-- Footer -->
              <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #f3f4f6;font-size:12px;color:#d1d5db;">
                If you didn't expect this email, you can safely ignore it.
                You won't be added to any org unless you click Accept.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [toEmail],
      subject: `${inviterName} invited you to join ${orgName} on TeamFlow`,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      // Resend returned an API-level error (e.g. invalid key, rate limit)
      console.error('[email] Resend API error — invite email not sent:', error);
      return false;
    }

    console.log(`[email] Invite email sent to ${toEmail} (Resend id: ${data?.id})`);
    return true;
  } catch (err) {
    // Network error or unexpected exception — must not propagate
    console.error('[email] Failed to send invite email — unexpected error:', err.message);
    return false;
  }
}

/**
 * Minimal HTML escaping for values interpolated into the email body.
 * Prevents org names or inviter names containing < > & from breaking
 * the HTML structure.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendTaskAssignedEmail({ toEmail, taskTitle, projectName, orgName, taskUrl, assignerEmail }) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_REPLACE_ME') {
    console.log('[email] RESEND_API_KEY not set — skipping task assignment email send.');
    return false;
  }

  const textBody = [
    `${assignerEmail} assigned a task to you in ${projectName} (${orgName}).`,
    '',
    `Task: ${taskTitle}`,
    '',
    'View task here:',
    taskUrl,
  ].join('\n');

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
          <tr>
            <td>
              <p style="margin:0 0 28px;font-size:20px;font-weight:700;color:#111827;">TeamFlow</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">
                New task assigned to you
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                <strong style="color:#374151;">${escapeHtml(assignerEmail)}</strong> assigned you a task in
                <strong style="color:#374151;">${escapeHtml(projectName)}</strong>
                (<span style="color:#374151;">${escapeHtml(orgName)}</span>).
              </p>
              <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:24px;">
                <p style="margin:0;font-size:15px;color:#111827;font-weight:500;">
                  ${escapeHtml(taskTitle)}
                </p>
              </div>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#2563eb;border-radius:8px;">
                    <a href="${taskUrl}"
                       style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #f3f4f6;font-size:12px;color:#d1d5db;">
                You are receiving this email because you are a member of ${escapeHtml(orgName)} on TeamFlow.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [toEmail],
      subject: `Task assigned: ${taskTitle}`,
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.error('[email] Resend API error — task email not sent:', error);
      return false;
    }

    console.log(`[email] Task assignment email sent to ${toEmail} (Resend id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[email] Failed to send task email — unexpected error:', err.message);
    return false;
  }
}

module.exports = { sendInviteEmail, sendTaskAssignedEmail };
