import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { requireAdmin } from "@/lib/verifyAdmin";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// GET /api/admin/search?q=jane&facility=idl - global search, item #10 of
// the IA overhaul. Admin-only (permission-respecting, per the spec: this
// touches full visitor/contractor/request records the same way the admin
// list pages do, so it uses the same requireAdmin gate rather than a
// separate lighter-weight one). Runs a handful of small, capped ilike
// queries rather than one big federated query - simplest thing that works
// for a dataset this size, consistent with the rest of the app's admin
// list routes (all a single query with a limit, no pagination).
const RESULT_LIMIT = 6;

export async function GET(req) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const facility = req.nextUrl.searchParams.get("facility") || DEFAULT_FACILITY;
  const like = `%${q}%`;
  const supabaseAdmin = getSupabaseAdmin();

  const results = [];

  let visitorQuery = supabaseAdmin
    .from("visitors")
    .select("id, full_name, email, company, status")
    .or(`full_name.ilike.${like},email.ilike.${like},company.ilike.${like}`)
    .limit(RESULT_LIMIT);
  if (facility !== "all") visitorQuery = visitorQuery.eq("facility", facility);
  const { data: visitors } = await visitorQuery;
  (visitors || []).forEach((v) =>
    results.push({
      type: "Visitor",
      id: v.id,
      title: v.full_name || v.email || "Visitor",
      subtitle: [v.company, v.status].filter(Boolean).join(" · "),
      href: "/admin/visitors",
    })
  );

  const { data: contractors } = await supabaseAdmin
    .from("contractors")
    .select("id, full_name, company, pass_id, status")
    .or(`full_name.ilike.${like},company.ilike.${like},pass_id.ilike.${like}`)
    .limit(RESULT_LIMIT);
  (contractors || []).forEach((c) =>
    results.push({
      type: "Contractor",
      id: c.id,
      title: c.full_name || "Contractor",
      subtitle: [c.company, c.pass_id, c.status].filter(Boolean).join(" · "),
      href: "/admin/contractors",
    })
  );

  let vehicleQuery = supabaseAdmin
    .from("vehicle_requests")
    .select("id, employee_name, customer_name, vehicle, destination, status")
    .or(`employee_name.ilike.${like},customer_name.ilike.${like},vehicle.ilike.${like},destination.ilike.${like}`)
    .limit(RESULT_LIMIT);
  if (facility !== "all") vehicleQuery = vehicleQuery.eq("facility", facility);
  const { data: vehicleRequests } = await vehicleQuery;
  (vehicleRequests || []).forEach((r) =>
    results.push({
      type: "Vehicle Request",
      id: r.id,
      title: r.employee_name || r.customer_name || "Vehicle request",
      subtitle: [r.vehicle, r.destination, r.status].filter(Boolean).join(" · "),
      href: "/admin/vehicle-requests",
    })
  );

  let equipmentQuery = supabaseAdmin
    .from("equipment_requests")
    .select("id, employee_name, location, equipment, status")
    .or(`employee_name.ilike.${like},location.ilike.${like},equipment.ilike.${like}`)
    .limit(RESULT_LIMIT);
  if (facility !== "all") equipmentQuery = equipmentQuery.eq("facility", facility);
  const { data: equipmentRequests } = await equipmentQuery;
  (equipmentRequests || []).forEach((r) =>
    results.push({
      type: "Equipment Request",
      id: r.id,
      title: r.employee_name || "Equipment request",
      subtitle: [r.location, r.equipment, r.status].filter(Boolean).join(" · "),
      href: "/admin/equipment-requests",
    })
  );

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
