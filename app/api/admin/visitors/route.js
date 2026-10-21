import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";
import { sendHostNotification } from "@/lib/email";
import { validateAdminVisitorInput } from "@/lib/visitorValidation";
import { randomUUID } from "crypto";

// GET /api/admin/visitors?status=checked_in&facility=idl - list visitors,
// newest first. Pass no status to get everyone in that facility; status can
// be a single value, a comma-separated list (e.g.
// "gate_pending,gate_approved,gate_denied"), or omitted. facility defaults
// to the original facility so results never silently mix facilities;
// facility=all skips the filter (the header facility selector's "All
// Facilities" option), matching the other admin list routes.
//
// phone=<digits> - returns every visit on record for that phone number
// (any status, any facility), newest first, ignoring the status/facility
// filters above entirely. This is the "visit history" lookup for a
// returning visitor - matches against the same normalized phone_digits
// column the self-service returning-visitor lookup uses (see
// supabase/migration_visitor_phone_lookup.sql), so formatting differences
// (spaces, dashes, country code) don't cause misses.
//
// q=<text> - server-side search against full_name/email/phone/company,
// applied BEFORE the limit below (combined with status/facility). Without
// this, the admin Visitors page's search box could only filter whatever
// page of (at most) 200 most-recent rows had already been fetched for the
// active tab - so a completed visit older than the newest 200 in that
// facility would silently never be findable there, even though it's a
// perfectly real row, which is exactly the gap this closes.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const phone = req.nextUrl.searchParams.get("phone");

  if (phone) {
    const digits = String(phone).replace(/\D/g, "");
    if (!digits) return NextResponse.json({ visitors: [] });
    const { data, error } = await supabaseAdmin
      .from("visitors")
      .select("*, hosts(name, email)")
      .eq("phone_digits", digits)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(
      { visitors: data },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const status = req.nextUrl.searchParams.get("status");
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();

  let query = supabaseAdmin
    .from("visitors")
    .select("*, hosts(name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (facility !== "all") query = query.eq("facility", facility);

  if (status) {
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    query = statuses.length > 1 ? query.in("status", statuses) : query.eq("status", statuses[0]);
  }

  if (q) {
    const like = `%${q}%`;
    // The admin Visitors page's search box used to also match on the
    // joined host's name (it had the full row client-side to check
    // against) - visitors doesn't store that name directly, so resolve
    // any hosts whose name matches first and fold their ids into the same
    // OR, rather than silently dropping host-name search when it moved
    // server-side.
    const { data: matchingHosts } = await supabaseAdmin.from("hosts").select("id").ilike("name", like);
    const hostIds = (matchingHosts || []).map((h) => h.id);
    const hostIdFilter = hostIds.length > 0 ? `,host_id.in.(${hostIds.join(",")})` : "";
    query = query.or(
      `full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},company.ilike.${like}${hostIdFilter}`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { visitors: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

// POST /api/admin/visitors - requireAdmin. Lets an admin register a
// visitor directly from the dashboard instead of waiting for the visitor
// (or a gate guard) to go through one of the self-service flows. Applies
// the same required-field and visitor_type validation as self-registration
// (see lib/visitorValidation.js), then writes a visitor row straight into
// one of the two terminal/near-terminal statuses - this intentionally
// skips the request/gate-approval machinery entirely (requested,
// gate_pending, gate_approved/denied): an admin creating the record IS the
// approval, there's nothing left to approve.
//
// body: { ...same fields as /api/visitors, plus:
//   visit_mode: "checked_in" | "pre_registered",
//   expected_visit_time: ISO string, required when visit_mode is
//     "pre_registered" (this is what Automatic Preregistration Tracking
//     compares against later - see lib/visitorLifecycle.js),
//   notify_host: boolean, default true - send the same host notification
//     email every other creation path sends.
// }
export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const body = await req.json();
  const { errors, clean } = validateAdminVisitorInput(body);

  if (clean.visit_mode === "pre_registered" && !body.expected_visit_time) {
    errors.push("Expected visit date/time is required for a pre-registration");
  } else if (clean.visit_mode === "pre_registered") {
    const d = new Date(body.expected_visit_time);
    if (Number.isNaN(d.getTime())) errors.push("That expected visit date/time doesn't look valid");
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const notifyHost = body.notify_host !== false; // default true
  const id = randomUUID();
  const isCheckingInNow = clean.visit_mode === "checked_in";

  const row = {
    id,
    full_name: clean.full_name,
    email: clean.email,
    phone: clean.phone,
    company: clean.company,
    visitor_type: clean.visitor_type,
    host_id: clean.host_id,
    purpose: clean.purpose,
    notes: clean.notes,
    visit_type: isCheckingInNow ? "walkin" : "prereg",
    status: isCheckingInNow ? "checked_in" : "pre_registered",
    checked_in_at: isCheckingInNow ? new Date().toISOString() : null,
    selected_time_slot: isCheckingInNow ? null : new Date(body.expected_visit_time).toISOString(),
    additional_visitor_count: clean.additional_visitor_count,
    additional_visitor_names: clean.additional_visitor_names,
    group_members: clean.group_members,
    facility: body.facility || DEFAULT_FACILITY,
  };

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .insert(row)
    .select("*, hosts(name, email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (notifyHost) {
    const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", clean.host_id).single();
    if (host) {
      try {
        await sendHostNotification({ host, visitor, status: visitor.status });
      } catch (err) {
        // Admin-created visitors are already written by this point - a
        // notification failure shouldn't undo the registration, just like
        // the self-service routes don't roll back on an email error.
        console.error(err);
      }
    }
  }

  return NextResponse.json({ visitor });
}
