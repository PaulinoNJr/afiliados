# Modelo Inicial de Dados

## Tenant e identidade

### `tenants`
- `id uuid pk`
- `name text not null`
- `slug text unique not null`
- `status text not null check (status in ('trial', 'active', 'suspended', 'archived'))`
- `plan_code text`
- `primary_color text`
- `logo_url text`
- `custom_domain text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `domains`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `hostname text unique not null`
- `status text not null check (status in ('pending', 'verified', 'failed', 'disabled'))`
- `ssl_status text`
- `created_at timestamptz`
- `updated_at timestamptz`

## Usuários e perfis

### `user_profiles`
- `user_id uuid pk fk -> auth.users.id`
- `tenant_id uuid null fk -> tenants.id`
- `role text not null check (role in ('admin', 'advertiser', 'affiliate'))`
- `account_type text not null check (account_type in ('advertiser', 'affiliate'))`
- `company_name text`
- `first_name text`
- `last_name text`
- `phone text`
- `activation_status text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `advertisers`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `profile_id uuid fk -> user_profiles.user_id`
- `legal_name text`
- `document text`
- `status text check (status in ('pending', 'active', 'suspended'))`
- `created_at timestamptz`
- `updated_at timestamptz`

### `affiliates`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `profile_id uuid fk -> user_profiles.user_id`
- `status text check (status in ('pending', 'approved', 'rejected', 'blocked'))`
- `approval_required boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

## Oferta comercial

### `products`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `advertiser_id uuid fk -> advertisers.id`
- `name text not null`
- `slug text not null`
- `short_description text`
- `description text`
- `category text`
- `price numeric(12,2)`
- `currency text default 'BRL'`
- `commission_type text check (commission_type in ('percent', 'fixed'))`
- `commission_value numeric(12,2)`
- `destination_url text not null`
- `image_url text`
- `status text check (status in ('draft', 'active', 'paused', 'archived'))`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices:
- `(tenant_id, advertiser_id, status)`
- `(tenant_id, slug)`
- `(tenant_id, created_at desc)`

### `campaigns`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `advertiser_id uuid fk -> advertisers.id`
- `name text not null`
- `slug text not null`
- `description text`
- `status text check (status in ('draft', 'active', 'paused', 'closed'))`
- `starts_at timestamptz`
- `ends_at timestamptz`
- `commission_type text`
- `commission_value numeric(12,2)`
- `approval_mode text check (approval_mode in ('open', 'manual'))`
- `created_at timestamptz`
- `updated_at timestamptz`

### `campaign_products`
- `campaign_id uuid fk -> campaigns.id`
- `product_id uuid fk -> products.id`
- pk composta `(campaign_id, product_id)`

### `campaign_affiliates`
- `campaign_id uuid fk -> campaigns.id`
- `affiliate_id uuid fk -> affiliates.id`
- `status text check (status in ('invited', 'pending', 'approved', 'rejected', 'blocked'))`
- `approved_at timestamptz`
- pk composta `(campaign_id, affiliate_id)`

## Tracking e atribuição

### `affiliate_links`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `affiliate_id uuid fk -> affiliates.id`
- `campaign_id uuid null fk -> campaigns.id`
- `product_id uuid null fk -> products.id`
- `code text unique not null`
- `slug_affiliate text`
- `slug_product text`
- `destination_url text not null`
- `status text check (status in ('active', 'disabled'))`
- `created_at timestamptz`

Índices:
- `(tenant_id, affiliate_id)`
- `(tenant_id, code)`
- `(tenant_id, campaign_id, product_id)`

### `clicks`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `affiliate_link_id uuid fk -> affiliate_links.id`
- `affiliate_id uuid fk -> affiliates.id`
- `campaign_id uuid null fk -> campaigns.id`
- `product_id uuid null fk -> products.id`
- `session_id text`
- `referrer text`
- `user_agent text`
- `ip_hash text`
- `occurred_at timestamptz`

Índices:
- `(tenant_id, affiliate_id, occurred_at desc)`
- `(tenant_id, campaign_id, occurred_at desc)`
- `(tenant_id, product_id, occurred_at desc)`
- `(tenant_id, session_id)`

### `conversions`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `click_id uuid null fk -> clicks.id`
- `affiliate_id uuid fk -> affiliates.id`
- `campaign_id uuid null fk -> campaigns.id`
- `product_id uuid null fk -> products.id`
- `external_order_id text`
- `gross_amount numeric(12,2)`
- `net_amount numeric(12,2)`
- `status text check (status in ('pending', 'approved', 'rejected', 'refunded'))`
- `occurred_at timestamptz`
- `approved_at timestamptz`

### `commissions`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `conversion_id uuid fk -> conversions.id`
- `affiliate_id uuid fk -> affiliates.id`
- `amount numeric(12,2)`
- `status text check (status in ('pending', 'approved', 'available', 'paid', 'reversed'))`
- `created_at timestamptz`
- `updated_at timestamptz`

### `payout_requests`
- `id uuid pk`
- `tenant_id uuid fk -> tenants.id`
- `affiliate_id uuid fk -> affiliates.id`
- `amount numeric(12,2)`
- `status text check (status in ('requested', 'approved', 'processing', 'paid', 'rejected'))`
- `requested_at timestamptz`
- `processed_at timestamptz`

## Governança

### `audit_logs`
- `id uuid pk`
- `tenant_id uuid null fk -> tenants.id`
- `actor_user_id uuid`
- `entity_type text`
- `entity_id uuid`
- `action text`
- `payload jsonb`
- `created_at timestamptz`

### `settings`
- `id uuid pk`
- `tenant_id uuid null fk -> tenants.id`
- `key text`
- `value jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

## RBAC e RLS

- `admin`: visão global da plataforma, usuários, auditoria e configurações.
- `advertiser`: acesso apenas ao próprio tenant, campanhas, produtos e afiliados vinculados.
- `affiliate`: acesso apenas ao próprio perfil, links, cliques, conversões, comissões e saques.

Regras-base de RLS:
- Toda tabela multi-tenant filtra por `tenant_id`.
- Toda tabela operacional filtra também por ownership (`advertiser_id`, `affiliate_id` ou `profile_id`).
- Logs críticos sempre gravam `actor_user_id` e timestamp.
- Tabelas de tracking devem expor IP apenas como hash, nunca texto puro.
