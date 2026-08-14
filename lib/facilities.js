// Central place to add a new facility. Each facility gets its own branded
// public pages (gate, open pre-registration, walk-in) while sharing the
// same database, host list, and admin login — just tagged with `facility`
// so records never mix between them.
//
// To add another facility later: add an entry here, drop its logo in
// /public, add its pages under app/<key>/..., and add its gate-approval
// email env vars if it needs distinct recipients.
export const DEFAULT_FACILITY = "harmony";

export const FACILITIES = {
  harmony: {
    key: "harmony",
    label: process.env.NEXT_PUBLIC_COMPANY_NAME || "Harmony Freight",
    logo: "/logo.png",
    gateApprovalEmailEnvVars: ["ADMIN_NOTIFICATION_EMAIL", "HR_NOTIFICATION_EMAIL"],
  },
  idl: {
    key: "idl",
    label: "International Developing Logistics",
    logo: "/idl-logo.png",
    gateApprovalEmailEnvVars: ["IDL_GATE_EMAIL_1", "IDL_GATE_EMAIL_2"],
  },
};

export function getFacility(key) {
  return FACILITIES[key] || FACILITIES[DEFAULT_FACILITY];
}

/** Server-only: resolves a facility's configured gate-approval recipient emails. */
export function getGateApprovalRecipients(facilityKey) {
  const facility = getFacility(facilityKey);
  return facility.gateApprovalEmailEnvVars.map((v) => process.env[v]).filter(Boolean);
}
