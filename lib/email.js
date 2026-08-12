import { Resend } from "resend";
import { formatInCompanyTimezone, COMPANY_TIMEZONE_LABEL } from "./timezone";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Sends the host notification email.
 * status: "checked_in" | "pre_registered"
 */
export async function sendHostNotification({ host, visitor, status }) {
  const headline =
    status === "checked_in"
      ? "Your guest is waiting for you at our company."
      : "Your guest has scheduled a meeting with you at our company.";

  const subject =
    status === "checked_in"
      ? `${visitor.full_name} has arrived`
      : `${visitor.full_name} has pre-registered a visit`;

  const groupCount = visitor.additional_visitor_count || 0;
  const groupHtml =
    groupCount > 0
      ? `<tr><td style="color:#6b7268; padding:6px 0;">Group</td><td>+${groupCount} additional guest${groupCount === 1 ? "" : "s"}${
          visitor.additional_visitor_names ? ` (${visitor.additional_visitor_names})` : ""
        }</td></tr>`
      : "";

  const timeHtml = visitor.selected_time_slot
    ? `<tr><td style="color:#6b7268; padding:6px 0;">Meeting time</td><td>${formatInCompanyTimezone(visitor.selected_time_slot)} (${COMPANY_TIMEZONE_LABEL})</td></tr>`
    : visitor.proposed_alternative_time
    ? `<tr><td style="color:#6b7268; padding:6px 0;">Proposed time</td><td>${formatInCompanyTimezone(visitor.proposed_alternative_time)} (${COMPANY_TIMEZONE_LABEL}) — guest suggested this instead of the offered times, please confirm</td></tr>`
    : "";

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px; margin-bottom:20px;">${headline}</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="color:#6b7268; padding:6px 0; width:140px;">Name</td><td>${visitor.full_name}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Company</td><td>${visitor.company || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Email</td><td>${visitor.email || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Phone</td><td>${visitor.phone || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Purpose</td><td>${visitor.purpose}</td></tr>
        ${groupHtml}
        ${timeHtml}
        <tr><td style="color:#6b7268; padding:6px 0;">Status</td><td>${status === "checked_in" ? "Checked in" : "Pre-registered"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Notes</td><td>${visitor.notes || "—"}</td></tr>
      </table>
    </div>
  `;

  if (!resend) {
    // No API key configured yet — log instead of failing, so local dev
    // and first deploys don't break before the host sets up Resend.
    console.warn("[email] RESEND_API_KEY not set — skipping send. Would have sent:", {
      to: host.email,
      subject,
    });
    return { skipped: true };
  }

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const replyTo = process.env.EMAIL_REPLY_TO;

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to: host.email,
    ...(adminEmail ? { cc: adminEmail } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject,
    html,
  });
}

/**
 * Sends the pre-registration link to the visitor before they arrive.
 */
export async function sendVisitorInviteEmail({ visitor, host, checkinUrl }) {
  const subject = `You're invited — please pre-register for your visit`;
  const timeNote =
    visitor.proposed_time_slots && visitor.proposed_time_slots.length > 0
      ? `<p>You'll be able to pick a preferred meeting time when you complete your details.</p>`
      : "";
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">Hi ${visitor.full_name || "there"},</p>
      <p>You have an upcoming visit with <strong>${host.name}</strong>. Please complete your
      check-in details ahead of time so arrival is quick:</p>
      ${timeNote}
      <p style="margin:24px 0;">
        <a href="${checkinUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">Complete pre-registration</a>
      </p>
      <p style="color:#6b7268; font-size:13px;">
        When you arrive, open this same link (or scan the QR code at reception) to check in.
      </p>
    </div>
  `;

  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send. Would have sent:", {
      to: visitor.email,
      subject,
    });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to: visitor.email,
    ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
    subject,
    html,
  });
}

/**
 * Sends the gate walk-in approval request. Goes to ADMIN_NOTIFICATION_EMAIL
 * and/or HR_NOTIFICATION_EMAIL (whichever are set) with Approve/Deny links
 * that work without any login — the link itself is the credential.
 */
export async function sendGateApprovalRequest({ visitor, approveUrl, denyUrl }) {
  const recipients = [process.env.ADMIN_NOTIFICATION_EMAIL, process.env.HR_NOTIFICATION_EMAIL].filter(Boolean);

  const subject = `Gate approval needed — ${visitor.full_name}`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">A walk-in visitor is waiting at the gate for approval.</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:24px;">
        <tr><td style="color:#6b7268; padding:6px 0; width:140px;">Name</td><td>${visitor.full_name}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Purpose</td><td>${visitor.purpose}</td></tr>
      </table>
      <p>
        <a href="${approveUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600; margin-right:10px;">Approve</a>
        <a href="${denyUrl}" style="background:#b3452f; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">Deny</a>
      </p>
      <p style="color:#6b7268; font-size:13px; margin-top:20px;">
        Once approved, this visitor can proceed to reception to check in.
      </p>
    </div>
  `;

  if (!resend || recipients.length === 0) {
    console.warn("[email] Gate approval email skipped (no Resend key or no recipients configured):", {
      to: recipients,
      subject,
    });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to: recipients,
    subject,
    html,
  });
}
