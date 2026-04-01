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
    'recuperar-senha',
    'loja',
    'produtos',
    'campanhas',
    'links',
    'conversoes',
    'operacoes',
    'comissoes',
    'r'
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

drop trigger if exists trg_user_profiles_role_guard on public.user_profiles;

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
end;
$$;

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Somente administradores podem alterar o perfil de acesso.';
  end if;

  return new;
end;
$$;

alter table public.user_profiles
  alter column role set default 'advertiser',
  alter column account_type set default 'advertiser',
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

alter table public.user_profiles
  alter column role set not null,
  alter column account_type set not null;

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
        raise exception 'O slug só pode ser alterado uma vez a cada 7 dias.';
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
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
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
    raise exception 'Perfil do usuário não encontrado.';
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
    raise exception 'Perfil da categoria não informado.';
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
    raise exception 'Perfil da categoria não informado.';
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
    raise exception 'Perfil da categoria não informado.';
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
      raise exception 'Categoria não encontrada.';
    end if;

    if new.profile_id is null then
      new.profile_id := category_profile_id;
      new.created_by := category_profile_id;
    elsif category_profile_id <> new.profile_id then
      raise exception 'A categoria selecionada não pertence ao perfil informado.';
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
    raise exception 'Não ? possóvel excluir uma categoria com produtos vinculados.';
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

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft',
  commission_type text not null default 'percent',
  commission_value numeric(12,2) not null default 10 check (commission_value >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campaigns
  add column if not exists advertiser_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists status text,
  add column if not exists commission_type text,
  add column if not exists commission_value numeric(12,2) default 10,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.campaigns
set status = 'draft'
where status is null
   or trim(status) = '';

update public.campaigns
set commission_type = 'percent'
where commission_type is null
   or trim(commission_type) = '';

update public.campaigns
set commission_value = 10
where commission_value is null;

alter table public.campaigns
  alter column advertiser_id set not null,
  alter column name set not null,
  alter column status set default 'draft',
  alter column status set not null,
  alter column commission_type set default 'percent',
  alter column commission_type set not null,
  alter column commission_value set default 10,
  alter column commission_value set not null;

create index if not exists idx_campaigns_advertiser_id on public.campaigns (advertiser_id);
create index if not exists idx_campaigns_status on public.campaigns (advertiser_id, status, created_at desc);

create table if not exists public.campaign_products (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null references public.produtos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, product_id)
);

alter table public.campaign_products
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_campaign_products_product_id on public.campaign_products (product_id);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  affiliate_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null references public.produtos(id) on delete cascade,
  destination_url text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliate_links
  add column if not exists code text,
  add column if not exists affiliate_id uuid references auth.users(id) on delete cascade,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade,
  add column if not exists product_id uuid references public.produtos(id) on delete cascade,
  add column if not exists destination_url text,
  add column if not exists status text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.affiliate_links
set status = 'active'
where status is null
   or trim(status) = '';

alter table public.affiliate_links
  alter column code set not null,
  alter column affiliate_id set not null,
  alter column campaign_id set not null,
  alter column product_id set not null,
  alter column destination_url set not null,
  alter column status set default 'active',
  alter column status set not null;

create unique index if not exists idx_affiliate_links_code on public.affiliate_links (code);
create index if not exists idx_affiliate_links_affiliate_id on public.affiliate_links (affiliate_id, created_at desc);
create index if not exists idx_affiliate_links_campaign_product on public.affiliate_links (campaign_id, product_id);

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links(id) on delete cascade,
  affiliate_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  product_id uuid not null references public.produtos(id) on delete cascade,
  session_id text,
  referrer text,
  user_agent text,
  ip_hash text,
  occurred_at timestamptz not null default now()
);

alter table public.clicks
  add column if not exists affiliate_link_id uuid references public.affiliate_links(id) on delete cascade,
  add column if not exists affiliate_id uuid references auth.users(id) on delete cascade,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade,
  add column if not exists product_id uuid references public.produtos(id) on delete cascade,
  add column if not exists session_id text,
  add column if not exists referrer text,
  add column if not exists user_agent text,
  add column if not exists ip_hash text,
  add column if not exists occurred_at timestamptz not null default now();

alter table public.clicks
  alter column affiliate_link_id set not null,
  alter column affiliate_id set not null,
  alter column campaign_id set not null,
  alter column product_id set not null;

create index if not exists idx_clicks_link_id on public.clicks (affiliate_link_id, occurred_at desc);
create index if not exists idx_clicks_affiliate_id on public.clicks (affiliate_id, occurred_at desc);
create index if not exists idx_clicks_campaign_id on public.clicks (campaign_id, occurred_at desc);
create index if not exists idx_clicks_product_id on public.clicks (product_id, occurred_at desc);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings
  add column if not exists key text,
  add column if not exists value jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs
  add column if not exists admin_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists event_type text,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

update public.admin_audit_logs
set metadata = '{}'::jsonb
where metadata is null;

alter table public.admin_audit_logs
  alter column admin_user_id set not null,
  alter column event_type set not null,
  alter column entity_type set not null,
  alter column metadata set not null;

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_logs_admin_user_id on public.admin_audit_logs (admin_user_id, created_at desc);
create index if not exists idx_admin_audit_logs_entity on public.admin_audit_logs (entity_type, entity_id, created_at desc);

create table if not exists public.conversions (
  id uuid primary key default gen_random_uuid(),
  click_id uuid references public.clicks(id) on delete set null,
  affiliate_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  product_id uuid references public.produtos(id) on delete set null,
  external_order_id text,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  net_amount numeric(12,2) check (net_amount is null or net_amount >= 0),
  status text not null default 'pending',
  occurred_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversions
  add column if not exists click_id uuid references public.clicks(id) on delete set null,
  add column if not exists affiliate_id uuid references auth.users(id) on delete cascade,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists product_id uuid references public.produtos(id) on delete set null,
  add column if not exists external_order_id text,
  add column if not exists gross_amount numeric(12,2),
  add column if not exists net_amount numeric(12,2),
  add column if not exists status text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.conversions
set status = 'pending'
where status is null
   or trim(status) = '';

alter table public.conversions
  alter column affiliate_id set not null,
  alter column gross_amount set not null,
  alter column status set default 'pending',
  alter column status set not null;

create unique index if not exists idx_conversions_external_order_id on public.conversions (external_order_id) where external_order_id is not null;
create index if not exists idx_conversions_affiliate_id on public.conversions (affiliate_id, occurred_at desc);
create index if not exists idx_conversions_campaign_id on public.conversions (campaign_id, occurred_at desc);
create index if not exists idx_conversions_product_id on public.conversions (product_id, occurred_at desc);

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'requested',
  notes text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payout_requests
  add column if not exists affiliate_id uuid references auth.users(id) on delete cascade,
  add column if not exists amount numeric(12,2),
  add column if not exists status text,
  add column if not exists notes text,
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists processed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.payout_requests
set status = 'requested'
where status is null
   or trim(status) = '';

alter table public.payout_requests
  alter column affiliate_id set not null,
  alter column amount set not null,
  alter column status set default 'requested',
  alter column status set not null;

create index if not exists idx_payout_requests_affiliate_id on public.payout_requests (affiliate_id, requested_at desc);
create index if not exists idx_payout_requests_status on public.payout_requests (status, requested_at desc);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null unique references public.conversions(id) on delete cascade,
  affiliate_id uuid not null references auth.users(id) on delete cascade,
  payout_request_id uuid references public.payout_requests(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending',
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commissions
  add column if not exists conversion_id uuid references public.conversions(id) on delete cascade,
  add column if not exists affiliate_id uuid references auth.users(id) on delete cascade,
  add column if not exists payout_request_id uuid references public.payout_requests(id) on delete set null,
  add column if not exists amount numeric(12,2),
  add column if not exists status text,
  add column if not exists available_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.commissions
set status = 'pending'
where status is null
   or trim(status) = '';

alter table public.commissions
  alter column conversion_id set not null,
  alter column affiliate_id set not null,
  alter column amount set not null,
  alter column status set default 'pending',
  alter column status set not null;

create unique index if not exists idx_commissions_conversion_id on public.commissions (conversion_id);
create index if not exists idx_commissions_affiliate_id on public.commissions (affiliate_id, status, created_at desc);
create index if not exists idx_commissions_payout_request_id on public.commissions (payout_request_id);

insert into public.settings (key, value)
values ('payout.minimum_amount', jsonb_build_object('amount', 100))
on conflict (key) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_campaigns_status_valid'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint ck_campaigns_status_valid
      check (status in ('draft', 'active', 'paused', 'closed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_campaigns_commission_type_valid'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint ck_campaigns_commission_type_valid
      check (commission_type in ('percent', 'fixed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_affiliate_links_status_valid'
      and conrelid = 'public.affiliate_links'::regclass
  ) then
    alter table public.affiliate_links
      add constraint ck_affiliate_links_status_valid
      check (status in ('active', 'disabled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_conversions_status_valid'
      and conrelid = 'public.conversions'::regclass
  ) then
    alter table public.conversions
      add constraint ck_conversions_status_valid
      check (status in ('pending', 'approved', 'rejected', 'refunded'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_commissions_status_valid'
      and conrelid = 'public.commissions'::regclass
  ) then
    alter table public.commissions
      add constraint ck_commissions_status_valid
      check (status in ('pending', 'approved', 'available', 'paid', 'reversed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_payout_requests_status_valid'
      and conrelid = 'public.payout_requests'::regclass
  ) then
    alter table public.payout_requests
      add constraint ck_payout_requests_status_valid
      check (status in ('requested', 'approved', 'processing', 'paid', 'rejected'));
  end if;
end;
$$;

create or replace function public.generate_affiliate_link_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  generated_code text;
begin
  loop
    generated_code := lower(encode(gen_random_bytes(6), 'hex'));
    exit when not exists (
      select 1
      from public.affiliate_links affiliate_link
      where affiliate_link.code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.prepare_campaign()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := nullif(trim(coalesce(new.name, '')), '');
  new.description := nullif(trim(coalesce(new.description, '')), '');
  new.status := lower(nullif(trim(coalesce(new.status, '')), ''));
  new.commission_type := lower(nullif(trim(coalesce(new.commission_type, '')), ''));

  if new.advertiser_id is null then
    raise exception 'Anunciante da campanha não informado.';
  end if;

  if new.name is null then
    raise exception 'Informe o nome da campanha.';
  end if;

  if new.status is null then
    new.status := 'draft';
  elsif new.status not in ('draft', 'active', 'paused', 'closed') then
    raise exception 'Status da campanha invalido.';
  end if;

  if new.commission_type is null then
    new.commission_type := 'percent';
  elsif new.commission_type not in ('percent', 'fixed') then
    raise exception 'Tipo de comissao invalido.';
  end if;

  if new.commission_value is null or new.commission_value < 0 then
    raise exception 'Valor de comissao invalido.';
  end if;

  if new.ends_at is not null and new.starts_at is not null and new.ends_at < new.starts_at then
    raise exception 'A data final da campanha deve ser posterior ao inicio.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_campaign_product()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  campaign_owner_id uuid;
  product_owner_id uuid;
begin
  select campaign.advertiser_id
  into campaign_owner_id
  from public.campaigns campaign
  where campaign.id = new.campaign_id;

  if campaign_owner_id is null then
    raise exception 'Campanha não encontrada.';
  end if;

  select product.profile_id
  into product_owner_id
  from public.produtos product
  where product.id = new.product_id;

  if product_owner_id is null then
    raise exception 'Produto não encontrado.';
  end if;

  if campaign_owner_id <> product_owner_id then
    raise exception 'O produto deve pertencer ao mesmo anunciante da campanha.';
  end if;

  return new;
end;
$$;

create or replace function public.prepare_affiliate_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  campaign_row public.campaigns;
  product_row public.produtos;
begin
  if new.code is null or trim(new.code) = '' then
    new.code := public.generate_affiliate_link_code();
  else
    new.code := lower(trim(new.code));
  end if;

  if new.code !~ '^[a-z0-9]{8,32}$' then
    raise exception 'Codigo do link rastreavel invalido.';
  end if;

  if new.affiliate_id is null then
    new.affiliate_id := auth.uid();
  end if;

  select *
  into campaign_row
  from public.campaigns campaign
  where campaign.id = new.campaign_id;

  if campaign_row.id is null then
    raise exception 'Campanha não encontrada.';
  end if;

  if campaign_row.status <> 'active' then
    raise exception 'A campanha precisa estar ativa para gerar links.';
  end if;

  if campaign_row.starts_at is not null and campaign_row.starts_at > now() then
    raise exception 'A campanha ainda não iniciou.';
  end if;

  if campaign_row.ends_at is not null and campaign_row.ends_at < now() then
    raise exception 'A campanha ja foi encerrada.';
  end if;

  if not exists (
    select 1
    from public.campaign_products campaign_product
    where campaign_product.campaign_id = new.campaign_id
      and campaign_product.product_id = new.product_id
  ) then
    raise exception 'O produto não está vinculado à campanha.';
  end if;

  select *
  into product_row
  from public.produtos product
  where product.id = new.product_id;

  if product_row.id is null then
    raise exception 'Produto não encontrado.';
  end if;

  new.destination_url := nullif(trim(coalesce(new.destination_url, product_row.link_afiliado)), '');
  if new.destination_url is null then
    raise exception 'URL de destino do link não informada.';
  end if;

  new.status := lower(nullif(trim(coalesce(new.status, '')), ''));
  if new.status is null then
    new.status := 'active';
  elsif new.status not in ('active', 'disabled') then
    raise exception 'Status do link invalido.';
  end if;

  return new;
end;
$$;

create or replace function public.get_affiliate_campaign_catalog()
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_description text,
  commission_type text,
  commission_value numeric,
  advertiser_id uuid,
  advertiser_name text,
  product_id uuid,
  product_title text,
  product_price numeric,
  product_image_url text,
  destination_url text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    campaign.id as campaign_id,
    campaign.name as campaign_name,
    campaign.description as campaign_description,
    campaign.commission_type,
    campaign.commission_value,
    campaign.advertiser_id,
    coalesce(profile.company_name, profile.store_name, profile.user_email, 'Anunciante') as advertiser_name,
    product.id as product_id,
    product.titulo as product_title,
    product.preco as product_price,
    product.imagem_url as product_image_url,
    product.link_afiliado as destination_url
  from public.campaigns campaign
  join public.campaign_products campaign_product
    on campaign_product.campaign_id = campaign.id
  join public.produtos product
    on product.id = campaign_product.product_id
  left join public.user_profiles profile
    on profile.user_id = campaign.advertiser_id
  where campaign.status = 'active'
    and (campaign.starts_at is null or campaign.starts_at <= now())
    and (campaign.ends_at is null or campaign.ends_at >= now())
  order by campaign.created_at desc, product.created_at desc;
$$;

create or replace function public.create_affiliate_link(target_campaign_id uuid, target_product_id uuid)
returns table (
  id uuid,
  code text,
  affiliate_id uuid,
  campaign_id uuid,
  product_id uuid,
  destination_url text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  created_link public.affiliate_links;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role not in ('affiliate', 'admin') then
    raise exception 'Somente afiliados podem gerar links rastreáveis.';
  end if;

  insert into public.affiliate_links (
    affiliate_id,
    campaign_id,
    product_id
  )
  values (
    auth.uid(),
    target_campaign_id,
    target_product_id
  )
  returning *
  into created_link;

  return query
  select
    created_link.id,
    created_link.code,
    created_link.affiliate_id,
    created_link.campaign_id,
    created_link.product_id,
    created_link.destination_url,
    created_link.status,
    created_link.created_at;
end;
$$;

create or replace function public.get_numeric_setting(setting_key text, fallback_value numeric default 0)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored_value jsonb;
  parsed_value numeric;
begin
  select setting_item.value
  into stored_value
  from public.settings setting_item
  where setting_item.key = setting_key
  limit 1;

  begin
    parsed_value := coalesce((stored_value ->> 'amount')::numeric, fallback_value);
  exception
    when others then
      parsed_value := fallback_value;
  end;

  return coalesce(parsed_value, fallback_value);
end;
$$;

create or replace function public.log_admin_audit(
  audit_event_type text,
  audit_entity_type text,
  audit_entity_id uuid default null,
  audit_metadata jsonb default '{}'::jsonb
)
returns public.admin_audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  created_log public.admin_audit_logs;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role <> 'admin' then
    raise exception 'Somente administradores podem registrar auditoria.';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id,
    event_type,
    entity_type,
    entity_id,
    metadata
  )
  values (
    current_profile.user_id,
    nullif(trim(coalesce(audit_event_type, '')), ''),
    nullif(trim(coalesce(audit_entity_type, '')), ''),
    audit_entity_id,
    coalesce(audit_metadata, '{}'::jsonb)
  )
  returning *
  into created_log;

  return created_log;
end;
$$;

create or replace function public.set_payout_minimum_amount(minimum_amount numeric)
returns public.settings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  current_setting public.settings;
  previous_amount numeric;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role <> 'admin' then
    raise exception 'Somente administradores podem alterar configuracoes financeiras.';
  end if;

  if minimum_amount is null or minimum_amount <= 0 then
    raise exception 'Informe um valor minimo de saque valido.';
  end if;

  select *
  into current_setting
  from public.settings setting_item
  where setting_item.key = 'payout.minimum_amount'
  limit 1;

  begin
    previous_amount := (current_setting.value ->> 'amount')::numeric;
  exception
    when others then
      previous_amount := null;
  end;

  insert into public.settings (key, value)
  values (
    'payout.minimum_amount',
    jsonb_build_object('amount', round(minimum_amount::numeric, 2))
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now()
  returning *
  into current_setting;

  perform public.log_admin_audit(
    'update_payout_minimum',
    'settings',
    current_setting.id,
    jsonb_build_object(
      'setting_key', current_setting.key,
      'previous_amount', previous_amount,
      'new_amount', round(minimum_amount::numeric, 2)
    )
  );

  return current_setting;
end;
$$;

create or replace function public.calculate_commission_amount(
  commission_type_value text,
  commission_value numeric,
  base_amount numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if coalesce(base_amount, 0) <= 0 or coalesce(commission_value, 0) <= 0 then
    return 0;
  end if;

  if commission_type_value = 'fixed' then
    return round(commission_value::numeric, 2);
  end if;

  return round((base_amount * commission_value / 100)::numeric, 2);
end;
$$;

create or replace function public.prepare_conversion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.external_order_id := nullif(trim(coalesce(new.external_order_id, '')), '');
  new.status := lower(nullif(trim(coalesce(new.status, '')), ''));

  if new.affiliate_id is null then
    raise exception 'Afiliado da conversão não informado.';
  end if;

  if new.gross_amount is null or new.gross_amount < 0 then
    raise exception 'Valor bruto da conversao invalido.';
  end if;

  if new.net_amount is not null and new.net_amount < 0 then
    raise exception 'Valor liquido da conversao invalido.';
  end if;

  if new.status is null then
    new.status := 'pending';
  elsif new.status not in ('pending', 'approved', 'rejected', 'refunded') then
    raise exception 'Status da conversao invalido.';
  end if;

  if new.status = 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status <> 'approved' then
    new.approved_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_payout_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.status := lower(nullif(trim(coalesce(new.status, '')), ''));
  new.notes := nullif(trim(coalesce(new.notes, '')), '');

  if new.affiliate_id is null then
    raise exception 'Afiliado do saque não informado.';
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'Valor do saque invalido.';
  end if;

  if new.status is null then
    new.status := 'requested';
  elsif new.status not in ('requested', 'approved', 'processing', 'paid', 'rejected') then
    raise exception 'Status do saque invalido.';
  end if;

  if new.status in ('paid', 'rejected') then
    new.processed_at := coalesce(new.processed_at, now());
  elsif new.status = 'requested' then
    new.processed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.sync_commission_from_conversion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  campaign_row public.campaigns;
  base_amount numeric;
  commission_amount numeric;
  commission_status text;
  available_at_value timestamptz;
begin
  if new.campaign_id is null then
    return new;
  end if;

  select *
  into campaign_row
  from public.campaigns campaign
  where campaign.id = new.campaign_id;

  if campaign_row.id is null then
    return new;
  end if;

  base_amount := coalesce(new.net_amount, new.gross_amount, 0);
  commission_amount := public.calculate_commission_amount(
    campaign_row.commission_type,
    campaign_row.commission_value,
    base_amount
  );

  commission_status := case
    when new.status = 'pending' then 'pending'
    when new.status = 'approved' then 'available'
    else 'reversed'
  end;

  available_at_value := case when commission_status = 'available' then coalesce(new.approved_at, now()) else null end;

  insert into public.commissions (
    conversion_id,
    affiliate_id,
    amount,
    status,
    available_at,
    paid_at
  )
  values (
    new.id,
    new.affiliate_id,
    commission_amount,
    commission_status,
    available_at_value,
    null
  )
  on conflict (conversion_id) do update
    set affiliate_id = excluded.affiliate_id,
        amount = excluded.amount,
        status = excluded.status,
        available_at = excluded.available_at,
        paid_at = case when excluded.status = 'paid' then coalesce(public.commissions.paid_at, now()) else null end,
        updated_at = now();

  if new.status in ('rejected', 'refunded') then
    update public.commissions
    set payout_request_id = null
    where conversion_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.sync_payout_request_commissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'paid' then
    update public.commissions
    set status = 'paid',
        paid_at = coalesce(new.processed_at, now()),
        updated_at = now()
    where payout_request_id = new.id;
  elsif new.status = 'rejected' then
    update public.commissions
    set payout_request_id = null,
        status = 'available',
        paid_at = null,
        updated_at = now()
    where payout_request_id = new.id
      and status <> 'paid';
  end if;

  return new;
end;
$$;

create or replace function public.get_affiliate_available_balance(target_affiliate_id uuid default auth.uid())
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(commission.amount), 0)::numeric
  from public.commissions commission
  where commission.affiliate_id = target_affiliate_id
    and commission.status = 'available'
    and commission.payout_request_id is null;
$$;

create or replace function public.get_affiliate_financial_summary(target_affiliate_id uuid default auth.uid())
returns table (
  pending_amount numeric,
  available_amount numeric,
  awaiting_payout_amount numeric,
  paid_amount numeric,
  total_conversions bigint,
  total_commissions bigint,
  payout_minimum numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(case when commission.status = 'pending' then commission.amount else 0 end), 0)::numeric as pending_amount,
    coalesce(sum(case when commission.status = 'available' and commission.payout_request_id is null then commission.amount else 0 end), 0)::numeric as available_amount,
    coalesce(sum(case when commission.status = 'available' and commission.payout_request_id is not null then commission.amount else 0 end), 0)::numeric as awaiting_payout_amount,
    coalesce(sum(case when commission.status = 'paid' then commission.amount else 0 end), 0)::numeric as paid_amount,
    (select count(*) from public.conversions conversion where conversion.affiliate_id = target_affiliate_id) as total_conversions,
    count(commission.id) as total_commissions,
    public.get_numeric_setting('payout.minimum_amount', 100) as payout_minimum
  from public.commissions commission
  where commission.affiliate_id = target_affiliate_id;
$$;

create or replace function public.request_payout(request_amount numeric default null)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  available_balance numeric;
  minimum_amount numeric;
  final_amount numeric;
  created_request public.payout_requests;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role not in ('affiliate', 'admin') then
    raise exception 'Somente afiliados podem solicitar saque.';
  end if;

  available_balance := public.get_affiliate_available_balance(auth.uid());
  minimum_amount := public.get_numeric_setting('payout.minimum_amount', 100);

  if available_balance <= 0 then
    raise exception 'Não h? saldo disponível para saque.';
  end if;

  final_amount := coalesce(request_amount, available_balance);

  if final_amount <> available_balance then
    raise exception 'Nesta etapa inicial, a solicitação deve usar o saldo disponível integral.';
  end if;

  if final_amount < minimum_amount then
    raise exception 'O saque minimo atual e de %.', minimum_amount;
  end if;

  insert into public.payout_requests (
    affiliate_id,
    amount,
    status
  )
  values (
    auth.uid(),
    final_amount,
    'requested'
  )
  returning *
  into created_request;

  update public.commissions
  set payout_request_id = created_request.id,
      updated_at = now()
  where affiliate_id = auth.uid()
    and status = 'available'
    and payout_request_id is null;

  return created_request;
end;
$$;

drop function if exists public.review_conversion(uuid, text);
drop function if exists public.review_conversion(uuid, text, text);
create function public.review_conversion(
  target_conversion_id uuid,
  target_status text,
  action_note text default null
)
returns public.conversions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  normalized_status text := lower(nullif(trim(coalesce(target_status, '')), ''));
  normalized_note text := nullif(trim(coalesce(action_note, '')), '');
  current_conversion public.conversions;
  current_commission public.commissions;
  updated_conversion public.conversions;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role <> 'admin' then
    raise exception 'Somente administradores podem revisar conversões.';
  end if;

  if target_conversion_id is null then
    raise exception 'Conversão não informada.';
  end if;

  if normalized_status not in ('approved', 'rejected', 'refunded') then
    raise exception 'Status de revisao da conversao invalido.';
  end if;

  select *
  into current_conversion
  from public.conversions conversion_item
  where conversion_item.id = target_conversion_id;

  if current_conversion.id is null then
    raise exception 'Conversão não encontrada.';
  end if;

  select *
  into current_commission
  from public.commissions commission_item
  where commission_item.conversion_id = target_conversion_id;

  if current_commission.status = 'paid'
     and normalized_status in ('rejected', 'refunded') then
    raise exception 'Não ? possóvel reverter uma conversão com comissão já paga.';
  end if;

  update public.conversions
  set status = normalized_status,
      approved_at = case
        when normalized_status = 'approved' then coalesce(current_conversion.approved_at, now())
        else null
      end
  where id = target_conversion_id
  returning *
  into updated_conversion;

  perform public.log_admin_audit(
    'review_conversion',
    'conversions',
    updated_conversion.id,
    jsonb_build_object(
      'previous_status', current_conversion.status,
      'new_status', updated_conversion.status,
      'affiliate_id', updated_conversion.affiliate_id,
      'campaign_id', updated_conversion.campaign_id,
      'product_id', updated_conversion.product_id,
      'commission_status', current_commission.status,
      'commission_id', current_commission.id,
      'note', normalized_note
    )
  );

  return updated_conversion;
end;
$$;

create or replace function public.review_payout_request(
  target_payout_request_id uuid,
  target_status text,
  action_note text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  normalized_status text := lower(nullif(trim(coalesce(target_status, '')), ''));
  normalized_note text := nullif(trim(coalesce(action_note, '')), '');
  current_request public.payout_requests;
  updated_request public.payout_requests;
  generated_note text;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role <> 'admin' then
    raise exception 'Somente administradores podem revisar saques.';
  end if;

  if target_payout_request_id is null then
    raise exception 'Solicitação de saque não informada.';
  end if;

  if normalized_status not in ('approved', 'processing', 'paid', 'rejected') then
    raise exception 'Status de revisao do saque invalido.';
  end if;

  select *
  into current_request
  from public.payout_requests payout_request_item
  where payout_request_item.id = target_payout_request_id;

  if current_request.id is null then
    raise exception 'Solicitação de saque não encontrada.';
  end if;

  if current_request.status in ('paid', 'rejected')
     and current_request.status is distinct from normalized_status then
    raise exception 'Não ? possóvel alterar uma solicitação finalizada.';
  end if;

  generated_note := coalesce(
    normalized_note,
    format(
      'Status alterado para %s por administrador em %s.',
      normalized_status,
      to_char(now(), 'YYYY-MM-DD HH24:MI:SS TZ')
    )
  );

  update public.payout_requests
  set status = normalized_status,
      notes = case
        when coalesce(current_request.notes, '') = '' then generated_note
        else current_request.notes || E'\n' || generated_note
      end,
      processed_at = case
        when normalized_status in ('paid', 'rejected') then coalesce(current_request.processed_at, now())
        when normalized_status = 'requested' then null
        else current_request.processed_at
      end
  where id = target_payout_request_id
  returning *
  into updated_request;

  perform public.log_admin_audit(
    'review_payout_request',
    'payout_requests',
    updated_request.id,
    jsonb_build_object(
      'previous_status', current_request.status,
      'new_status', updated_request.status,
      'affiliate_id', updated_request.affiliate_id,
      'amount', updated_request.amount,
      'note', normalized_note
    )
  );

  return updated_request;
end;
$$;

create or replace function public.register_manual_conversion(
  target_click_id uuid,
  gross_amount_value numeric,
  net_amount_value numeric default null,
  external_order_id_value text default null,
  approve_immediately boolean default true
)
returns public.conversions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.user_profiles;
  click_row public.clicks;
  campaign_row public.campaigns;
  created_conversion public.conversions;
begin
  select *
  into current_profile
  from public.user_profiles profile
  where profile.user_id = auth.uid();

  if current_profile.user_id is null then
    raise exception 'Perfil autenticado não encontrado.';
  end if;

  if current_profile.role not in ('admin', 'advertiser') then
    raise exception 'Somente admin ou anunciante podem registrar conversões.';
  end if;

  if target_click_id is null then
    raise exception 'Clique da conversão não informado.';
  end if;

  if gross_amount_value is null or gross_amount_value <= 0 then
    raise exception 'Valor bruto da conversao invalido.';
  end if;

  if net_amount_value is not null and net_amount_value < 0 then
    raise exception 'Valor liquido da conversao invalido.';
  end if;

  select *
  into click_row
  from public.clicks click_item
  where click_item.id = target_click_id;

  if click_row.id is null then
    raise exception 'Clique informado não encontrado.';
  end if;

  select *
  into campaign_row
  from public.campaigns campaign
  where campaign.id = click_row.campaign_id;

  if campaign_row.id is null then
    raise exception 'Campanha vinculada ao clique não encontrada.';
  end if;

  if current_profile.role = 'advertiser' and campaign_row.advertiser_id <> auth.uid() then
    raise exception 'Você não tem permissão para registrar conversões desta campanha.';
  end if;

  insert into public.conversions (
    click_id,
    affiliate_id,
    campaign_id,
    product_id,
    external_order_id,
    gross_amount,
    net_amount,
    status,
    occurred_at,
    approved_at
  )
  values (
    click_row.id,
    click_row.affiliate_id,
    click_row.campaign_id,
    click_row.product_id,
    nullif(trim(coalesce(external_order_id_value, '')), ''),
    gross_amount_value,
    net_amount_value,
    case when approve_immediately then 'approved' else 'pending' end,
    now(),
    case when approve_immediately then now() else null end
  )
  returning *
  into created_conversion;

  return created_conversion;
end;
$$;

drop trigger if exists trg_campaigns_prepare on public.campaigns;
create trigger trg_campaigns_prepare
before insert or update on public.campaigns
for each row
execute function public.prepare_campaign();

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
before update on public.campaigns
for each row
execute function public.set_updated_at();

drop trigger if exists trg_campaign_products_validate on public.campaign_products;
create trigger trg_campaign_products_validate
before insert or update on public.campaign_products
for each row
execute function public.validate_campaign_product();

drop trigger if exists trg_affiliate_links_prepare on public.affiliate_links;
create trigger trg_affiliate_links_prepare
before insert or update on public.affiliate_links
for each row
execute function public.prepare_affiliate_link();

drop trigger if exists trg_affiliate_links_updated_at on public.affiliate_links;
create trigger trg_affiliate_links_updated_at
before update on public.affiliate_links
for each row
execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
before update on public.settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_conversions_prepare on public.conversions;
create trigger trg_conversions_prepare
before insert or update on public.conversions
for each row
execute function public.prepare_conversion();

drop trigger if exists trg_conversions_updated_at on public.conversions;
create trigger trg_conversions_updated_at
before update on public.conversions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_conversions_sync_commission on public.conversions;
create trigger trg_conversions_sync_commission
after insert or update on public.conversions
for each row
execute function public.sync_commission_from_conversion();

drop trigger if exists trg_commissions_updated_at on public.commissions;
create trigger trg_commissions_updated_at
before update on public.commissions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_payout_requests_prepare on public.payout_requests;
create trigger trg_payout_requests_prepare
before insert or update on public.payout_requests
for each row
execute function public.prepare_payout_request();

drop trigger if exists trg_payout_requests_updated_at on public.payout_requests;
create trigger trg_payout_requests_updated_at
before update on public.payout_requests
for each row
execute function public.set_updated_at();

drop trigger if exists trg_payout_requests_sync_commissions on public.payout_requests;
create trigger trg_payout_requests_sync_commissions
after update on public.payout_requests
for each row
execute function public.sync_payout_request_commissions();

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
alter table public.campaigns enable row level security;
alter table public.campaign_products enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.clicks enable row level security;
alter table public.settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.conversions enable row level security;
alter table public.commissions enable row level security;
alter table public.payout_requests enable row level security;

drop policy if exists "Perfil proprio ou admin pode ler" on public.user_profiles;
create policy "Perfil proprio ou admin pode ler"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Usuário autenticado pode inserir próprio perfil" on public.user_profiles;
create policy "Usuário autenticado pode inserir próprio perfil"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuário ou admin pode atualizar perfil" on public.user_profiles;
drop policy if exists "Admin pode atualizar perfil" on public.user_profiles;
create policy "Usuário ou admin pode atualizar perfil"
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

drop policy if exists "Inserção por usuário autenticado" on public.produtos;
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

drop policy if exists "Leitura de campanhas por dono ou admin" on public.campaigns;
create policy "Leitura de campanhas por dono ou admin"
  on public.campaigns
  for select
  to authenticated
  using (public.is_advertiser_or_admin(advertiser_id) or public.is_admin());

drop policy if exists "Insercao de campanhas por dono ou admin" on public.campaigns;
create policy "Insercao de campanhas por dono ou admin"
  on public.campaigns
  for insert
  to authenticated
  with check (public.is_advertiser_or_admin(advertiser_id) or public.is_admin());

drop policy if exists "Atualizacao de campanhas por dono ou admin" on public.campaigns;
create policy "Atualizacao de campanhas por dono ou admin"
  on public.campaigns
  for update
  to authenticated
  using (public.is_advertiser_or_admin(advertiser_id) or public.is_admin())
  with check (public.is_advertiser_or_admin(advertiser_id) or public.is_admin());

drop policy if exists "Exclusao de campanhas por dono ou admin" on public.campaigns;
create policy "Exclusao de campanhas por dono ou admin"
  on public.campaigns
  for delete
  to authenticated
  using (public.is_advertiser_or_admin(advertiser_id) or public.is_admin());

drop policy if exists "Leitura de campaign_products por dono ou admin" on public.campaign_products;
create policy "Leitura de campaign_products por dono ou admin"
  on public.campaign_products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_products.campaign_id
        and (public.is_advertiser_or_admin(campaign.advertiser_id) or public.is_admin())
    )
  );

drop policy if exists "Insercao de campaign_products por dono ou admin" on public.campaign_products;
create policy "Insercao de campaign_products por dono ou admin"
  on public.campaign_products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_products.campaign_id
        and (public.is_advertiser_or_admin(campaign.advertiser_id) or public.is_admin())
    )
  );

drop policy if exists "Exclusao de campaign_products por dono ou admin" on public.campaign_products;
create policy "Exclusao de campaign_products por dono ou admin"
  on public.campaign_products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.campaigns campaign
      where campaign.id = campaign_products.campaign_id
        and (public.is_advertiser_or_admin(campaign.advertiser_id) or public.is_admin())
    )
  );

drop policy if exists "Leitura de affiliate_links por dono ou admin" on public.affiliate_links;
create policy "Leitura de affiliate_links por dono ou admin"
  on public.affiliate_links
  for select
  to authenticated
  using (affiliate_id = auth.uid() or public.is_admin());

drop policy if exists "Insercao de affiliate_links pelo proprio afiliado ou admin" on public.affiliate_links;
create policy "Insercao de affiliate_links pelo proprio afiliado ou admin"
  on public.affiliate_links
  for insert
  to authenticated
  with check (affiliate_id = auth.uid() or public.is_admin());

drop policy if exists "Atualizacao de affiliate_links por dono ou admin" on public.affiliate_links;
create policy "Atualizacao de affiliate_links por dono ou admin"
  on public.affiliate_links
  for update
  to authenticated
  using (affiliate_id = auth.uid() or public.is_admin())
  with check (affiliate_id = auth.uid() or public.is_admin());

drop policy if exists "Leitura de clicks por dono ou admin" on public.clicks;
create policy "Leitura de clicks por dono ou admin"
  on public.clicks
  for select
  to authenticated
  using (
    affiliate_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.campaigns campaign
      where campaign.id = clicks.campaign_id
        and (public.is_advertiser_or_admin(campaign.advertiser_id) or public.is_admin())
    )
  );

drop policy if exists "Leitura de settings por admin" on public.settings;
create policy "Leitura de settings por admin"
  on public.settings
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Insercao de settings por admin" on public.settings;
create policy "Insercao de settings por admin"
  on public.settings
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Atualizacao de settings por admin" on public.settings;
create policy "Atualizacao de settings por admin"
  on public.settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Leitura de auditoria por admin" on public.admin_audit_logs;
create policy "Leitura de auditoria por admin"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Leitura de conversions por dono ou admin" on public.conversions;
create policy "Leitura de conversions por dono ou admin"
  on public.conversions
  for select
  to authenticated
  using (
    affiliate_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.campaigns campaign
      where campaign.id = conversions.campaign_id
        and (public.is_advertiser_or_admin(campaign.advertiser_id) or public.is_admin())
    )
  );

drop policy if exists "Gestao de conversions por admin" on public.conversions;
create policy "Gestao de conversions por admin"
  on public.conversions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Leitura de commissions por dono ou admin" on public.commissions;
create policy "Leitura de commissions por dono ou admin"
  on public.commissions
  for select
  to authenticated
  using (
    affiliate_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.conversions conversion
      join public.campaigns campaign
        on campaign.id = conversion.campaign_id
      where conversion.id = commissions.conversion_id
        and (public.is_advertiser_or_admin(campaign.advertiser_id) or public.is_admin())
    )
  );

drop policy if exists "Gestao de commissions por admin" on public.commissions;
create policy "Gestao de commissions por admin"
  on public.commissions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Leitura de payout_requests por dono ou admin" on public.payout_requests;
create policy "Leitura de payout_requests por dono ou admin"
  on public.payout_requests
  for select
  to authenticated
  using (affiliate_id = auth.uid() or public.is_admin());

drop policy if exists "Insercao de payout_requests pelo proprio afiliado ou admin" on public.payout_requests;
create policy "Insercao de payout_requests pelo proprio afiliado ou admin"
  on public.payout_requests
  for insert
  to authenticated
  with check (affiliate_id = auth.uid() or public.is_admin());

drop policy if exists "Atualizacao de payout_requests por admin" on public.payout_requests;
create policy "Atualizacao de payout_requests por admin"
  on public.payout_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_advertiser_or_admin(uuid) to authenticated;
grant execute on function public.finalize_account_activation() to authenticated;
grant execute on function public.get_affiliate_campaign_catalog() to authenticated;
grant execute on function public.create_affiliate_link(uuid, uuid) to authenticated;
grant execute on function public.get_numeric_setting(text, numeric) to authenticated;
grant execute on function public.log_admin_audit(text, text, uuid, jsonb) to authenticated;
grant execute on function public.set_payout_minimum_amount(numeric) to authenticated;
grant execute on function public.get_affiliate_available_balance(uuid) to authenticated;
grant execute on function public.get_affiliate_financial_summary(uuid) to authenticated;
grant execute on function public.request_payout(numeric) to authenticated;
grant execute on function public.review_conversion(uuid, text, text) to authenticated;
grant execute on function public.review_payout_request(uuid, text, text) to authenticated;
grant execute on function public.register_manual_conversion(uuid, numeric, numeric, text, boolean) to authenticated;
grant execute on function public.get_public_store_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_products_by_profile(uuid) to anon, authenticated;
grant execute on function public.check_public_slug_availability(text, uuid) to anon, authenticated;
grant select on public.public_store_profiles to anon, authenticated;
grant select on public.public_store_products to anon, authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, delete on public.campaign_products to authenticated;
grant select, insert, update on public.affiliate_links to authenticated;
grant select on public.clicks to authenticated;
grant select on public.admin_audit_logs to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.conversions to authenticated;
grant select, insert, update, delete on public.commissions to authenticated;
grant select, insert, update on public.payout_requests to authenticated;
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
