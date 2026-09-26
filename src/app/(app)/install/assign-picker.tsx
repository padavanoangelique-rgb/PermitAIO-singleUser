"use client";

import type { InstallMember } from "./install-dashboard";

export function person(m?: InstallMember) {
  if (!m) return "Unassigned";
  return m.display_name?.trim() || m.email;
}

/**
 * One-click "tap a name to assign" pill picker — shared by the Ready to
 * Schedule board and the Account Manager view so the account manager /
 * PM / installer assignment UI is defined once instead of three times.
 * `hiddenFields` carries whatever the target server action needs beyond
 * the picked id (job identifiers, and the other role's current value so a
 * single-field click doesn't clobber it).
 */
export function AssignPicker({
  action,
  hiddenFields,
  fieldName,
  currentId,
  options,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  fieldName: string;
  currentId: string | null | undefined;
  options: InstallMember[];
  label: string;
}) {
  if (!options.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((m) => {
          const active = currentId === m.id;
          return (
            <form key={m.id} action={action}>
              {Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <input type="hidden" name={fieldName} value={m.id} />
              <button
                type="submit"
                className={`h-8 rounded-full px-3 text-sm font-semibold shadow-sm transition ${
                  active
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {person(m)}
              </button>
            </form>
          );
        })}
        {currentId ? (
          <form action={action}>
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name={fieldName} value="" />
            <button type="submit" className="min-h-9 rounded-full px-3 py-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline">
              Clear
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
