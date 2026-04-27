alter table public.service_cards
add column if not exists icon_image_url text not null default '';
