create table if not exists public.service_cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  icon_key text not null,
  title_primary_th text not null,
  title_primary_en text not null,
  title_secondary_th text not null default '',
  title_secondary_en text not null default '',
  details_th text not null default '',
  details_en text not null default '',
  info_heading_th text not null default '',
  info_heading_en text not null default '',
  info_lines_th text not null default '',
  info_lines_en text not null default '',
  note_lines_th text not null default '',
  note_lines_en text not null default '',
  duration_th text not null default '',
  duration_en text not null default '',
  price_lines text[] not null default '{}',
  extra_th text not null default '',
  extra_en text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_cards_sort_order_idx
on public.service_cards (sort_order);

create index if not exists service_cards_active_idx
on public.service_cards (active);

drop trigger if exists service_cards_set_updated_at on public.service_cards;
create trigger service_cards_set_updated_at
before update on public.service_cards
for each row
execute function public.set_updated_at();

alter table public.service_cards enable row level security;

drop policy if exists "public_read_active_service_cards" on public.service_cards;
create policy "public_read_active_service_cards"
on public.service_cards
for select
to anon, authenticated
using (active = true);

drop policy if exists "admin_manage_service_cards" on public.service_cards;
create policy "admin_manage_service_cards"
on public.service_cards
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.workshop_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_th text not null,
  title_en text not null,
  subtitle_th text not null default '',
  subtitle_en text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_categories_sort_order_idx
on public.workshop_categories (sort_order);

create index if not exists workshop_categories_active_idx
on public.workshop_categories (active);

drop trigger if exists workshop_categories_set_updated_at on public.workshop_categories;
create trigger workshop_categories_set_updated_at
before update on public.workshop_categories
for each row
execute function public.set_updated_at();

alter table public.workshop_categories enable row level security;

drop policy if exists "public_read_active_workshop_categories" on public.workshop_categories;
create policy "public_read_active_workshop_categories"
on public.workshop_categories
for select
to anon, authenticated
using (active = true);

drop policy if exists "admin_manage_workshop_categories" on public.workshop_categories;
create policy "admin_manage_workshop_categories"
on public.workshop_categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.workshop_programs (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.workshop_categories(id) on delete cascade,
  slug text not null unique,
  title_th text not null,
  title_en text not null,
  summary_th text not null default '',
  summary_en text not null default '',
  content_th text not null default '',
  content_en text not null default '',
  gallery_image_urls text[] not null default '{}',
  gallery_style text not null default 'landscape',
  show_cta boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_programs_gallery_style_check
    check (gallery_style in ('square', 'landscape'))
);

create index if not exists workshop_programs_category_sort_idx
on public.workshop_programs (category_id, sort_order);

create index if not exists workshop_programs_active_idx
on public.workshop_programs (active);

drop trigger if exists workshop_programs_set_updated_at on public.workshop_programs;
create trigger workshop_programs_set_updated_at
before update on public.workshop_programs
for each row
execute function public.set_updated_at();

alter table public.workshop_programs enable row level security;

drop policy if exists "public_read_active_workshop_programs" on public.workshop_programs;
create policy "public_read_active_workshop_programs"
on public.workshop_programs
for select
to anon, authenticated
using (active = true);

drop policy if exists "admin_manage_workshop_programs" on public.workshop_programs;
create policy "admin_manage_workshop_programs"
on public.workshop_programs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
