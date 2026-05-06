create table if not exists public.psychologist_topics (
  slug text primary key,
  label_th text not null,
  label_en text not null,
  is_custom boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists psychologist_topics_active_idx on public.psychologist_topics (active);
create index if not exists psychologist_topics_sort_order_idx on public.psychologist_topics (sort_order);

drop trigger if exists psychologist_topics_set_updated_at on public.psychologist_topics;
create trigger psychologist_topics_set_updated_at
before update on public.psychologist_topics
for each row
execute function public.set_updated_at();

alter table public.psychologist_topics enable row level security;

drop policy if exists "public_read_active_psychologist_topics" on public.psychologist_topics;
create policy "public_read_active_psychologist_topics"
on public.psychologist_topics
for select
to anon, authenticated
using (active = true);

drop policy if exists "admin_manage_psychologist_topics" on public.psychologist_topics;
create policy "admin_manage_psychologist_topics"
on public.psychologist_topics
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.psychologist_topics (
  slug,
  label_th,
  label_en,
  is_custom,
  active,
  sort_order
)
values
  ('relationships', 'ความสัมพันธ์', 'Relationships', false, true, 0),
  ('adjustment', 'การปรับตัว', 'Adjustment', false, true, 1),
  ('emotions', 'อารมณ์', 'Emotions', false, true, 2),
  ('burnout', 'Burnout', 'Burnout', false, true, 3),
  ('behavior', 'พฤติกรรม', 'Behavior', false, true, 4),
  ('couple', 'คู่รัก/สมรส', 'Couple / Marriage', false, true, 5),
  ('learning', 'การเรียน', 'Learning', false, true, 6),
  ('friends', 'เพื่อน', 'Friends', false, true, 7),
  ('parenting', 'การเลี้ยงดู', 'Parenting', false, true, 8),
  ('child_adolescent', 'เด็ก & วัยรุ่น', 'Child & Adolescent', false, true, 9),
  ('substance', 'สารเสพติด', 'Substance Use', false, true, 10),
  ('trauma', 'Trauma', 'Trauma', false, true, 11),
  ('family', 'ครอบครัว', 'Family', false, true, 12),
  ('child_rearing', 'ปัญหาการเลี้ยงดูลูก', 'Child Rearing', false, true, 13),
  ('thinking', 'ปัญหาความคิด', 'Thought patterns', false, true, 14),
  ('personality', 'บุคลิกภาพ', 'Personality', false, true, 15),
  ('stress', 'ความเครียด', 'Stress', false, true, 16),
  ('depression', 'ซึมเศร้า', 'Depression', false, true, 17),
  ('work', 'การงาน', 'Work', false, true, 18)
on conflict (slug) do update
set
  label_th = excluded.label_th,
  label_en = excluded.label_en,
  is_custom = excluded.is_custom,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();
