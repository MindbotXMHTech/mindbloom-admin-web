-- Admin management fields
alter table public.admin_users
add column if not exists email text,
add column if not exists display_name text,
add column if not exists is_active boolean not null default true,
add column if not exists updated_at timestamptz not null default now();

create unique index if not exists admin_users_email_key
on public.admin_users (email)
where email is not null;

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
before update on public.admin_users
for each row
execute function public.set_updated_at();

-- Backfill any existing admin user emails from Auth.
update public.admin_users au
set email = u.email
from auth.users u
where au.user_id = u.id
  and (au.email is null or au.email = '');

-- Keep access checks tied to active admins only.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and coalesce(au.is_active, true)
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "admin_users_select_own" on public.admin_users;
drop policy if exists "admin_users_select_admin" on public.admin_users;
drop policy if exists "admin_users_select_admin_only" on public.admin_users;

create policy "admin_users_select_own"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

create policy "admin_users_select_admin"
on public.admin_users
for select
to authenticated
using (public.is_admin());
