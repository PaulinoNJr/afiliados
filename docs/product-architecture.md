# Blueprint do Produto

## Diagnóstico Atual

O projeto atual tem uma base funcional de MVP, mas ainda está posicionado como uma vitrine individual de afiliados, não como uma plataforma SaaS para operação de programas de afiliados.

Principais limitações da base atual:

- A `index.html` mistura marketing institucional com storefront pública do usuário, o que confunde posicionamento, SEO e navegação.
- O núcleo do produto está centrado em `admin/produtor`, sem separação real entre `admin`, `anunciante` e `afiliado`.
- O dashboard atual é único e orientado a cadastro de produtos, sem visão de performance, tracking, campanhas, conversões e comissões.
- O banco atual modela perfil, categorias e produtos, mas ainda não modela campanhas, links rastreáveis, cliques, conversões, payouts, auditoria e tenants.
- A navegação ainda é de páginas isoladas, com sensação de painel utilitário, e não de produto com jornadas e onboarding por perfil.
- O tracking, que deve ser o coração do negócio, ainda não existe como módulo próprio com redirecionamento, atribuição e antifraude.
- A camada pública ainda comunica “loja de afiliado”, quando o novo posicionamento exige “plataforma para empresas criarem e operarem seu próprio programa de afiliados”.
- A base está em HTML + JS puro, o que é viável para continuar no curto prazo, mas exige organização mais modular para suportar crescimento e white label.

## Reposicionamento do Produto

Nova proposta de valor:

> Plataforma para empresas criarem seu próprio programa de afiliados, publicarem campanhas e produtos, ativarem afiliados, gerarem links rastreáveis e acompanharem cliques, conversões e comissões em um único ambiente.

Personas principais:

- Anunciante: empresa que cadastra produtos, cria campanhas, define comissões e aprova afiliados.
- Afiliado: parceiro que acessa campanhas, gera links próprios, acompanha métricas e solicita saques.
- Admin: operação interna da plataforma que governa cadastros, segurança, auditoria, antifraude, billing e white label.

## Arquitetura de Produto

### 1. Módulo Público / Marketing

Objetivo: gerar demanda, educar mercado, converter cadastro e sustentar credibilidade.

Páginas:

- `/` Home institucional
- `/como-funciona`
- `/para-anunciantes`
- `/para-afiliados`
- `/planos`
- `/faq`
- `/contato`
- `/privacidade`
- `/termos`

### 2. Módulo do Afiliado

Objetivo: operar divulgação, links, performance e recebimentos.

Páginas:

- `/app/afiliado/dashboard`
- `/app/afiliado/campanhas`
- `/app/afiliado/produtos`
- `/app/afiliado/links`
- `/app/afiliado/cliques`
- `/app/afiliado/conversoes`
- `/app/afiliado/comissoes`
- `/app/afiliado/saques`
- `/app/afiliado/materiais`
- `/app/afiliado/perfil`

### 3. Módulo do Anunciante

Objetivo: operar programa de afiliados próprio, campanhas, comissões e aprovados.

Páginas:

- `/app/anunciante/dashboard`
- `/app/anunciante/produtos`
- `/app/anunciante/campanhas`
- `/app/anunciante/afiliados`
- `/app/anunciante/aprovacoes`
- `/app/anunciante/relatorios`
- `/app/anunciante/materiais`
- `/app/anunciante/configuracoes`

### 4. Módulo Admin / Backoffice

Objetivo: governança da plataforma, compliance, billing, auditoria e white label.

Páginas:

- `/app/admin/dashboard`
- `/app/admin/usuarios`
- `/app/admin/tenants`
- `/app/admin/dominios`
- `/app/admin/planos`
- `/app/admin/settings`
- `/app/admin/auditoria`
- `/app/admin/antifraude`
- `/app/admin/financeiro`

## Árvore de Páginas

```text
/
|-- como-funciona.html
|-- anunciantes.html
|-- afiliados.html
|-- planos.html
|-- faq.html
|-- contato.html
|-- privacidade.html
|-- termos.html
|-- login.html
|-- cadastro.html
|-- recuperar-senha.html
|-- ativacao.html
|-- app/
|   |-- afiliado-dashboard.html
|   |-- afiliado-campanhas.html
|   |-- afiliado-links.html
|   |-- afiliado-comissoes.html
|   |-- afiliado-saques.html
|   |-- anunciante-dashboard.html
|   |-- anunciante-produtos.html
|   |-- anunciante-campanhas.html
|   |-- anunciante-afiliados.html
|   |-- admin-dashboard.html
|   |-- admin-usuarios.html
|   |-- admin-auditoria.html
|   `-- admin-settings.html
|-- r/
|   `-- [codigo-link]
`-- loja pública white label / domínio customizado
```

## Modelo de Navegação

### Navegação pública

Barra principal:

- Produto
- Como funciona
- Para anunciantes
- Para afiliados
- Planos
- FAQ
- Entrar
- Criar conta

Fluxo:

- Visitante entra na home
- Entende a proposta
- Escolhe “sou anunciante” ou “sou afiliado”
- Vai para cadastro contextualizado
- Faz onboarding
- Entra no painel do perfil correto

### Navegação autenticada

Estrutura:

- Topbar com tenant, papel, busca global, alertas e conta
- Sidebar por papel
- Breadcrumb contextual
- CTAs persistentes para ações primárias

Navegação do afiliado:

- Dashboard
- Campanhas
- Produtos liberados
- Links
- Cliques
- Conversões
- Comissões
- Saques
- Materiais
- Perfil

Navegação do anunciante:

- Dashboard
- Produtos
- Campanhas
- Afiliados
- Aprovações
- Relatórios
- Materiais
- Configurações

Navegação do admin:

- Dashboard
- Usuários
- Tenants
- Domínios
- Auditoria
- Antifraude
- Financeiro
- Configurações

## Modelo de Dados Inicial

### Núcleo de identidade e tenancy

`tenants`

- `id uuid pk`
- `name text`
- `slug text unique`
- `status text`
- `plan_id uuid`
- `primary_domain text`
- `branding jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices:

- `unique(slug)`
- `index(plan_id, status)`

`profiles`

- `user_id uuid pk -> auth.users.id`
- `tenant_id uuid -> tenants.id`
- `role text check in ('admin','advertiser','affiliate')`
- `status text`
- `first_name text`
- `last_name text`
- `phone text`
- `avatar_url text`
- `company_name text`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices:

- `index(tenant_id, role)`
- `index(tenant_id, status)`

`advertisers`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `profile_id uuid -> profiles.user_id`
- `legal_name text`
- `trade_name text`
- `document_number text`
- `status text`
- `billing_email text`
- `website_url text`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices:

- `index(tenant_id, profile_id)`

`affiliates`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `profile_id uuid -> profiles.user_id`
- `status text`
- `approval_mode text`
- `public_slug text`
- `payout_method jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices:

- `unique(tenant_id, public_slug)`
- `index(tenant_id, status)`

### Operação comercial

`products`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `advertiser_id uuid -> advertisers.id`
- `name text`
- `slug text`
- `short_description text`
- `description text`
- `category_id uuid`
- `image_url text`
- `destination_url text`
- `price numeric(12,2)`
- `currency text`
- `status text check in ('draft','active','paused','archived')`
- `visibility text`
- `created_at timestamptz`
- `updated_at timestamptz`
- `created_by uuid -> profiles.user_id`

Índices:

- `index(tenant_id, advertiser_id, status)`
- `unique(tenant_id, advertiser_id, slug)`

`campaigns`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `advertiser_id uuid -> advertisers.id`
- `name text`
- `slug text`
- `description text`
- `status text check in ('draft','active','paused','ended')`
- `start_at timestamptz`
- `end_at timestamptz`
- `approval_required boolean`
- `commission_type text check in ('percent','fixed')`
- `commission_value numeric(12,2)`
- `attribution_window_days integer`
- `rules jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices:

- `index(tenant_id, advertiser_id, status)`
- `index(start_at, end_at)`

`campaign_products`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `campaign_id uuid -> campaigns.id`
- `product_id uuid -> products.id`
- `status text`
- `created_at timestamptz`

Índices:

- `unique(campaign_id, product_id)`
- `index(tenant_id, campaign_id)`

`campaign_affiliates`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `campaign_id uuid -> campaigns.id`
- `affiliate_id uuid -> affiliates.id`
- `status text check in ('pending','approved','rejected','blocked')`
- `approved_at timestamptz`
- `approved_by uuid -> profiles.user_id`
- `created_at timestamptz`

Índices:

- `unique(campaign_id, affiliate_id)`
- `index(tenant_id, affiliate_id, status)`

`marketing_assets`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `campaign_id uuid -> campaigns.id`
- `asset_type text check in ('banner','copy','image','video','file','link')`
- `title text`
- `description text`
- `file_path text`
- `external_url text`
- `mime_type text`
- `created_at timestamptz`

Índices:

- `index(tenant_id, campaign_id, asset_type)`

### Tracking e atribuição

`affiliate_links`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `campaign_id uuid -> campaigns.id`
- `product_id uuid -> products.id`
- `affiliate_id uuid -> affiliates.id`
- `code text unique`
- `slug_path text`
- `destination_url text`
- `status text`
- `created_at timestamptz`

Índices:

- `unique(code)`
- `index(tenant_id, affiliate_id, campaign_id)`

`clicks`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `affiliate_link_id uuid -> affiliate_links.id`
- `campaign_id uuid -> campaigns.id`
- `product_id uuid -> products.id`
- `affiliate_id uuid -> affiliates.id`
- `advertiser_id uuid -> advertisers.id`
- `clicked_at timestamptz`
- `referrer text`
- `user_agent text`
- `ip_hash text`
- `session_id text`
- `country_code text`
- `device_type text`
- `fraud_flags jsonb`

Índices:

- `index(tenant_id, clicked_at desc)`
- `index(affiliate_link_id)`
- `index(affiliate_id, campaign_id)`
- `index(session_id)`

`conversions`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `click_id uuid -> clicks.id`
- `affiliate_link_id uuid -> affiliate_links.id`
- `campaign_id uuid -> campaigns.id`
- `product_id uuid -> products.id`
- `affiliate_id uuid -> affiliates.id`
- `advertiser_id uuid -> advertisers.id`
- `external_order_id text`
- `amount numeric(12,2)`
- `currency text`
- `status text`
- `converted_at timestamptz`
- `approved_at timestamptz`
- `metadata jsonb`

Índices:

- `index(tenant_id, converted_at desc)`
- `index(external_order_id)`
- `index(affiliate_id, status)`

`commissions`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `conversion_id uuid -> conversions.id`
- `affiliate_id uuid -> affiliates.id`
- `campaign_id uuid -> campaigns.id`
- `commission_type text`
- `commission_rate numeric(12,4)`
- `gross_amount numeric(12,2)`
- `commission_amount numeric(12,2)`
- `status text check in ('pending','approved','available','paid','reversed')`
- `available_at timestamptz`
- `paid_at timestamptz`
- `created_at timestamptz`

Índices:

- `index(tenant_id, affiliate_id, status)`
- `index(conversion_id)`

### Financeiro

`payout_requests`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `affiliate_id uuid -> affiliates.id`
- `requested_amount numeric(12,2)`
- `status text check in ('pending','approved','rejected','paid')`
- `requested_at timestamptz`
- `reviewed_at timestamptz`
- `reviewed_by uuid -> profiles.user_id`
- `notes text`

Índices:

- `index(tenant_id, affiliate_id, status)`

`payouts`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `affiliate_id uuid -> affiliates.id`
- `payout_request_id uuid -> payout_requests.id`
- `amount numeric(12,2)`
- `status text`
- `paid_at timestamptz`
- `transaction_reference text`
- `created_at timestamptz`

Índices:

- `index(tenant_id, affiliate_id, paid_at desc)`

### Governança

`audit_logs`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `actor_user_id uuid -> profiles.user_id`
- `entity_type text`
- `entity_id uuid`
- `action text`
- `payload jsonb`
- `ip_hash text`
- `created_at timestamptz`

Índices:

- `index(tenant_id, created_at desc)`
- `index(entity_type, entity_id)`

`settings`

- `tenant_id uuid pk -> tenants.id`
- `payout_min_amount numeric(12,2)`
- `default_commission_type text`
- `default_commission_value numeric(12,2)`
- `approval_required_by_default boolean`
- `branding jsonb`
- `tracking jsonb`
- `security jsonb`
- `updated_at timestamptz`

`domains`

- `id uuid pk`
- `tenant_id uuid -> tenants.id`
- `domain text unique`
- `status text`
- `verified_at timestamptz`
- `ssl_status text`
- `created_at timestamptz`

Índices:

- `unique(domain)`
- `index(tenant_id, status)`

## RBAC e RLS

Diretrizes:

- `admin` enxerga tudo do tenant e módulos globais permitidos.
- `advertiser` enxerga e altera apenas produtos, campanhas, assets, afiliados aprovados e relatórios do próprio tenant e da própria conta anunciante.
- `affiliate` enxerga apenas campanhas liberadas para ele, seus links, seus cliques, suas conversões, suas comissões e seus pedidos de saque.
- Toda tabela operacional deve carregar `tenant_id`.
- Toda policy RLS deve começar por `tenant_id = current_tenant_id()`.
- Tabelas de tracking e comissões exigem políticas de leitura recortadas por papel e propriedade.

## Roadmap de Entregas

### Entrega 1

- diagnóstico
- arquitetura de produto
- árvore de páginas
- modelo de navegação
- modelo inicial de dados
- reescrita de homepage e autenticação

### Entrega 2

- evolução de schema para tenancy, perfis e campanhas
- RBAC real com `admin`, `advertiser`, `affiliate`
- dashboards iniciais por papel

### Entrega 3

- tracking de links `/r/{codigo}`
- clique, redirecionamento e atribuição
- comissões e base de conversões

### Entrega 4

- relatórios, saques, auditoria e antifraude básico

### Entrega 5

- billing
- white label
- domínios customizados
- branding por tenant
