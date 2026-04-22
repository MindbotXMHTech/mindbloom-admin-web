-- Track whether an admin still needs to complete their initial password setup.
alter table public.admin_users
add column if not exists needs_password_setup boolean not null default false;

-- Existing admins are already set up.
update public.admin_users
set needs_password_setup = false
where needs_password_setup is null;
