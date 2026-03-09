-- Execute este script no SQL Editor do Supabase.

create extension if not exists pgcrypto;

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

-- Leitura pública para a página index.
drop policy if exists "Leitura publica de produtos" on public.produtos;
create policy "Leitura publica de produtos"
  on public.produtos
  for select
  using (true);

-- Apenas usuários autenticados podem inserir produtos próprios.
drop policy if exists "Insercao por usuario autenticado" on public.produtos;
create policy "Insercao por usuario autenticado"
  on public.produtos
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Somente dono pode atualizar.
drop policy if exists "Atualizacao somente do dono" on public.produtos;
create policy "Atualizacao somente do dono"
  on public.produtos
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Somente dono pode excluir.
drop policy if exists "Exclusao somente do dono" on public.produtos;
create policy "Exclusao somente do dono"
  on public.produtos
  for delete
  to authenticated
  using (auth.uid() = created_by);

grant usage on schema public to anon, authenticated;
grant select on public.produtos to anon;
grant select, insert, update, delete on public.produtos to authenticated;
