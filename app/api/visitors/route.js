import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { uploadPrivateFile, signOne } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";
import { randomUUID } from "crypto";

export async function POST(req) {
  const limited = checkRateLimit(req, "visitors");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const body = await req.json();

  const {
    full_name,
    email,
    phone,
    company,
    purpose,
    host_id,
    notes,
    photo, // data URL
    signature, // data URL
    visit_type, // "walkin" | "prereg"
  } = body;

  if (!full_name || !email || !purpose || !host_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = randomUUID();
  const status = visit_type === "prereg" ? "pre_registered" : "checked_in";

  try {
    const [photo_path, signature_path] = await Promise.all([
      photo ? uploadPrivateFile(supabaseAdmin, "visitor-photos", `${id}.jpg`, photo) : null,
      signature ? uploadPrivateFile(supabaseAdmin, "visitor-signatures", `${id}.png`, signature) : null,
    ]);

    const row = {
      id,
      full_name,
      email,
      phone,
      company,
      purpose,
      host_id,
      notes,
      photo_url: photo_path, // stores the private storage PATH, not a public URL
      signature_url: signature_path,
      nda_signed_at: signature ? new Date().toISOString() : null,
      visit_type: visit_type === "prereg" ? "prereg" : "walkin",
      status,
      checkin_token: visit_type === "prereg" ? randomUUID() : null,
      checked_in_at: status === "checked_in" ? new Date().toISOString() : null,
    };

    const { data: visitor, error } = await supabaseAdmin
      .from("visitors")
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: host } = await supabaseAdmin
      .from("hosts")
      .select("*")
      .eq("id", host_id)
      .single();

    if (host) {
      const photoSignedUrl = photo_path
        ? await signOne(supabaseAdmin, "visitor-photos", photo_path, 60 * 60 * 24 * 7)
        : null;
      await sendHostNotification({ host, visitor, status, photoSignedUrl });
    }

    return NextResponse.json({ visitor });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
