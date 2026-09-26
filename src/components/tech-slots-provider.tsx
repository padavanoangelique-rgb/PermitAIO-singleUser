"use client";

import { createContext, useContext } from "react";
import { displayNameOnly, type TechNameMap } from "@/lib/tech-labels";

type TechSlots = {
  permitTechs: string[];
  hoaTechs: string[];
  permitNames: TechNameMap;
  hoaNames: TechNameMap;
};

const TechSlotsContext = createContext<TechSlots>({
  permitTechs: ["Permit Tech 1", "Permit Tech 2", "Permit Tech 3"],
  hoaTechs: ["Tech 1", "Tech 2", "Tech 3"],
  permitNames: {},
  hoaNames: {},
});

export function TechSlotsProvider({
  permitTechs,
  hoaTechs,
  permitNames = {},
  hoaNames = {},
  children,
}: TechSlots & { children: React.ReactNode }) {
  return (
    <TechSlotsContext.Provider value={{ permitTechs, hoaTechs, permitNames, hoaNames }}>
      {children}
    </TechSlotsContext.Provider>
  );
}

export function useTechSlots(): TechSlots {
  return useContext(TechSlotsContext);
}

export function useTechLabel() {
  const { permitNames, hoaNames } = useTechSlots();
  return {
    permitLabel: (slot: string | null | undefined) =>
      slot ? displayNameOnly(slot, permitNames) : "",
    hoaLabel: (slot: string | null | undefined) =>
      slot ? displayNameOnly(slot, hoaNames) : "",
  };
}
