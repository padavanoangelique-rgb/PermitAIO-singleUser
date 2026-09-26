import { requirePlatformAdmin } from "@/lib/data/platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORM_COUNTIES } from "@/lib/forms/folio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformFormsManager, type PlatformFormRow } from "./platform-forms-manager";
import { PlatformFormsMapPicker } from "./platform-forms-map-picker";

export default async function AdminFormsPage() {
  await requirePlatformAdmin();

  const admin = createAdminClient();
  const { data } = await admin
    .from("form_templates")
    .select(
      "id, county, jurisdiction_name, jurisdiction_code, doc_type, title, description, file_name, trade, sort_order, visibility",
    )
    .eq("visibility", "platform")
    .order("county")
    .order("sort_order")
    .order("jurisdiction_name");

  const rows = (data ?? []) as PlatformFormRow[];
  const byCounty = new Map<string, PlatformFormRow[]>();
  for (const county of FORM_COUNTIES) byCounty.set(county, []);
  for (const r of rows) byCounty.get(r.county)?.push(r);

  const totalCount = rows.length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Forms Library — Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform-shared templates every organization uses. Map PDF boxes to job
          fields so name, address, folio, and contractor data typed once fill the pack.
        </p>
      </div>

      <PlatformFormsMapPicker rows={rows} />

      <Card className="py-0">
        <CardHeader className="flex flex-row items-center justify-between pt-4">
          <div>
            <CardTitle className="text-base">
              {totalCount} form{totalCount === 1 ? "" : "s"} across {FORM_COUNTIES.length} counties
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            {FORM_COUNTIES.map((c) => {
              const n = byCounty.get(c)?.length ?? 0;
              return (
                <Badge key={c} variant={n === 0 ? "outline" : "secondary"}>
                  {c}: {n}
                </Badge>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <PlatformFormsManager rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
