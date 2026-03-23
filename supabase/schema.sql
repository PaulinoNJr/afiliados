-- Execute este script no SQL Editor do Supabase.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_slug(value text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'),
      '-{2,}',
      '-',
      'g'
    )),
    ''
  );
$$;

create or replace function public.is_reserved_store_slug(value text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(public.normalize_slug(value), '') = any (array[
    'login',
    'dashboard',
    'admin',
    'api',
    'users',
    'cadastro',
    'loja',
    'produtos'
  ]);
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_email text,
  role text not null default 'produtor' check (role in ('admin', 'produtor')),
  first_name text,
  last_name text,
  phone text,
  store_name text,
  slug text,
  headline text,
  accent_color text,
  cta_label text,
  bio text,
  photo_url text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists user_email text,
  add column if not exists role text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists store_name text,
  add column if not exists slug text,
  add column if not exists headline text,
  add column if not exists accent_color text,
  add column if not exists cta_label text,
  add column if not exists bio text,
  add column if not exists photo_url text,
  add column if not exists banner_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
  alter column role set default 'produtor',
  alter column accent_color set default '#0d6efd',
  alter column cta_label set default 'Ver produto';

update public.user_profiles
set role = 'produtor'
where role is null;

create index if not exists idx_user_profiles_user_email on public.user_profiles (lower(user_email));

create or replace function public.generate_unique_store_slug(base_value text, current_user_id uuid default null)
returns text
language plpgsql
set search_path = public
as $$
declare
  normalized_base text := public.normalize_slug(base_value);
  candidate text;
  suffix integer := 1;
begin
  if normalized_base is null or normalized_base = '' then
    normalized_base := 'loja';
  end if;

  if public.is_reserved_store_slug(normalized_base) then
    normalized_base := normalized_base || '-loja';
  end if;

  candidate := normalized_base;

  while exists (
    select 1
    from public.user_profiles profile
    where profile.slug = candidate
      and (current_user_id is null or profile.user_id <> current_user_id)
  ) loop
    suffix := suffix + 1;
    candidate := normalized_base || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.prepare_user_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  fallback_store_name text;
begin
  new.first_name := nullif(trim(coalesce(new.first_name, '')), '');
  new.last_name := nullif(trim(coalesce(new.last_name, '')), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  new.headline := nullif(trim(coalesce(new.headline, '')), '');
  new.cta_label := nullif(trim(coalesce(new.cta_label, '')), '');
  new.photo_url := nullif(trim(coalesce(new.photo_url, '')), '');
  new.bio := nullif(trim(coalesce(new.bio, '')), '');
  new.banner_url := nullif(trim(coalesce(new.banner_url, '')), '');
  new.accent_color := lower(nullif(trim(coalesce(new.accent_color, '')), ''));

  if new.accent_color is null then
    new.accent_color := '#0d6efd';
  elsif new.accent_color !~ '^#([0-9a-f]{6}|[0-9a-f]{3})$' then
    raise exception 'Cor de destaque invalida.';
  end if;

  if new.cta_label is null then
    new.cta_label := 'Ver produto';
  end if;

  fallback_store_name := coalesce(
    nullif(trim(new.store_name), ''),
    nullif(trim(concat_ws(' ', new.first_name, new.last_name)), ''),
    nullif(initcap(replace(split_part(coalesce(new.user_email, ''), '@', 1), '.', ' ')), ''),
    'Minha loja'
  );

  new.store_name := fallback_store_name;

  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.generate_unique_store_slug(fallback_store_name, new.user_id);
  else
    new.slug := public.normalize_slug(new.slug);
  end if;

  if new.slug is null or new.slug = '' then
    raise exception 'Slug inválido.';
  end if;

  if public.is_reserved_store_slug(new.slug) then
    raise exception 'Slug reservado.';
  end if;

  if new.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Slug inválido.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  first_name_value text;
  last_name_value text;
  phone_value text;
  photo_url_value text;
  slug_value text;
  generated_store_name text;
begin
  first_name_value := nullif(trim(meta ->> 'first_name'), '');
  last_name_value := nullif(trim(meta ->> 'last_name'), '');
  phone_value := nullif(trim(meta ->> 'phone'), '');
  photo_url_value := nullif(trim(meta ->> 'photo_url'), '');
  slug_value := nullif(trim(meta ->> 'slug'), '');

  generated_store_name := coalesce(
    nullif(trim(concat_ws(' ', first_name_value, last_name_value)), ''),
    nullif(initcap(replace(split_part(coalesce(new.email, ''), '@', 1), '.', ' ')), ''),
    'Minha loja'
  );

  insert into public.user_profiles (user_id, user_email, role, first_name, last_name, phone, photo_url, store_name, slug)
  values (
    new.id,
    new.email,
    'produtor',
    first_name_value,
    last_name_value,
    phone_value,
    photo_url_value,
    generated_store_name,
    public.generate_unique_store_slug(coalesce(slug_value, generated_store_name), new.id)
  )
  on conflict (user_id) do update
    set user_email = excluded.user_email,
        first_name = coalesce(user_profiles.first_name, excluded.first_name),
        last_name = coalesce(user_profiles.last_name, excluded.last_name),
        phone = coalesce(user_profiles.phone, excluded.phone),
        photo_url = coalesce(user_profiles.photo_url, excluded.photo_url);

  return new;
end;
$$;

create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_profiles
  set user_email = new.email
  where user_id = new.id;

  return new;
end;
$$;

update public.user_profiles profile
set user_email = auth_user.email
from auth.users auth_user
where auth_user.id = profile.user_id
  and (profile.user_email is null or profile.user_email <> auth_user.email);

update public.user_profiles
set store_name = coalesce(
  nullif(trim(store_name), ''),
  nullif(trim(concat_ws(' ', first_name, last_name)), ''),
  nullif(initcap(replace(split_part(coalesce(user_email, ''), '@', 1), '.', ' ')), ''),
  'Minha loja'
);

update public.user_profiles
set accent_color = '#0d6efd'
where accent_color is null
   or trim(accent_color) = '';

update public.user_profiles
set cta_label = 'Ver produto'
where cta_label is null
   or trim(cta_label) = '';

update public.user_profiles profile
set slug = public.generate_unique_store_slug(
  coalesce(profile.slug, profile.store_name, profile.user_email, profile.user_id::text),
  profile.user_id
)
where profile.slug is null
   or trim(profile.slug) = '';

alter table public.user_profiles
  alter column store_name set not null,
  alter column slug set not null;

drop trigger if exists trg_user_profiles_prepare on public.user_profiles;
create trigger trg_user_profiles_prepare
before insert or update on public.user_profiles
for each row
execute function public.prepare_user_profile();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

drop trigger if exists trg_auth_user_email_updated on auth.users;
create trigger trg_auth_user_email_updated
after update of email on auth.users
for each row
execute function public.handle_auth_user_email_change();

create unique index if not exists idx_user_profiles_slug on public.user_profiles (slug);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_user_profiles_slug_valid'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint ck_user_profiles_slug_valid
      check (
        slug = public.normalize_slug(slug)
        and slug <> ''
        and not public.is_reserved_store_slug(slug)
      );
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles profile
    where profile.user_id = auth.uid()
      and profile.role = 'admin'
  );
$$;

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Somente administradores podem alterar o perfil de acesso.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_role_guard on public.user_profiles;
create trigger trg_user_profiles_role_guard
before update on public.user_profiles
for each row
execute function public.prevent_unauthorized_role_change();

drop view if exists public.public_store_profiles;
create view public.public_store_profiles as
select
  profile.user_id as id,
  profile.first_name,
  profile.last_name,
  profile.phone,
  profile.photo_url,
  profile.store_name,
  profile.slug,
  profile.headline,
  profile.accent_color,
  profile.cta_label,
  profile.bio,
  profile.banner_url,
  profile.created_at,
  profile.updated_at
from public.user_profiles profile
where profile.slug is not null
  and profile.slug <> '';

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  preco numeric(12,2) not null check (preco >= 0),
  imagem_url text,
  link_afiliado text not null,
  descricao text,
  source_url text,
  ml_item_id text,
  ml_currency text,
  ml_permalink text,
  ml_thumbnail text,
  ml_pictures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete cascade,
  profile_id uuid references auth.users(id) on delete cascade
);

alter table public.produtos
  add column if not exists source_url text,
  add column if not exists ml_item_id text,
  add column if not exists ml_currency text,
  add column if not exists ml_permalink text,
  add column if not exists ml_thumbnail text,
  add column if not exists ml_pictures jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists profile_id uuid references auth.users(id) on delete cascade;

update public.produtos
set profile_id = created_by
where profile_id is null
  and created_by is not null;

update public.produtos
set created_by = profile_id
where created_by is null
  and profile_id is not null;

alter table public.produtos
  alter column created_by set not null,
  alter column profile_id set not null;

create or replace function public.sync_product_profile_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.profile_id is null and new.created_by is null then
    new.profile_id := auth.uid();
    new.created_by := auth.uid();
  elsif new.profile_id is null then
    new.profile_id := new.created_by;
  elsif new.created_by is null then
    new.created_by := new.profile_id;
  elsif new.profile_id <> new.created_by then
    new.created_by := new.profile_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_produtos_profile_sync on public.produtos;
create trigger trg_produtos_profile_sync
before insert or update on public.produtos
for each row
execute function public.sync_product_profile_id();

drop trigger if exists trg_produtos_updated_at on public.produtos;
create trigger trg_produtos_updated_at
before update on public.produtos
for each row
execute function public.set_updated_at();

create index if not exists idx_produtos_created_at on public.produtos (created_at desc);
create index if not exists idx_produtos_created_by on public.produtos (created_by);
create index if not exists idx_produtos_profile_id on public.produtos (profile_id);

drop view if exists public.public_store_products;
create view public.public_store_products as
select
  product.id,
  product.profile_id,
  product.titulo,
  product.preco,
  product.imagem_url,
  product.link_afiliado,
  product.descricao,
  product.source_url,
  product.created_at,
  product.updated_at
from public.produtos product;

alter table public.user_profiles enable row level security;
alter table public.produtos enable row level security;

drop policy if exists "Perfil proprio ou admin pode ler" on public.user_profiles;
create policy "Perfil proprio ou admin pode ler"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Usuario autenticado pode inserir proprio perfil" on public.user_profiles;
create policy "Usuario autenticado pode inserir proprio perfil"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuario ou admin pode atualizar perfil" on public.user_profiles;
drop policy if exists "Admin pode atualizar perfil" on public.user_profiles;
create policy "Usuario ou admin pode atualizar perfil"
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Leitura publica de produtos" on public.produtos;
drop policy if exists "Leitura de produtos por dono ou admin" on public.produtos;
create policy "Leitura de produtos por dono ou admin"
  on public.produtos
  for select
  to authenticated
  using (auth.uid() = profile_id or public.is_admin());

drop policy if exists "Insercao por usuario autenticado" on public.produtos;
drop policy if exists "Insercao por dono ou admin" on public.produtos;
create policy "Insercao por dono ou admin"
  on public.produtos
  for insert
  to authenticated
  with check (auth.uid() = profile_id or public.is_admin());

drop policy if exists "Atualizacao por dono ou admin" on public.produtos;
drop policy if exists "Atualizacao somente do dono" on public.produtos;
create policy "Atualizacao por dono ou admin"
  on public.produtos
  for update
  to authenticated
  using (auth.uid() = profile_id or public.is_admin())
  with check (auth.uid() = profile_id or public.is_admin());

drop policy if exists "Exclusao por dono ou admin" on public.produtos;
drop policy if exists "Exclusao somente do dono" on public.produtos;
create policy "Exclusao por dono ou admin"
  on public.produtos
  for delete
  to authenticated
  using (auth.uid() = profile_id or public.is_admin());

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant select on public.public_store_profiles to anon, authenticated;
grant select on public.public_store_products to anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.produtos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-assets',
  'store-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Publico pode ver store-assets" on storage.objects;
create policy "Publico pode ver store-assets"
  on storage.objects
  for select
  to public
  using (bucket_id = 'store-assets');

drop policy if exists "Autenticado pode enviar store-assets" on storage.objects;
create policy "Autenticado pode enviar store-assets"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Autenticado pode atualizar store-assets proprios" on storage.objects;
create policy "Autenticado pode atualizar store-assets proprios"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Autenticado pode excluir store-assets proprios" on storage.objects;
create policy "Autenticado pode excluir store-assets proprios"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

insert into public.user_profiles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('paulino.covabra@gmail.com')
on conflict (user_id)
do update set role = 'admin';
