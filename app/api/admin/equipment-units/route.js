import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// GET -> every unit, active and retired, for the admin management table.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("equipment_units")
    .select("*")
    .order("facility")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ units: data });
}

// POST { name, type, facility } -> add a new physical unit. The id baked
// into its printed QR code is derived from the name here (not entered by
// hand) since it has to be unique and URL-safe; a collision (e.g. a
// second "Forklift #1") just gets a numeric suffix.
export async function POST(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, facility } = await req.json();
  if (!name?.trim() || !type?.trim() || !facility) {
    return NextResponse.json({ error: "Name, type, and facility are required" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const base = slugify(name) || "unit";
  let id = base;
  for (let n = 2; ; n++) {
    const { data: existing } = await supabaseAdmin.from("equipment_units").select("id").eq("id", id).maybeSingle();
    if (!existing) break;
    id = `${base}-${n}`;
  }

  const { data, error } = await supabaseAdmin
    .from("equipment_units")
    .insert({ id, name: name.trim(), type: type.trim(), facility })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ unit: data });
}
