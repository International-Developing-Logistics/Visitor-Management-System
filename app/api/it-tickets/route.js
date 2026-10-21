import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { requireRole } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { randomUUID } from "crypto";

const VALID_PRIORITIES = ["low", "normal", "urgent"];

// POST /api/it-tickets { submitter_name, submitter_email, description, priority?, facility? }
// Staff Hub only - open to admin and staff accounts, not guard (see
// components/StaffHub.jsx; a guard needs a staff member to report an
// issue for them, by design).
export async function POST(req) {
  const user = await requireRole(req, ["admin", "staff"]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkRateLimit(req, "it-tickets");
  if (limited) return limited;

  const { submitter_name, submitter_email, description, priority, facility } = await req.json();

  if (!submitter_name || !submitter_name.trim()) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitter_email || "");
  if (!emailOk) {
    return NextResponse.json({ error: "A valid email is required, in case we need to follow up" }, { status: 400 });
  }
  if (!description || !description.trim()) {
    return NextResponse.json({ error: "Describe the issue first" }, { status: 400 });
  }
  const cleanPriority = VALID_PRIORITIES.includes(priority) ? priority : "normal";

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("it_tickets").insert({
    id: randomUUID(),
    facility: facility || DEFAULT_FACILITY,
    submitter_name: submitter_name.trim(),
    submitter_email: submitter_email.trim(),
    description: description.trim(),
    priority: cleanPriority,
    status: "open",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
