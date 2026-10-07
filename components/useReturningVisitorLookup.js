"use client";

import { useState } from "react";
import { OTHER_VISITOR_TYPE } from "@/lib/visitorTypes";

// Shared by VisitorDetailsForm.jsx (self-service kiosk check-in / open
// pre-registration) and AddVisitorModal.jsx (admin-direct registration) -
// "Automatic recognition of returning visitors" lives here once so both
// places behave identically instead of drifting apart. Once the phone
// field has a real number in it, looks it up against past visits
// (GET /api/visitors/lookup). If it matches, prefills whatever fields the
// caller hasn't already typed something into (never clobbers something
// mid-typing) and exposes status/welcomeName so the caller can show its
// own "Welcome back" notice - they can still edit anything that's
// changed, same as if they'd typed it themselves. Never fetched for fewer
// than 7 digits, matching the server-side floor in
// app/api/visitors/lookup/route.js.
export function useReturningVisitorLookup(values, onChange) {
  const [status, setStatus] = useState("idle"); // idle | checking | found | not_found
  const [welcomeName, setWelcomeName] = useState("");

  const runLookup = async () => {
    const digits = (values.phone || "").replace(/\D/g, "");
    if (digits.length < 7) return;
    setStatus("checking");
    try {
      const res = await fetch(`/api/visitors/lookup?phone=${encodeURIComponent(digits)}`);
      const data = await res.json();
      if (!data.found) {
        setStatus("not_found");
        return;
      }
      const v = data.visitor;

      // The stored visitor_type may be the combined "Other: <detail>" form
      // (see lib/visitorTypes.js) - split it back into the two separate
      // fields both forms actually edit, so "Other" ends up selected in
      // the dropdown with its detail prefilled, instead of an unmatched
      // raw string nothing in the <select> recognizes.
      let foundType = v.visitor_type || "";
      let foundDetail = "";
      if (foundType.startsWith(`${OTHER_VISITOR_TYPE}: `)) {
        foundDetail = foundType.slice(OTHER_VISITOR_TYPE.length + 2);
        foundType = OTHER_VISITOR_TYPE;
      }

      onChange({
        ...values,
        full_name: values.full_name?.trim() ? values.full_name : v.full_name || values.full_name,
        company: values.company?.trim() ? values.company : v.company || values.company,
        visitor_type: values.visitor_type ? values.visitor_type : foundType || values.visitor_type,
        visitor_type_detail: values.visitor_type_detail?.trim()
          ? values.visitor_type_detail
          : foundDetail || values.visitor_type_detail,
        host_id: values.host_id ? values.host_id : v.host_id || values.host_id,
      });
      setWelcomeName(v.full_name || "");
      setStatus("found");
    } catch {
      // A failed lookup should never block check-in/registration - just
      // carry on as if this were a brand-new visitor.
      setStatus("not_found");
    }
  };

  return { status, welcomeName, runLookup, dismiss: () => setStatus("idle") };
}
