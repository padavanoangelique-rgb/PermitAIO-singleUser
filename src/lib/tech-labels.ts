// Utilities for displaying the fixed permit/HOA tech slots with the
// organization's real technician names alongside the slot label.
//
// The underlying job rows still store the raw slot value ("Permit Tech 1",
// "Tech 2", etc.) — this is display-only. When an org has set a real name
// for a slot we render "Permit Tech 1 (Angelique)"; otherwise we render
// the slot as-is.

export type TechKind = "permit" | "hoa";

export type TechNameMap = Record<string, string>;
// keys: for kind === "permit": "Permit Tech 1" | "Permit Tech 2" | "Permit Tech 3"
//       for kind === "hoa":    "Tech 1" | "Tech 2" | "Tech 3"

export function formatTechLabel(slot: string, names: TechNameMap | undefined): string {
  if (!slot) return slot;
  const real = names?.[slot]?.trim();
  return real ? `${slot} (${real})` : slot;
}

export function displayNameOnly(slot: string, names: TechNameMap | undefined): string {
  const real = names?.[slot]?.trim();
  return real || slot;
}
