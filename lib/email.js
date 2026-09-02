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
        When you arrive, open this same link to check in.
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
export async function sendGateApprovalRequest({ visitor, approveUrl, denyUrl, recipients, facilityLabel }) {
  const to =
    recipients && recipients.length > 0
      ? recipients
      : [process.env.ADMIN_NOTIFICATION_EMAIL, process.env.HR_NOTIFICATION_EMAIL].filter(Boolean);

  const subject = `Gate approval needed — ${visitor.full_name}${facilityLabel ? ` (${facilityLabel})` : ""}`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">A walk-in visitor is waiting at the gate for approval${facilityLabel ? ` at ${facilityLabel}` : ""}.</p>
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

  if (!resend || to.length === 0) {
    console.warn("[email] Gate approval email skipped (no Resend key or no recipients configured):", {
      to,
      subject,
    });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}

/**
 * Sends the vehicle request approval email to the transport coordinators
 * (TRANSPORT_COORDINATOR_EMAIL_1 / TRANSPORT_COORDINATOR_EMAIL_2). Same
 * no-login, token-in-link pattern as sendGateApprovalRequest.
 */
export async function sendVehicleRequestApprovalEmail({ request, approveUrl, rejectUrl, facilityLabel }) {
  const to = [process.env.TRANSPORT_COORDINATOR_EMAIL_1, process.env.TRANSPORT_COORDINATOR_EMAIL_2].filter(Boolean);

  const requesterName = request.is_external ? request.customer_name : request.employee_name;
  const subject = `Vehicle request — ${requesterName}${facilityLabel ? ` (${facilityLabel})` : ""}${request.is_external ? " (external)" : ""}`;
  const vehicleRow = request.is_external
    ? `<tr><td style="color:#6b7268; padding:6px 0; width:140px;">Vehicle</td><td>External — not from our fleet</td></tr>`
    : `<tr><td style="color:#6b7268; padding:6px 0; width:140px;">Vehicle</td><td>${request.vehicle}</td></tr>`;
  const estimatedTimeRow = request.is_external
    ? ""
    : request.needed_from
    ? `<tr><td style="color:#6b7268; padding:6px 0;">Needed</td><td>${formatInCompanyTimezone(request.needed_from)} → ${formatInCompanyTimezone(request.needed_until)}</td></tr>`
    : `<tr><td style="color:#6b7268; padding:6px 0;">Estimated time</td><td>${request.estimated_time || "—"}</td></tr>`;

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">${requesterName} has requested ${request.is_external ? "an external " : "a company "}vehicle${facilityLabel ? ` at ${facilityLabel}` : ""}.</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:24px;">
        ${vehicleRow}
        <tr><td style="color:#6b7268; padding:6px 0;">Destination</td><td>${request.destination}</td></tr>
        ${estimatedTimeRow}
      </table>
      <p>
        <a href="${approveUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600; margin-right:10px;">Approve</a>
        <a href="${rejectUrl}" style="background:#b3452f; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">Reject</a>
      </p>
    </div>
  `;

  if (!resend || to.length === 0) {
    console.warn("[email] Vehicle request email skipped (no Resend key or no recipients configured):", {
      to,
      subject,
    });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}

/**
 * Notifies a contractor their pass has been activated — they previously had
 * no way to know this happened except by re-checking their pass link
 * themselves.
 */
export async function sendContractorPassActivatedEmail({ contractor, passUrl }) {
  if (!contractor.email) return { skipped: true };

  const subject = "Your site pass is now active";
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">Hi ${contractor.full_name},</p>
      <p>Your site pass has been activated and is ready to use.</p>
      <p style="margin:24px 0;">
        <a href="${passUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">View my pass</a>
      </p>
      <p style="color:#6b7268; font-size:13px;">
        Show this link at the gate if asked to verify your access.
      </p>
    </div>
  `;

  if (!resend) {
    console.warn("[email] Contractor activation email skipped (no Resend key):", { to: contractor.email });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to: contractor.email,
    subject,
    html,
  });
}

/**
 * Re-sends a contractor's pass link — used by /find-pass when they've lost
 * it. Separate from sendContractorPassActivatedEmail, which is only sent
 * once, automatically, when a pass first goes active.
 */
export async function sendContractorPassLinkEmail({ contractor, passUrl }) {
  if (!contractor.email) return { skipped: true };

  const subject = "Your site pass link";
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">Hi ${contractor.full_name},</p>
      <p>Here's your site pass link, as requested:</p>
      <p style="margin:24px 0;">
        <a href="${passUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">View my pass</a>
      </p>
    </div>
  `;

  if (!resend) {
    console.warn("[email] Contractor pass link email skipped (no Resend key):", { to: contractor.email });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to: contractor.email,
    subject,
    html,
  });
}

/**
 * Notifies admins a new contractor pass registration is waiting for
 * review — goes to the same ADMIN_NOTIFICATION_EMAIL / HR_NOTIFICATION_EMAIL
 * recipients as sendGateApprovalRequest. No approve/deny links in the
 * email itself: unlike the gate and vehicle-request flows, contractor
 * decisions are made from the (login-gated) admin dashboard, not a
 * one-click token link — this is just the "something's waiting" nudge.
 */
export async function sendContractorRegistrationSubmittedEmail({ contractor, reviewUrl }) {
  const to = [process.env.ADMIN_NOTIFICATION_EMAIL, process.env.HR_NOTIFICATION_EMAIL].filter(Boolean);

  const subject = `Contractor pass registration — ${contractor.full_name} (Pending)`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">A new contractor pass registration is waiting for review.</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:24px;">
        <tr><td style="color:#6b7268; padding:6px 0; width:140px;">Name</td><td>${contractor.full_name}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Company</td><td>${contractor.company || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Documents</td><td>${
          contractor.document_type === "freezone_pass" ? "Freezone gate pass" : "Passport + Emirates ID"
        }</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Status</td><td>Pending</td></tr>
      </table>
      <p>
        <a href="${reviewUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">Review registration</a>
      </p>
    </div>
  `;

  if (!resend || to.length === 0) {
    console.warn("[email] Contractor registration submitted email skipped (no Resend key or no recipients configured):", {
      to,
      subject,
    });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}

/**
 * Notifies admins a contractor pass registration was approved and is now
 * active — goes to the same ADMIN_NOTIFICATION_EMAIL / HR_NOTIFICATION_EMAIL
 * recipients as sendGateApprovalRequest and sendContractorRegistrationSubmittedEmail,
 * closing the loop on the "submitted" notice those two addresses already got.
 * Denials are deliberately NOT emailed anywhere — a denial and its optional
 * reason are internal-only, visible solely in the admin dashboard (see
 * app/admin/contractors/page.jsx).
 */
export async function sendContractorRegistrationApprovedEmail({ contractor, reviewUrl }) {
  const to = [process.env.ADMIN_NOTIFICATION_EMAIL, process.env.HR_NOTIFICATION_EMAIL].filter(Boolean);

  const subject = `Contractor pass approved — ${contractor.full_name} (Active)`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">A contractor pass registration was approved and is now active.</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:24px;">
        <tr><td style="color:#6b7268; padding:6px 0; width:140px;">Name</td><td>${contractor.full_name}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Company</td><td>${contractor.company || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Pass ID</td><td>${contractor.pass_id || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Status</td><td>Active</td></tr>
      </table>
      <p>
        <a href="${reviewUrl}" style="background:#2a6f63; color:white; padding:12px 20px;
        border-radius:8px; text-decoration:none; font-weight:600;">View in admin dashboard</a>
      </p>
    </div>
  `;

  if (!resend || to.length === 0) {
    console.warn("[email] Contractor approval email skipped (no Resend key or no recipients configured):", {
      to,
      subject,
    });
    return { skipped: true };
  }

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
}
