-- Permit-packages bucket cap: 65 MB.
update storage.buckets
set file_size_limit = 68157440
where id = 'permit-packages';
