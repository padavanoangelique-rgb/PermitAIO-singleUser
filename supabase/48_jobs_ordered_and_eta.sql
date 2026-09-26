-- Job ordered date (when product was ordered) and material ETA (when it should land).
alter table public.jobs
  add column if not exists ordered_date date,
  add column if not exists material_eta date;
