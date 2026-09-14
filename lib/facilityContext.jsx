"use client";

// Global facility selection, lifted out of the several admin pages that
// used to each keep their own local "Facility: [tabs]" switcher
// (vehicle-requests, vehicle-movements, equipment-requests, guard-logs —
// all four had byte-for-byte the same switcher UI). Now there's one
// selector in the app header (see components/AppShell.jsx) and every
// facility-aware page reads from here instead of managing its own state.
import { createContext, useContext, useState } from "react";
import { DEFAULT_FACILITY } from "@/lib/facilities";

// A pseudo-facility value, not a real key in FACILITIES — pages that
// support it should treat it as "don't filter by facility" server-side.
export const ALL_FACILITIES = "all";

const FacilityContext = createContext(null);

export function FacilityProvider({ children }) {
  const [facility, setFacility] = useState(DEFAULT_FACILITY);
  return <FacilityContext.Provider value={{ facility, setFacility }}>{children}</FacilityContext.Provider>;
}

// Falls back to the single default facility if used outside a provider,
// so nothing throws if a not-yet-migrated page calls this before every
// entry point is wrapped.
export function useFacility() {
  const ctx = useContext(FacilityContext);
  return ctx || { facility: DEFAULT_FACILITY, setFacility: () => {} };
}
