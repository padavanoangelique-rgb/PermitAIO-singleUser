alter table public.notifications
add column if not exists requested_by uuid references auth.users(id),
add column if not exists recipient_user_id uuid references auth.users(id),
add column if not exists parent_id uuid references public.notifications(id);
