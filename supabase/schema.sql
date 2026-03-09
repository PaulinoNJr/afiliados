-- Execute este script no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'produtor' check (role in ('admin', 'produtor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, role)
  values (new.id, 'produtor')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
  );
$$;

alter table public.user_profiles enable row level security;

drop policy if exists "Perfil proprio ou admin pode ler" on public.user_profiles;
create policy "Perfil proprio ou admin pode ler"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admin pode atualizar perfil" on public.user_profiles;
create policy "Admin pode atualizar perfil"
  on public.user_profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (role in ('admin', 'produtor'));

drop policy if exists "Usuario autenticado pode inserir proprio perfil" on public.user_profiles;
create policy "Usuario autenticado pode inserir proprio perfil"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  preco numeric(12,2) not null check (preco >= 0),
  imagem_url text,
  link_afiliado text not null,
  descricao text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);

create index if not exists idx_produtos_created_at on public.produtos (created_at desc);
create index if not exists idx_produtos_created_by on public.produtos (created_by);

alter table public.produtos enable row level security;

-- Leitura publica para a pagina index.
drop policy if exists "Leitura publica de produtos" on public.produtos;
create policy "Leitura publica de produtos"
  on public.produtos
  for select
  using (true);

-- Usuario autenticado pode inserir produto proprio.
drop policy if exists "Insercao por usuario autenticado" on public.produtos;
create policy "Insercao por usuario autenticado"
  on public.produtos
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Produtor atualiza/exclui os proprios produtos.
-- Admin atualiza/exclui qualquer produto.
drop policy if exists "Atualizacao por dono ou admin" on public.produtos;
drop policy if exists "Atualizacao somente do dono" on public.produtos;
create policy "Atualizacao por dono ou admin"
  on public.produtos
  for update
  to authenticated
  using (auth.uid() = created_by or public.is_admin())
  with check (auth.uid() = created_by or public.is_admin());

drop policy if exists "Exclusao por dono ou admin" on public.produtos;
drop policy if exists "Exclusao somente do dono" on public.produtos;
create policy "Exclusao por dono ou admin"
  on public.produtos
  for delete
  to authenticated
  using (auth.uid() = created_by or public.is_admin());

grant usage on schema public to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

grant select on public.produtos to anon;
grant select, insert, update, delete on public.produtos to authenticated;
grant select, insert, update on public.user_profiles to authenticated;

-- Garante que este usuario seja admin (idempotente).
insert into public.user_profiles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('paulino.covabra@gmail.com')
on conflict (user_id)
do update set role = 'admin';
