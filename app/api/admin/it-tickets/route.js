import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/admin/it-tickets?facility=idl
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  let query = supabaseAdmin.from("it_tickets").select("*");
  if (facility !== "all") query = query.eq("facility", facility);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { tickets: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
