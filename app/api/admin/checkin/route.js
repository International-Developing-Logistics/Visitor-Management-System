import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { sendHostNotification } from "@/lib/email";

// POST /api/admin/checkin { id }
// Lets staff manually check in a pre-registered guest (e.g. they forgot to
// tap "I'm here" on their own link, or arrived without a phone).
export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing visitor id" }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data: visitor, error } = await supabaseAdmin
    .from("visitors")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", visitor.host_id).single();
  if (host) {
    await sendHostNotification({ host, visitor, status: "checked_in" });
  }

  return NextResponse.json({ visitor });
}
