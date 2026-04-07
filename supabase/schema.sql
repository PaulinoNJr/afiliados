create schema if not exists extensions;

create extension if not exists pgcrypto;
create extension if not exists unaccent with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
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
set search_path = public
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
    'categorias'
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
  store_name text not null default 'Minha loja',
  slug text not null,
  slug_changed_at timestamptz,
  activation_status text not null default 'pending',
  activation_requested_at timestamptz not null default now(),
  activation_email_sent_at timestamptz not null default now(),
  activation_expires_at timestamptz,
  activation_confirmed_at timestamptz,
  headline text,
  accent_color text not null default '#0d6efd',
  text_color text not null default '#152238',
  page_background text not null default '#f3f6fb',
  button_text_color text not null default '#ffffff',
  button_style text not null default 'solid',
  card_style text not null default 'soft',
  cta_label text not null default 'Ver produto',
  bio text,
  photo_url text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_user_profiles_role check (role in ('admin', 'advertiser')),
  constraint ck_user_profiles_account_type check (account_type = 'advertiser'),
  constraint ck_user_profiles_activation_status check (activation_status in ('pending', 'active', 'expired'))
);

create unique index if not exists idx_user_profiles_slug on public.user_profiles (slug);
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
    normalized_base := 'minha-loja';
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
  new.role := case
    when lower(coalesce(new.role, '')) = 'admin' then 'admin'
    else 'advertiser'
  end;

  new.account_type := 'advertiser';
  new.company_name := nullif(trim(coalesce(new.company_name, '')), '');
  new.first_name := nullif(trim(coalesce(new.first_name, '')), '');
  new.last_name := nullif(trim(coalesce(new.last_name, '')), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  new.headline := nullif(trim(coalesce(new.headline, '')), '');
  new.bio := nullif(trim(coalesce(new.bio, '')), '');
  new.photo_url := nullif(trim(coalesce(new.photo_url, '')), '');
  new.banner_url := nullif(trim(coalesce(new.banner_url, '')), '');
  new.cta_label := coalesce(nullif(trim(coalesce(new.cta_label, '')), ''), 'Ver produto');
  new.button_style := case
    when lower(coalesce(new.button_style, '')) in ('solid', 'outline', 'pill') then lower(new.button_style)
    else 'solid'
  end;
  new.card_style := case
    when lower(coalesce(new.card_style, '')) in ('soft', 'outline', 'glass') then lower(new.card_style)
    else 'soft'
  end;

  fallback_store_name := coalesce(
    nullif(trim(coalesce(new.store_name, '')), ''),
    new.company_name,
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

  new.activation_expires_at := coalesce(
    new.activation_expires_at,
    new.activation_requested_at + interval '5 days'
  );

  if new.activation_status = 'active' and new.activation_confirmed_at is null then
    new.activation_confirmed_at := now();
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
  generated_store_name text;
begin
  generated_store_name := coalesce(
    nullif(trim(meta ->> 'company_name'), ''),
    nullif(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), ''),
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
    'advertiser',
    'advertiser',
    nullif(trim(meta ->> 'company_name'), ''),
    nullif(trim(meta ->> 'first_name'), ''),
    nullif(trim(meta ->> 'last_name'), ''),
    nullif(trim(meta ->> 'phone'), ''),
    nullif(trim(meta ->> 'photo_url'), ''),
    generated_store_name,
    public.generate_unique_store_slug(coalesce(nullif(trim(meta ->> 'slug'), ''), generated_store_name), new.id),
    'pending',
    now(),
    now(),
    now() + interval '5 days'
  )
  on conflict (user_id) do update
    set user_email = excluded.user_email;

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

create or replace function public.is_advertiser_or_admin(target_profile_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_profile_id or public.is_admin();
$$;

create or replace function public.finalize_account_activation()
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.user_profiles;
begin
  update public.user_profiles
  set activation_status = 'active',
      activation_confirmed_at = coalesce(activation_confirmed_at, now())
  where user_id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_product_categories_profile_slug on public.product_categories (profile_id, slug);
create index if not exists idx_product_categories_profile_order on public.product_categories (profile_id, sort_order, lower(name));

create or replace function public.prepare_product_category()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.name := nullif(trim(coalesce(new.name, '')), '');
  if new.name is null then
    raise exception 'Informe o nome da categoria.';
  end if;

  new.slug := coalesce(public.normalize_slug(new.slug), public.normalize_slug(new.name));
  new.sort_order := greatest(coalesce(new.sort_order, 0), 0);
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

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.product_categories(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  titulo text not null,
  preco numeric(12,2) not null check (preco > 0),
  imagem_url text,
  product_url text not null,
  is_featured boolean not null default false,
  descricao text,
  source_url text,
  ml_item_id text,
  ml_currency text,
  ml_permalink text,
  ml_thumbnail text,
  ml_pictures jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  legacy_product_column text := format(
    'link_%s',
    chr(97) || chr(102) || chr(105) || chr(108) || chr(105) || chr(97) || chr(100) || chr(111)
  );
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'produtos'
      and column_name = legacy_product_column
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'produtos'
      and column_name = 'product_url'
  ) then
    execute format(
      'alter table public.produtos rename column %I to product_url',
      legacy_product_column
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'produtos'
      and column_name = 'is_featured'
  ) then
    alter table public.produtos
      add column is_featured boolean not null default false;
  end if;
end;
$$;

create index if not exists idx_produtos_profile_updated on public.produtos (profile_id, updated_at desc);
create index if not exists idx_produtos_profile_category on public.produtos (profile_id, category_id);

drop trigger if exists trg_produtos_updated_at on public.produtos;
create trigger trg_produtos_updated_at
before update on public.produtos
for each row
execute function public.set_updated_at();

create or replace function public.get_public_store_by_slug(store_slug text)
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
set search_path = public
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

create or replace function public.get_public_products_by_profile(store_profile_id uuid)
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
set search_path = public
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
    product.product_url as link_afiliado,
    product.descricao,
    product.created_at
  from public.produtos product
  join public.product_categories category_item
    on category_item.id = product.category_id
  where product.profile_id = store_profile_id
  order by product.is_featured desc, category_item.sort_order asc, lower(category_item.name) asc, product.created_at desc;
$$;

create or replace function public.get_public_products_featured_by_profile(store_profile_id uuid)
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
  product_url text,
  is_featured boolean,
  descricao text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
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
    product.product_url,
    product.is_featured,
    product.descricao,
    product.created_at
  from public.produtos product
  join public.product_categories category_item
    on category_item.id = product.category_id
  where product.profile_id = store_profile_id
  order by product.is_featured desc, category_item.sort_order asc, lower(category_item.name) asc, product.created_at desc;
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
set search_path = public
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

drop policy if exists "Usuario ou admin pode atualizar perfil" on public.user_profiles;
create policy "Usuario ou admin pode atualizar perfil"
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Usuario autenticado pode inserir proprio perfil" on public.user_profiles;
create policy "Usuario autenticado pode inserir proprio perfil"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Leitura de categorias por dono ou admin" on public.product_categories;
create policy "Leitura de categorias por dono ou admin"
  on public.product_categories
  for select
  to authenticated
  using (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Insercao de categorias por dono ou admin" on public.product_categories;
create policy "Insercao de categorias por dono ou admin"
  on public.product_categories
  for insert
  to authenticated
  with check (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Atualizacao de categorias por dono ou admin" on public.product_categories;
create policy "Atualizacao de categorias por dono ou admin"
  on public.product_categories
  for update
  to authenticated
  using (public.is_advertiser_or_admin(profile_id))
  with check (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Exclusao de categorias por dono ou admin" on public.product_categories;
create policy "Exclusao de categorias por dono ou admin"
  on public.product_categories
  for delete
  to authenticated
  using (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Leitura de produtos por dono ou admin" on public.produtos;
create policy "Leitura de produtos por dono ou admin"
  on public.produtos
  for select
  to authenticated
  using (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Insercao de produtos por dono ou admin" on public.produtos;
create policy "Insercao de produtos por dono ou admin"
  on public.produtos
  for insert
  to authenticated
  with check (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Atualizacao de produtos por dono ou admin" on public.produtos;
create policy "Atualizacao de produtos por dono ou admin"
  on public.produtos
  for update
  to authenticated
  using (public.is_advertiser_or_admin(profile_id))
  with check (public.is_advertiser_or_admin(profile_id));

drop policy if exists "Exclusao de produtos por dono ou admin" on public.produtos;
create policy "Exclusao de produtos por dono ou admin"
  on public.produtos
  for delete
  to authenticated
  using (public.is_advertiser_or_admin(profile_id));

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_advertiser_or_admin(uuid) to authenticated;
grant execute on function public.finalize_account_activation() to authenticated;
grant execute on function public.get_public_store_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_products_by_profile(uuid) to anon, authenticated;
grant execute on function public.get_public_products_featured_by_profile(uuid) to anon, authenticated;
grant execute on function public.check_public_slug_availability(text, uuid) to anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.product_categories to authenticated;
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

update public.user_profiles
set role = 'advertiser',
    account_type = 'advertiser'
where role not in ('admin', 'advertiser')
   or account_type <> 'advertiser';

insert into public.user_profiles (user_id, role, account_type, activation_status, activation_confirmed_at, slug, store_name)
select id, 'admin', 'advertiser', 'active', now(), public.generate_unique_store_slug(email, id), 'Administrador'
from auth.users
where lower(email) = lower('paulino.covabra@gmail.com')
on conflict (user_id)
do update set role = 'admin',
              account_type = 'advertiser',
              activation_status = 'active',
              activation_confirmed_at = coalesce(public.user_profiles.activation_confirmed_at, now());
