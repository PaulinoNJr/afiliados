-- Execute este script no SQL Editor do Supabase.

create schema if not exists extensions;

create extension if not exists pgcrypto;
create extension if not exists unaccent with schema extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'unaccent'
      and extnamespace = 'public'::regnamespace
  ) then
    execute 'alter extension unaccent set schema extensions';
  end if;
end;
$$;

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
set search_path = pg_catalog, public, extensions
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'),
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
    'ativacao',
    'loja',
    'produtos'
  ]);
$$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_email text,
  role text not null default 'advertiser',
  account_type text not null default 'advertiser',
  company_name text,
  first_name text,
  last_name text,
  phone text,
  store_name text,
  slug text,
  slug_changed_at timestamptz,
  activation_status text,
  activation_requested_at timestamptz,
  activation_email_sent_at timestamptz,
  activation_expires_at timestamptz,
  activation_confirmed_at timestamptz,
  headline text,
  accent_color text,
  text_color text,
  page_background text,
  button_text_color text,
  button_style text,
  card_style text,
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
  add column if not exists account_type text,
  add column if not exists company_name text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists store_name text,
  add column if not exists slug text,
  add column if not exists slug_changed_at timestamptz,
  add column if not exists activation_status text,
  add column if not exists activation_requested_at timestamptz,
  add column if not exists activation_email_sent_at timestamptz,
  add column if not exists activation_expires_at timestamptz,
  add column if not exists activation_confirmed_at timestamptz,
  add column if not exists headline text,
  add column if not exists accent_color text,
  add column if not exists text_color text,
  add column if not exists page_background text,
  add column if not exists button_text_color text,
  add column if not exists button_style text,
  add column if not exists card_style text,
  add column if not exists cta_label text,
  add column if not exists bio text,
  add column if not exists photo_url text,
  add column if not exists banner_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.user_profiles
  alter column role set default 'advertiser',
  alter column role set not null,
  alter column account_type set default 'advertiser',
  alter column account_type set not null,
  alter column activation_status set default 'pending',
  alter column activation_requested_at set default now(),
  alter column activation_email_sent_at set default now(),
  alter column accent_color set default '#0d6efd',
  alter column text_color set default '#152238',
  alter column page_background set default '#f3f6fb',
  alter column button_text_color set default '#ffffff',
  alter column button_style set default 'solid',
  alter column card_style set default 'soft',
  alter column cta_label set default 'Ver produto';

update public.user_profiles
set role = 'advertiser'
where role is null;

update public.user_profiles
set role = 'advertiser'
where role = 'produtor';

update public.user_profiles
set account_type = case
  when role = 'affiliate' then 'affiliate'
  else 'advertiser'
end
where account_type is null
   or trim(account_type) = '';

update public.user_profiles
set activation_status = 'active'
where activation_status is null;

update public.user_profiles
set activation_requested_at = created_at
where activation_requested_at is null;

update public.user_profiles
set activation_email_sent_at = activation_requested_at
where activation_email_sent_at is null;

update public.user_profiles
set activation_expires_at = activation_requested_at + interval '5 days'
where activation_expires_at is null;

update public.user_profiles
set activation_confirmed_at = coalesce(activation_confirmed_at, activation_requested_at)
where activation_status = 'active'
  and activation_confirmed_at is null;

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
  new.role := lower(nullif(trim(coalesce(new.role, '')), ''));
  if new.role is null or new.role = 'produtor' then
    new.role := 'advertiser';
  elsif new.role not in ('admin', 'advertiser', 'affiliate') then
    raise exception 'Perfil de acesso invalido.';
  end if;

  new.account_type := lower(nullif(trim(coalesce(new.account_type, '')), ''));
  if new.account_type is null then
    new.account_type := case
      when new.role = 'affiliate' then 'affiliate'
      else 'advertiser'
    end;
  elsif new.account_type not in ('advertiser', 'affiliate') then
    raise exception 'Tipo de conta invalido.';
  end if;

  if new.role = 'admin' then
    new.account_type := 'advertiser';
  elsif new.account_type = 'affiliate' then
    new.role := 'affiliate';
  elsif new.role <> 'admin' then
    new.role := 'advertiser';
  end if;

  new.company_name := nullif(trim(coalesce(new.company_name, '')), '');
  new.first_name := nullif(trim(coalesce(new.first_name, '')), '');
  new.last_name := nullif(trim(coalesce(new.last_name, '')), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  new.headline := nullif(trim(coalesce(new.headline, '')), '');
  new.cta_label := nullif(trim(coalesce(new.cta_label, '')), '');
  new.photo_url := nullif(trim(coalesce(new.photo_url, '')), '');
  new.bio := nullif(trim(coalesce(new.bio, '')), '');
  new.banner_url := nullif(trim(coalesce(new.banner_url, '')), '');
  new.accent_color := lower(nullif(trim(coalesce(new.accent_color, '')), ''));
  new.text_color := lower(nullif(trim(coalesce(new.text_color, '')), ''));
  new.page_background := lower(nullif(trim(coalesce(new.page_background, '')), ''));
  new.button_text_color := lower(nullif(trim(coalesce(new.button_text_color, '')), ''));
  new.button_style := lower(nullif(trim(coalesce(new.button_style, '')), ''));
  new.card_style := lower(nullif(trim(coalesce(new.card_style, '')), ''));

  if new.accent_color is null then
    new.accent_color := '#0d6efd';
  elsif new.accent_color !~ '^#([0-9a-f]{6}|[0-9a-f]{3})$' then
    raise exception 'Cor de destaque invalida.';
  end if;

  if new.text_color is null then
    new.text_color := '#152238';
  elsif new.text_color !~ '^#([0-9a-f]{6}|[0-9a-f]{3})$' then
    raise exception 'Cor do texto invalida.';
  end if;

  if new.page_background is null then
    new.page_background := '#f3f6fb';
  elsif new.page_background !~ '^#([0-9a-f]{6}|[0-9a-f]{3})$' then
    raise exception 'Cor de fundo invalida.';
  end if;

  if new.button_text_color is null then
    new.button_text_color := '#ffffff';
  elsif new.button_text_color !~ '^#([0-9a-f]{6}|[0-9a-f]{3})$' then
    raise exception 'Cor do botao invalida.';
  end if;

  if new.button_style is null then
    new.button_style := 'solid';
  elsif new.button_style not in ('solid', 'outline', 'pill') then
    raise exception 'Estilo de botao invalido.';
  end if;

  if new.card_style is null then
    new.card_style := 'soft';
  elsif new.card_style not in ('soft', 'outline', 'glass') then
    raise exception 'Estilo de card invalido.';
  end if;

  if new.cta_label is null then
    new.cta_label := 'Ver produto';
  end if;

  new.activation_status := lower(nullif(trim(coalesce(new.activation_status, '')), ''));
  if new.activation_status is null then
    new.activation_status := 'pending';
  elsif new.activation_status not in ('pending', 'active', 'expired') then
    raise exception 'Status de ativacao invalido.';
  end if;

  fallback_store_name := coalesce(
    case when new.role = 'advertiser' then new.company_name else null end,
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

  if tg_op = 'UPDATE' then
    if new.slug is distinct from old.slug then
      if old.slug_changed_at is not null and old.slug_changed_at > now() - interval '7 days' then
        raise exception 'O slug so pode ser alterado uma vez a cada 7 dias.';
      end if;

      new.slug_changed_at := now();
    else
      new.slug_changed_at := old.slug_changed_at;
    end if;
  elsif new.slug_changed_at is null then
    new.slug_changed_at := now() - interval '8 days';
  end if;

  if tg_op = 'INSERT' then
    new.activation_requested_at := coalesce(new.activation_requested_at, now());
    new.activation_email_sent_at := coalesce(new.activation_email_sent_at, new.activation_requested_at);
  else
    new.activation_requested_at := coalesce(new.activation_requested_at, old.activation_requested_at);
    new.activation_email_sent_at := coalesce(new.activation_email_sent_at, old.activation_email_sent_at);

    if new.activation_status is distinct from old.activation_status then
      if new.activation_status = 'active' and old.activation_status <> 'active' then
        new.activation_confirmed_at := coalesce(new.activation_confirmed_at, now());
      elsif new.activation_status <> 'active' then
        new.activation_confirmed_at := null;
      end if;
    else
      new.activation_confirmed_at := old.activation_confirmed_at;
    end if;
  end if;

  new.activation_expires_at := coalesce(
    new.activation_expires_at,
    new.activation_requested_at + interval '5 days'
  );

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
  account_type_value text;
  role_value text;
  company_name_value text;
  first_name_value text;
  last_name_value text;
  phone_value text;
  photo_url_value text;
  slug_value text;
  generated_store_name text;
begin
  account_type_value := lower(nullif(trim(meta ->> 'account_type'), ''));
  if account_type_value is null then
    account_type_value := 'advertiser';
  elsif account_type_value not in ('advertiser', 'affiliate') then
    account_type_value := 'advertiser';
  end if;

  role_value := case
    when account_type_value = 'affiliate' then 'affiliate'
    else 'advertiser'
  end;

  company_name_value := nullif(trim(meta ->> 'company_name'), '');
  first_name_value := nullif(trim(meta ->> 'first_name'), '');
  last_name_value := nullif(trim(meta ->> 'last_name'), '');
  phone_value := nullif(trim(meta ->> 'phone'), '');
  photo_url_value := nullif(trim(meta ->> 'photo_url'), '');
  slug_value := nullif(trim(meta ->> 'slug'), '');

  generated_store_name := coalesce(
    case when role_value = 'advertiser' then company_name_value else null end,
    nullif(trim(concat_ws(' ', first_name_value, last_name_value)), ''),
    nullif(initcap(replace(split_part(coalesce(new.email, ''), '@', 1), '.', ' ')), ''),
    'Minha loja'
  );

  insert into public.user_profiles (
    user_id,
    user_email,
    role,
    account_type,
    company_name,
    first_name,
    last_name,
    phone,
    photo_url,
    store_name,
    slug,
    activation_status,
    activation_requested_at,
    activation_email_sent_at,
    activation_expires_at
  )
  values (
    new.id,
    new.email,
    role_value,
    account_type_value,
    company_name_value,
    first_name_value,
    last_name_value,
    phone_value,
    photo_url_value,
    generated_store_name,
    public.generate_unique_store_slug(coalesce(slug_value, generated_store_name), new.id),
    'pending',
    now(),
    now(),
    now() + interval '5 days'
  )
  on conflict (user_id) do update
    set user_email = excluded.user_email,
        role = coalesce(user_profiles.role, excluded.role),
        account_type = coalesce(user_profiles.account_type, excluded.account_type),
        company_name = coalesce(user_profiles.company_name, excluded.company_name),
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
set text_color = '#152238'
where text_color is null
   or trim(text_color) = '';

update public.user_profiles
set page_background = '#f3f6fb'
where page_background is null
   or trim(page_background) = '';

update public.user_profiles
set button_text_color = '#ffffff'
where button_text_color is null
   or trim(button_text_color) = '';

update public.user_profiles
set button_style = 'solid'
where button_style is null
   or trim(button_style) = '';

update public.user_profiles
set card_style = 'soft'
where card_style is null
   or trim(card_style) = '';

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

update public.user_profiles
set slug_changed_at = now() - interval '8 days'
where slug_changed_at is null;

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
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_role_check'
  ) then
    alter table public.user_profiles
      drop constraint user_profiles_role_check;
  end if;

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

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_user_profiles_activation_status_valid'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint ck_user_profiles_activation_status_valid
      check (activation_status in ('pending', 'active', 'expired'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_user_profiles_role_valid'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint ck_user_profiles_role_valid
      check (role in ('admin', 'advertiser', 'affiliate'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_user_profiles_account_type_valid'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint ck_user_profiles_account_type_valid
      check (account_type in ('advertiser', 'affiliate'));
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

create or replace function public.is_advertiser_or_admin(target_profile_id uuid default auth.uid())
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
      and profile.user_id = target_profile_id
      and profile.role in ('admin', 'advertiser')
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

create or replace function public.finalize_account_activation()
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
begin
  select *
  into current_profile
  from public.user_profiles
  where user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if current_profile.activation_status = 'active' then
    return current_profile;
  end if;

  if current_profile.activation_expires_at is not null and current_profile.activation_expires_at < now() then
    update public.user_profiles
    set activation_status = 'expired'
    where user_id = current_profile.user_id;

    raise exception 'O prazo para ativacao expirou. Solicite um novo email de ativacao.';
  end if;

  update public.user_profiles
  set activation_status = 'active',
      activation_confirmed_at = now()
  where user_id = current_profile.user_id
  returning *
  into current_profile;

  return current_profile;
end;
$$;

drop trigger if exists trg_user_profiles_role_guard on public.user_profiles;
create trigger trg_user_profiles_role_guard
before update on public.user_profiles
for each row
execute function public.prevent_unauthorized_role_change();

drop view if exists public.public_store_profiles;
create view public.public_store_profiles
with (security_invoker = true) as
select
  profile.user_id as id,
  profile.photo_url,
  profile.store_name,
  profile.slug,
  profile.headline,
  profile.accent_color,
  profile.text_color,
  profile.page_background,
  profile.button_text_color,
  profile.button_style,
  profile.card_style,
  profile.cta_label,
  profile.bio,
  profile.banner_url
from public.user_profiles profile
where profile.slug is not null
  and profile.slug <> '';

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_categories
  add column if not exists profile_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_product_categories_profile_id on public.product_categories (profile_id);
create index if not exists idx_product_categories_sort_order on public.product_categories (profile_id, sort_order asc, created_at asc);
create unique index if not exists idx_product_categories_profile_slug on public.product_categories (profile_id, slug);
create unique index if not exists idx_product_categories_profile_name on public.product_categories (profile_id, lower(name));

create or replace function public.generate_unique_category_slug(
  base_value text,
  target_profile_id uuid,
  current_category_id uuid default null
)
returns text
language plpgsql
set search_path = public
as $$
declare
  normalized_base text := public.normalize_slug(base_value);
  candidate text;
  suffix integer := 1;
begin
  if target_profile_id is null then
    raise exception 'Perfil da categoria nao informado.';
  end if;

  if normalized_base is null or normalized_base = '' then
    normalized_base := 'categoria';
  end if;

  candidate := normalized_base;

  while exists (
    select 1
    from public.product_categories category_item
    where category_item.profile_id = target_profile_id
      and category_item.slug = candidate
      and (current_category_id is null or category_item.id <> current_category_id)
  ) loop
    suffix := suffix + 1;
    candidate := normalized_base || '-' || suffix::text;
  end loop;

  return candidate;
end;
$$;

create or replace function public.prepare_product_category()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  highest_sort_order integer;
begin
  new.name := nullif(trim(coalesce(new.name, '')), '');
  new.slug := nullif(trim(coalesce(new.slug, '')), '');

  if new.profile_id is null then
    raise exception 'Perfil da categoria nao informado.';
  end if;

  if new.name is null then
    raise exception 'Informe o nome da categoria.';
  end if;

  if new.slug is null then
    new.slug := public.generate_unique_category_slug(new.name, new.profile_id, new.id);
  else
    new.slug := public.generate_unique_category_slug(new.slug, new.profile_id, new.id);
  end if;

  if new.sort_order is null then
    select coalesce(max(category_item.sort_order), -1)
    into highest_sort_order
    from public.product_categories category_item
    where category_item.profile_id = new.profile_id
      and (tg_op = 'INSERT' or category_item.id <> new.id);

    new.sort_order := highest_sort_order + 1;
  end if;

  if new.sort_order < 0 then
    new.sort_order := 0;
  end if;

  return new;
end;
$$;

create or replace function public.ensure_default_product_category(target_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_category_id uuid;
begin
  if target_profile_id is null then
    raise exception 'Perfil da categoria nao informado.';
  end if;

  select category_item.id
  into existing_category_id
  from public.product_categories category_item
  where category_item.profile_id = target_profile_id
  order by category_item.sort_order asc, category_item.created_at asc
  limit 1;

  if existing_category_id is not null then
    return existing_category_id;
  end if;

  insert into public.product_categories (profile_id, name, slug, sort_order)
  values (target_profile_id, 'Geral', 'geral', 0)
  returning id into existing_category_id;

  return existing_category_id;
exception
  when unique_violation then
    select category_item.id
    into existing_category_id
    from public.product_categories category_item
    where category_item.profile_id = target_profile_id
    order by category_item.sort_order asc, category_item.created_at asc
    limit 1;

    return existing_category_id;
end;
$$;

create or replace function public.ensure_profile_has_default_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'advertiser' then
    perform public.ensure_default_product_category(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_categories_prepare on public.product_categories;
create trigger trg_product_categories_prepare
before insert or update on public.product_categories
for each row
execute function public.prepare_product_category();

drop trigger if exists trg_product_categories_updated_at on public.product_categories;
create trigger trg_product_categories_updated_at
before update on public.product_categories
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_profiles_default_category on public.user_profiles;
create trigger trg_user_profiles_default_category
after insert on public.user_profiles
for each row
execute function public.ensure_profile_has_default_category();

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
  profile_id uuid references auth.users(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete restrict
);

alter table public.produtos
  add column if not exists source_url text,
  add column if not exists ml_item_id text,
  add column if not exists ml_currency text,
  add column if not exists ml_permalink text,
  add column if not exists ml_thumbnail text,
  add column if not exists ml_pictures jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists profile_id uuid references auth.users(id) on delete cascade,
  add column if not exists category_id uuid references public.product_categories(id) on delete restrict;

select public.ensure_default_product_category(profile.user_id)
from public.user_profiles profile
where profile.user_id is not null
  and profile.role = 'advertiser';

select public.ensure_default_product_category(existing_products.profile_id)
from (
  select distinct product.profile_id
  from public.produtos product
  where product.profile_id is not null
) existing_products;

update public.produtos
set profile_id = created_by
where profile_id is null
  and created_by is not null;

update public.produtos
set created_by = profile_id
where created_by is null
  and profile_id is not null;

update public.produtos product
set category_id = (
  select category_item.id
  from public.product_categories category_item
  where category_item.profile_id = product.profile_id
  order by category_item.sort_order asc, category_item.created_at asc
  limit 1
)
where product.category_id is null
  and product.profile_id is not null;

alter table public.produtos
  alter column created_by set not null,
  alter column profile_id set not null,
  alter column category_id set not null;

create or replace function public.sync_product_profile_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  category_profile_id uuid;
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

  if new.profile_id is not null and new.category_id is null then
    new.category_id := public.ensure_default_product_category(new.profile_id);
  end if;

  if new.category_id is not null then
    select category_item.profile_id
    into category_profile_id
    from public.product_categories category_item
    where category_item.id = new.category_id;

    if category_profile_id is null then
      raise exception 'Categoria nao encontrada.';
    end if;

    if new.profile_id is null then
      new.profile_id := category_profile_id;
      new.created_by := category_profile_id;
    elsif category_profile_id <> new.profile_id then
      raise exception 'A categoria selecionada nao pertence ao perfil informado.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_invalid_category_delete()
returns trigger
language plpgsql
set search_path = public, auth
as $$
declare
  remaining_count integer;
  auth_user_exists boolean;
begin
  select exists (
    select 1
    from auth.users auth_user
    where auth_user.id = old.profile_id
  )
  into auth_user_exists;

  if not auth_user_exists then
    return old;
  end if;

  select count(*)
  into remaining_count
  from public.product_categories category_item
  where category_item.profile_id = old.profile_id
    and category_item.id <> old.id;

  if remaining_count <= 0 then
    raise exception 'Mantenha pelo menos uma categoria cadastrada.';
  end if;

  if exists (
    select 1
    from public.produtos product
    where product.category_id = old.id
  ) then
    raise exception 'Nao e possivel excluir uma categoria com produtos vinculados.';
  end if;

  return old;
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

drop trigger if exists trg_product_categories_delete_guard on public.product_categories;
create trigger trg_product_categories_delete_guard
before delete on public.product_categories
for each row
execute function public.prevent_invalid_category_delete();

create index if not exists idx_produtos_created_at on public.produtos (created_at desc);
create index if not exists idx_produtos_created_by on public.produtos (created_by);
create index if not exists idx_produtos_profile_id on public.produtos (profile_id);
create index if not exists idx_produtos_category_id on public.produtos (category_id);

drop view if exists public.public_store_products;
create view public.public_store_products
with (security_invoker = true) as
select
  product.id,
  product.profile_id,
  category_item.id as category_id,
  category_item.name as category_name,
  category_item.slug as category_slug,
  category_item.sort_order as category_sort_order,
  product.titulo,
  product.preco,
  product.imagem_url,
  product.link_afiliado,
  product.descricao,
  product.created_at
from public.produtos product
join public.product_categories category_item
  on category_item.id = product.category_id;

drop function if exists public.get_public_store_by_slug(text);
create function public.get_public_store_by_slug(store_slug text)
returns table (
  id uuid,
  photo_url text,
  store_name text,
  slug text,
  headline text,
  accent_color text,
  text_color text,
  page_background text,
  button_text_color text,
  button_style text,
  card_style text,
  cta_label text,
  bio text,
  banner_url text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    profile.user_id as id,
    profile.photo_url,
    profile.store_name,
    profile.slug,
    profile.headline,
    profile.accent_color,
    profile.text_color,
    profile.page_background,
    profile.button_text_color,
    profile.button_style,
    profile.card_style,
    profile.cta_label,
    profile.bio,
    profile.banner_url
  from public.user_profiles profile
  where profile.slug = public.normalize_slug(store_slug)
  limit 1;
$$;

drop function if exists public.get_public_products_by_profile(uuid);
create function public.get_public_products_by_profile(store_profile_id uuid)
returns table (
  id uuid,
  profile_id uuid,
  category_id uuid,
  category_name text,
  category_slug text,
  category_sort_order integer,
  titulo text,
  preco numeric,
  imagem_url text,
  link_afiliado text,
  descricao text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    product.id,
    product.profile_id,
    category_item.id as category_id,
    category_item.name as category_name,
    category_item.slug as category_slug,
    category_item.sort_order as category_sort_order,
    product.titulo,
    product.preco,
    product.imagem_url,
    product.link_afiliado,
    product.descricao,
    product.created_at
  from public.produtos product
  join public.product_categories category_item
    on category_item.id = product.category_id
  where product.profile_id = store_profile_id
  order by category_item.sort_order asc, lower(category_item.name) asc, product.created_at desc;
$$;

create or replace function public.check_public_slug_availability(store_slug text, current_profile_id uuid default null)
returns table (
  slug text,
  available boolean,
  profile_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with normalized as (
    select public.normalize_slug(store_slug) as slug_value
  ),
  matched as (
    select profile.user_id
    from public.user_profiles profile
    join normalized on profile.slug = normalized.slug_value
    limit 1
  )
  select
    normalized.slug_value as slug,
    case
      when normalized.slug_value is null then false
      when not exists (select 1 from matched) then true
      when current_profile_id is not null and exists (
        select 1 from matched where matched.user_id = current_profile_id
      ) then true
      else false
    end as available,
    (select matched.user_id from matched) as profile_id
  from normalized;
$$;

alter table public.user_profiles enable row level security;
alter table public.product_categories enable row level security;
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

drop policy if exists "Leitura de categorias por dono ou admin" on public.product_categories;
create policy "Leitura de categorias por dono ou admin"
  on public.product_categories
  for select
  to authenticated
  using (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Insercao de categorias por dono ou admin" on public.product_categories;
create policy "Insercao de categorias por dono ou admin"
  on public.product_categories
  for insert
  to authenticated
  with check (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Atualizacao de categorias por dono ou admin" on public.product_categories;
create policy "Atualizacao de categorias por dono ou admin"
  on public.product_categories
  for update
  to authenticated
  using (public.is_advertiser_or_admin(profile_id) or public.is_admin())
  with check (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Exclusao de categorias por dono ou admin" on public.product_categories;
create policy "Exclusao de categorias por dono ou admin"
  on public.product_categories
  for delete
  to authenticated
  using (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Leitura publica de produtos" on public.produtos;
drop policy if exists "Leitura de produtos por dono ou admin" on public.produtos;
create policy "Leitura de produtos por dono ou admin"
  on public.produtos
  for select
  to authenticated
  using (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Insercao por usuario autenticado" on public.produtos;
drop policy if exists "Insercao por dono ou admin" on public.produtos;
create policy "Insercao por dono ou admin"
  on public.produtos
  for insert
  to authenticated
  with check (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Atualizacao por dono ou admin" on public.produtos;
drop policy if exists "Atualizacao somente do dono" on public.produtos;
create policy "Atualizacao por dono ou admin"
  on public.produtos
  for update
  to authenticated
  using (public.is_advertiser_or_admin(profile_id) or public.is_admin())
  with check (public.is_advertiser_or_admin(profile_id) or public.is_admin());

drop policy if exists "Exclusao por dono ou admin" on public.produtos;
drop policy if exists "Exclusao somente do dono" on public.produtos;
create policy "Exclusao por dono ou admin"
  on public.produtos
  for delete
  to authenticated
  using (public.is_advertiser_or_admin(profile_id) or public.is_admin());

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_advertiser_or_admin(uuid) to authenticated;
grant execute on function public.finalize_account_activation() to authenticated;
grant execute on function public.get_public_store_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_products_by_profile(uuid) to anon, authenticated;
grant execute on function public.check_public_slug_availability(text, uuid) to anon, authenticated;
grant select on public.public_store_profiles to anon, authenticated;
grant select on public.public_store_products to anon, authenticated;
grant select, insert, update, delete on public.product_categories to authenticated;
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

insert into public.user_profiles (user_id, role, activation_status, activation_confirmed_at)
select id, 'admin', 'active', now()
from auth.users
where lower(email) = lower('paulino.covabra@gmail.com')
on conflict (user_id)
do update set role = 'admin',
              activation_status = 'active',
              activation_confirmed_at = coalesce(public.user_profiles.activation_confirmed_at, now());
