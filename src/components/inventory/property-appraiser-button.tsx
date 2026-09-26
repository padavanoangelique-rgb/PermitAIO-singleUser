"use client";

import { Landmark } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Official county Property Appraiser sites for the counties PermitAIO
// covers. Verified live (each resolves to the county's real PA site, not a
// parked/expired domain) before adding here — recheck if one of these ever
// starts bouncing, county sites migrate domains occasionally.
const PROPERTY_APPRAISER_SITES: { county: string; url: string }[] = [
  { county: "Palm Beach County", url: "https://pbcpao.gov/" },
  { county: "Broward County", url: "https://web.bcpa.net/" },
  { county: "Miami-Dade County", url: "https://miamidadepa.gov/" },
  { county: "Martin County", url: "https://pamartinfl.gov/" },
  { county: "Indian River County", url: "https://ircpa.org/" },
  { county: "St. Lucie County", url: "https://paslc.gov/" },
];

/** Toolbar button on Permit Inventory — jumps straight to the property
 * appraiser site for whichever county the tech needs to look up a folio,
 * legal description, or owner name for. */
export function PropertyAppraiserButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Landmark /> Property Appraiser
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Open county site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PROPERTY_APPRAISER_SITES.map((site) => (
          <DropdownMenuItem key={site.county} asChild>
            <a href={site.url} target="_blank" rel="noopener noreferrer">
              {site.county}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
