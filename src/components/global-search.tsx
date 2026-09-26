"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Landmark, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { tradeLabel } from "@/lib/jobs/trade";

type JobResult = {
  id: string;
  job_number: string | null;
  client_name: string | null;
  address: string | null;
  trade_type: string | null;
  jurisdiction: string | null;
};
type ContractorResult = {
  id: string;
  company_name: string | null;
  trade: string | null;
  contact_name: string | null;
};
type HoaResult = { id: string; name: string | null };

// Debounced global search across the three entities the "connected by Job #"
// workflow revolves around — jobs, contractors, and HOAs — so the team can
// jump straight to a record instead of hunting through each tool's own page.
export function GlobalSearch({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<JobResult[]>([]);
  const [contractors, setContractors] = useState<ContractorResult[]>([]);
  const [hoas, setHoas] = useState<HoaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runSearch = useCallback(
    async (term: string) => {
      if (term.trim().length < 2) {
        setJobs([]);
        setContractors([]);
        setHoas([]);
        return;
      }
      setLoading(true);
      const supabase = createClient();
      const like = `%${term.trim()}%`;
      const [jobsRes, contractorsRes, hoasRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, job_number, client_name, address, trade_type, jurisdiction")
          .eq("org_id", orgId)
          .or(
            `job_number.ilike.${like},client_name.ilike.${like},address.ilike.${like}`,
          )
          .limit(6),
        supabase
          .from("contractor_profiles")
          .select("id, company_name, trade, contact_name")
          .eq("org_id", orgId)
          .ilike("company_name", like)
          .limit(5),
        supabase
          .from("hoas")
          .select("id, name")
          .eq("org_id", orgId)
          .ilike("name", like)
          .limit(5),
      ]);
      setJobs(jobsRes.data ?? []);
      setContractors(contractorsRes.data ?? []);
      setHoas(hoasRes.data ?? []);
      setLoading(false);
    },
    [orgId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    router.push(path);
  };

  const hasResults = jobs.length > 0 || contractors.length > 0 || hoas.length > 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 w-8 justify-center gap-2 p-0 text-muted-foreground sm:w-48 sm:justify-start sm:px-3 md:w-64"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden truncate text-xs sm:inline">Search jobs, contractors, HOAs…</span>
        <CommandShortcut className="ml-auto hidden md:inline-flex">⌘K</CommandShortcut>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global search"
        description="Search jobs, contractors, and HOAs"
      >
        <CommandInput
          placeholder="Search by job #, client, address, contractor, or HOA…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : !hasResults ? (
            <CommandEmpty>No matches for &ldquo;{query}&rdquo;.</CommandEmpty>
          ) : (
            <>
              {jobs.length > 0 && (
                <CommandGroup heading="Jobs">
                  {jobs.map((job) => (
                    <CommandItem
                      key={job.id}
                      value={`job-${job.id}`}
                      onSelect={() => go(`/jobs/${job.id}`)}
                    >
                      <Briefcase />
                      <div className="flex flex-col">
                        <span>
                          {job.job_number ?? "Untitled job"}
                          {job.client_name ? ` — ${job.client_name}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            job.trade_type ? tradeLabel(job.trade_type) : null,
                            job.jurisdiction,
                            job.address,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {contractors.length > 0 && (
                <CommandGroup heading="Contractors">
                  {contractors.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`contractor-${c.id}`}
                      onSelect={() => go("/contractors")}
                    >
                      <Building2 />
                      <div className="flex flex-col">
                        <span>{c.company_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[c.trade ? tradeLabel(c.trade) : null, c.contact_name]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {hoas.length > 0 && (
                <CommandGroup heading="HOAs">
                  {hoas.map((h) => (
                    <CommandItem
                      key={h.id}
                      value={`hoa-${h.id}`}
                      onSelect={() => go("/hoa")}
                    >
                      <Landmark />
                      <span>{h.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
