import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { sendHostNotification } from "@/lib/email";
import { uploadPrivateFile, signOne } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  const limited = checkRateLimit(req, "preregister-complete");
  if (limited) return limited;

  const supabaseAdmin = getSupabaseAdmin();
  const { token, full_name, phone, company, photo, signature } = await req.json();

  if (!token || !full_name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from("visitors")
    .select("id")
    .eq("checkin_token", token)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  try {
    const [photo_path, signature_path] = await Promise.all([
      photo ? uploadPrivateFile(supabaseAdmin, "visitor-photos", `${existing.id}.jpg`, photo) : null,
      signature ? uploadPrivateFile(supabaseAdmin, "visitor-signatures", `${existing.id}.png`, signature) : null,
    ]);

    const { data: visitor, error } = await supabaseAdmin
      .from("visitors")
      .update({
        full_name,
        phone,
        company,
        photo_url: photo_path,
        signature_url: signature_path,
        nda_signed_at: signature ? new Date().toISOString() : null,
        status: "pre_registered",
      })
      .eq("checkin_token", token)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { data: host } = await supabaseAdmin.from("hosts").select("*").eq("id", visitor.host_id).single();
    if (host) {
      const photoSignedUrl = photo_path
        ? await signOne(supabaseAdmin, "visitor-photos", photo_path, 60 * 60 * 24 * 7)
        : null;
      await sendHostNotification({ host, visitor, status: "pre_registered", photoSignedUrl });
    }

    return NextResponse.json({ visitor });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
