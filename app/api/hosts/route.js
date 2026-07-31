import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

// Without this, Next.js treats a param-less GET route as static and caches
// the result at build/deploy time — so newly added hosts wouldn't show up
// in the /walkin or /preregister dropdown until the next deploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("hosts")
    .select("id, name")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { hosts: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}