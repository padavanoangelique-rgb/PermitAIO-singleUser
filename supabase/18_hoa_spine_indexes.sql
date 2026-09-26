create extension if not exists pg_trgm;

alter table hoa_spine add column if not exists name_norm text generated always as (lower(trim(name))) stored;

create unique index if not exists hoa_spine_name_norm_uidx on hoa_spine (name_norm);

drop index if exists hoa_spine_name_trgm_idx;
create index if not exists hoa_spine_name_trgm_idx on hoa_spine using gin (name gin_trgm_ops);
