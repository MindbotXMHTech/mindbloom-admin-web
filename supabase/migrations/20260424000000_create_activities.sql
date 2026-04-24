create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_th text not null,
  title_en text not null,
  summary_th text,
  summary_en text,
  content_th text not null,
  content_en text not null,
  cover_image_url text not null,
  gallery_image_urls text[] not null default '{}',
  youtube_url text,
  event_date date,
  status text not null default 'draft',
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_status_check
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists activities_status_idx on public.activities (status);
create index if not exists activities_sort_order_idx on public.activities (sort_order);
create index if not exists activities_event_date_idx on public.activities (event_date desc);

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
before update on public.activities
for each row
execute function public.set_updated_at();

alter table public.activities enable row level security;

drop policy if exists "public_read_published_activities" on public.activities;
create policy "public_read_published_activities"
on public.activities
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "admin_manage_activities" on public.activities;
create policy "admin_manage_activities"
on public.activities
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
