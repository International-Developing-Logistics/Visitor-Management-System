import { isValidVisitorType, sanitizeGroupMembers } from "./visitorTypes";

// Shared validation for admin-direct visitor creation
// (app/api/admin/visitors POST, used by components/AddVisitorModal.jsx).
//
// Deliberately NOT wired into the existing self-service routes
// (app/api/visitors, app/api/preregister, app/api/preregister-open) - those
// already work in production and the feature request this was built for
// explicitly asked to "preserve all current functionality", so this just
// mirrors their rules independently rather than refactoring them to share
// this file. If the rules ever drift, that's an acceptable tradeoff for not
// risking a regression in already-working check-in flows.
//
// Returns { errors: string[], clean: {...} }. clean is only meaningful when
// errors is empty.
export function validateAdminVisitorInput(body) {
  const errors = [];
  const {
    full_name,
    email,
    phone,
    company,
    visitor_type,
    host_id,
    purpose,
    notes,
    additional_visitor_count,
    additional_visitor_names,
    group_members,
    visit_mode, // "checked_in" | "pre_registered"
  } = body || {};

  if (!full_name || !String(full_name).trim()) errors.push("Full name is required");
  if (!phone || !String(phone).trim()) errors.push("Phone is required");
  if (!host_id) errors.push("Host is required");
  if (!isValidVisitorType(visitor_type)) errors.push("Please select a valid visitor type");
  if (visit_mode !== "checked_in" && visit_mode !== "pre_registered") {
    errors.push("visit_mode must be \"checked_in\" or \"pre_registered\"");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("That email address doesn't look valid");
  }

  const groupCount = Number.isFinite(Number(additional_visitor_count))
    ? Math.max(0, Math.floor(Number(additional_visitor_count)))
    : 0;
  const cleanGroupMembers = sanitizeGroupMembers(group_members);

  return {
    errors,
    clean: {
      full_name: String(full_name || "").trim(),
      email: email || null,
      phone: String(phone || "").trim(),
      company: company || null,
      visitor_type,
      host_id,
      purpose: purpose || "",
      notes: notes || null,
      additional_visitor_count: cleanGroupMembers.length > 0 ? cleanGroupMembers.length : groupCount,
      additional_visitor_names: cleanGroupMembers.length > 0 ? null : additional_visitor_names || null,
      group_members: cleanGroupMembers.length > 0 ? cleanGroupMembers : null,
      visit_mode,
    },
  };
}
