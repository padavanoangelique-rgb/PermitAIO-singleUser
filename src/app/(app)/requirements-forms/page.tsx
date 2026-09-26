import { redirect } from "next/navigation";

/** Old nav URL. Checklist now lives on Forms Library. Mapping unchanged. */
export default function RequirementsFormsRedirectPage() {
  redirect("/forms-library");
}
