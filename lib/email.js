import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Sends the host notification email.
 * status: "checked_in" | "pre_registered"
 */
export async function sendHostNotification({ host, visitor, status, photoSignedUrl }) {
  const headline =
    status === "checked_in"
      ? "Your guest is waiting for you at our company."
      : "Your guest has scheduled a meeting with you at our company.";

  const subject =
    status === "checked_in"
      ? `${visitor.full_name} has arrived`
      : `${visitor.full_name} has pre-registered a visit`;

  const photoHtml = photoSignedUrl
    ? `<img src="${photoSignedUrl}" alt="Visitor photo" style="width:88px; height:88px; object-fit:cover; border-radius:10px; margin-bottom:16px;" />`
    : "";

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      ${photoHtml}
      <p style="font-size:16px; margin-bottom:20px;">${headline}</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="color:#6b7268; padding:6px 0; width:140px;">Name</td><td>${visitor.full_name}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Company</td><td>${visitor.company || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Email</td><td>${visitor.email}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Phone</td><td>${visitor.phone || "—"}</td></tr>
        <tr><td style="color:#6b7268; padding:6px 0;">Purpose</td><td>${visitor.purpose}</td></tr>
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

  return resend.emails.send({
    from: process.env.EMAIL_FROM || "Visitor Check-in <onboarding@resend.dev>",
    to: host.email,
    subject,
    html,
  });
}

/**
 * Sends the pre-registration link to the visitor before they arrive.
 */
export async function sendVisitorInviteEmail({ visitor, host, checkinUrl }) {
  const subject = `You're invited — please pre-register for your visit`;
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; color:#16211f; max-width:520px;">
      <p style="font-size:16px;">Hi ${visitor.full_name || "there"},</p>
      <p>You have an upcoming visit with <strong>${host.name}</strong>. Please complete your
      check-in details ahead of time so arrival is quick:</p>
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
    subject,
    html,
  });
}
