"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/lib/supabase/types";

type ContractorProfile = Tables<"contractor_profiles"> & {
  license_expires?: string | null;
  insurance_expires?: string | null;
  workers_comp_expires?: string | null;
  btr_expires?: string | null;
};

export function ContractorFormFields({ profile }: { profile?: ContractorProfile }) {
  const [trade, setTrade] = useState(profile?.trade ?? "windows");

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input id="company_name" name="company_name" required defaultValue={profile?.company_name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trade">Trade</Label>
          <Select value={trade} onValueChange={setTrade}>
            <SelectTrigger id="trade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="windows">Windows</SelectItem>
              <SelectItem value="roofing">Roofing</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="trade" value={trade} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="license_number">License number</Label>
          <Input
            id="license_number"
            name="license_number"
            placeholder="CGC1234567"
            defaultValue={profile?.license_number ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qualifier_name">Qualifier name</Label>
          <Input id="qualifier_name" name="qualifier_name" defaultValue={profile?.qualifier_name ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="business_tax_receipt_number">Business tax receipt number</Label>
        <Input
          id="business_tax_receipt_number"
          name="business_tax_receipt_number"
          defaultValue={profile?.business_tax_receipt_number ?? ""}
        />
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expirations</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="license_expires">License</Label>
            <Input id="license_expires" name="license_expires" type="date" defaultValue={profile?.license_expires ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insurance_expires">Insurance / GL</Label>
            <Input id="insurance_expires" name="insurance_expires" type="date" defaultValue={profile?.insurance_expires ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="workers_comp_expires">Workers comp</Label>
            <Input id="workers_comp_expires" name="workers_comp_expires" type="date" defaultValue={profile?.workers_comp_expires ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="btr_expires">BTR</Label>
            <Input id="btr_expires" name="btr_expires" type="date" defaultValue={profile?.btr_expires ?? ""} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact name</Label>
          <Input id="contact_name" name="contact_name" defaultValue={profile?.contact_name ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={profile?.email ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={profile?.address ?? ""} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={profile?.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={profile?.state ?? "FL"} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">Zip</Label>
          <Input id="zip" name="zip" defaultValue={profile?.zip ?? ""} />
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-dashed p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bonding company (only if a permit form asks for it)
        </p>
        <Input
          id="bonding_company"
          name="bonding_company"
          placeholder="Bonding company name"
          defaultValue={profile?.bonding_company ?? ""}
        />
        <Input
          id="bonding_address"
          name="bonding_address"
          placeholder="Address"
          defaultValue={profile?.bonding_address ?? ""}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            id="bonding_city"
            name="bonding_city"
            placeholder="City"
            defaultValue={profile?.bonding_city ?? ""}
          />
          <Input
            id="bonding_state"
            name="bonding_state"
            placeholder="State"
            defaultValue={profile?.bonding_state ?? ""}
          />
          <Input
            id="bonding_zip"
            name="bonding_zip"
            placeholder="Zip"
            defaultValue={profile?.bonding_zip ?? ""}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="is_default" name="is_default" defaultChecked={profile?.is_default} />
        <Label htmlFor="is_default" className="font-normal">
          Set as default for this trade
        </Label>
      </div>
    </div>
  );
}
