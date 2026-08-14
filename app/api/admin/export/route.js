import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmt(ts) {
  if (!ts) return "";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16);
}

// GET /api/admin/export?month=2026-08 — CSV of every visitor whose
// created_at falls within that calendar month. Opens directly in Excel.
export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month"); // "YYYY-MM"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Provide a month as YYYY-MM" }, { status: 400 });
  }
  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;

  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("visitors")
    .select("*, hosts(name, email)")
    .eq("facility", facility)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const headers = [
    "Full Name",
    "Email",
    "Phone",
    "Company",
    "Purpose",
    "Host",
    "Host Email",
    "Visit Type",
    "Status",
    "Additional Visitors",
    "Additional Visitor Names",
    "Meeting Time (UTC)",
    "Notes",
    "Created At (UTC)",
    "Checked In At (UTC)",
    "Checked Out At (UTC)",
  ];

  const rows = (data || []).map((v) => [
    v.full_name,
    v.email,
    v.phone,
    v.company,
    v.purpose,
    v.hosts?.name,
    v.hosts?.email,
    v.visit_type,
    v.status,
    v.additional_visitor_count || 0,
    v.additional_visitor_names,
    fmt(v.selected_time_slot),
    v.notes,
    fmt(v.created_at),
    fmt(v.checked_in_at),
    fmt(v.checked_out_at),
  ]);

  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="visitor-log-${facility}-${month}.csv"`,
    },
  });
}
