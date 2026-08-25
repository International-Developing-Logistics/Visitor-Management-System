import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

// POST /api/request-invite { email, full_name?, host_id, purpose, notes?,
//   additional_visitor_count?, additional_visitor_names? }
// Public/no-login by design — see HANDOVER.md §1.4. This only queues a
// request. It does NOT create a usable check-in link or send anything to
// the guest. An admin must review it in /admin and approve it from the
// "Requests" tab before any invite actually goes out.
export async function POST(req) {
  const limited = checkRateLimit(req, "request-invite");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const {
    email,
    full_name,
    host_id,
    purpose,
    notes,
    additional_visitor_count,
    additional_visitor_names,
    proposed_time_slots,
  } = await req.json();

  if (!email || !host_id || !purpose) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;

  // See app/api/preregister/route.js for why this doesn't re-run
  // new Date(s).toISOString() on naive strings here.
  const slots = Array.isArray(proposed_time_slots)
    ? proposed_time_slots.filter((s) => s && !Number.isNaN(new Date(s).getTime()))
    : null;

  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .insert({
      id: randomUUID(),
      email,
      full_name: full_name || "",
      host_id,
      purpose,
      notes,
      visit_type: "prereg",
      status: "requested",
      additional_visitor_count: groupCount,
      additional_visitor_names: additional_visitor_names || null,
      proposed_time_slots: slots && slots.length > 0 ? slots : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visitor });
}
