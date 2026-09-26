import { ALL_JURISDICTIONS } from "@/lib/forms/jurisdictions";
import type { FormCounty } from "@/lib/forms/folio";

export type RegistrationPacket = {
  id: string;
  county: string | null;
  jurisdiction: string;
  building_department: string | null;
  building_dept_email: string | null;
  instructions: string | null;
  registration_subject: string | null;
  registration_body: string | null;
  noc_subject: string | null;
  noc_body: string | null;
  public_portal_url?: string | null;
  noc_route?: "email" | "portal" | "address" | string | null;
  noc_route_target?: string | null;
};

export type RegistrationDoc = {
  id: string;
  packet_id: string;
  title: string;
  kind: string;
  file_name: string | null;
  file_data?: string | null;
};

export type ContractorRow = {
  id: string;
  org_id: string;
  company_name: string;
  trade: string;
  license_number: string | null;
  qualifier_name: string | null;
  business_tax_receipt_number: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_default: boolean | null;
  license_expires: string | null;
  insurance_expires: string | null;
  workers_comp_expires: string | null;
  btr_expires: string | null;
  bonding_company: string | null;
  bonding_address: string | null;
  bonding_city: string | null;
  bonding_state: string | null;
  bonding_zip: string | null;
};

export const JURISDICTION_OPTIONS = (Object.entries(ALL_JURISDICTIONS) as [FormCounty, string[]][]).flatMap(
  ([county, cities]) => cities.map((city) => ({ county, city, label: `${city} · ${county}` })),
);
