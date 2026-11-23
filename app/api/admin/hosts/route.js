import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("hosts").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hosts: data });
}

export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const department = (body.department || "").trim() || null;
  if (!name || !email) return NextResponse.json({ error: "Name and email are required" }, { status: 400 });

  const supabaseAdmin = getSupabaseAdmin();

  // Reject duplicates (e.g. the Add button clicked twice).
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("hosts")
    .select("id, name")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&")) // case-insensitive exact match
    .limit(1);
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: `A host with this email already exists (${existing[0].name})` },
      { status: 409 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hosts")
    .insert({ name, email, department })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ host: data });
}
