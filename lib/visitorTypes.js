// The visitor-facing "what kind of visitor is this" categorization - a new,
// required field distinct from `visit_type` (which just means the channel
// they came through: "walkin" | "prereg" | "gate") and distinct from
// `purpose`, which is now an admin-assigned field added after check-in
// rather than something the visitor picks. See the design discussion this
// was built from for the full reasoning.
export const VISITOR_TYPE_OPTIONS = [
  "Business Visitor",
  "Vendor / Contractor",
  "Delivery / Service",
  "Other",
];

// Selecting this option reveals a free-text "Please specify" field. The
// forms combine the two into a single string before submitting - e.g.
// "Other: Passport renewal" - the exact same convention already used for
// `purpose` on the (untouched) app/request-invite and app/preregister staff
// tools. No separate DB column for the detail text; it just lives inside
// the one visitor_type string.
export const OTHER_VISITOR_TYPE = "Other";

// The one type that gets a structured per-person name+phone group list
// (`group_members`) instead of the simpler count + optional free-text
// names every other type uses.
export const STRUCTURED_GROUP_VISITOR_TYPE = "Business Visitor";

export const MAX_GROUP_MEMBERS = 25;

/**
 * Server-side validation for the submitted visitor_type string. Accepts any
 * exact option from VISITOR_TYPE_OPTIONS, or the combined "Other: <detail>"
 * form the client sends when someone picks "Other" and types a detail -
 * mirrors how `purpose` is validated (or rather, deliberately isn't
 * validated against a fixed list) elsewhere in this app.
 */
export function isValidVisitorType(value) {
  if (!value) return false;
  if (VISITOR_TYPE_OPTIONS.includes(value)) return true;
  return value.startsWith(`${OTHER_VISITOR_TYPE}: `);
}

/**
 * Server-side cleanup for the `group_members` array a check-in form
 * submits: drops anything malformed, trims strings, filters out blank
 * rows, and caps the length - mirrors the same "reasonable cap, not a
 * hard business rule" approach used for additional_visitor_count
 * elsewhere. Returns an array (possibly empty), never throws.
 */
export function sanitizeGroupMembers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => ({ name: String(m?.name || "").trim(), phone: String(m?.phone || "").trim() }))
    .filter((m) => m.name && m.phone)
    .slice(0, MAX_GROUP_MEMBERS);
}
