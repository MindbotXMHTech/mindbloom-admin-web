create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own"
on public.admin_users
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_th text not null,
  title_en text not null,
  excerpt_th text,
  excerpt_en text,
  content_th text not null,
  content_en text not null,
  cover_image_url text not null,
  youtube_url text,
  status text not null default 'draft',
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_status_check
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists blog_posts_status_idx on public.blog_posts (status);
create index if not exists blog_posts_sort_order_idx on public.blog_posts (sort_order);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row
execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

create table if not exists public.psychologists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_th text not null,
  name_en text not null,
  nickname_th text,
  nickname_en text,
  license_no text not null,
  photo_url text not null,
  approach_th text not null,
  approach_en text not null,
  value_th text not null,
  value_en text not null,
  quote_th text,
  quote_en text,
  topics text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists psychologists_active_idx on public.psychologists (active);
create index if not exists psychologists_sort_order_idx on public.psychologists (sort_order);

drop trigger if exists psychologists_set_updated_at on public.psychologists;
create trigger psychologists_set_updated_at
before update on public.psychologists
for each row
execute function public.set_updated_at();

alter table public.psychologists enable row level security;

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
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "public_read_published_blog_posts" on public.blog_posts;
create policy "public_read_published_blog_posts"
on public.blog_posts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "admin_manage_blog_posts" on public.blog_posts;
create policy "admin_manage_blog_posts"
on public.blog_posts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public_read_active_psychologists" on public.psychologists;
create policy "public_read_active_psychologists"
on public.psychologists
for select
to anon, authenticated
using (active = true);

drop policy if exists "admin_manage_psychologists" on public.psychologists;
create policy "admin_manage_psychologists"
on public.psychologists
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('content-images', 'content-images', true)
on conflict (id) do nothing;

drop policy if exists "public_read_content_images" on storage.objects;
create policy "public_read_content_images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'content-images');

drop policy if exists "admin_manage_content_images" on storage.objects;
create policy "admin_manage_content_images"
on storage.objects
for all
to authenticated
using (bucket_id = 'content-images' and public.is_admin())
with check (bucket_id = 'content-images' and public.is_admin());
