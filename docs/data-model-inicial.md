# Modelo de Dados Inicial

## Entidades principais

### `user_profiles`

- `user_id uuid pk -> auth.users.id`
- `user_email text`
- `role text check ('admin', 'advertiser')`
- `account_type text check ('advertiser')`
- `company_name text`
- `first_name text`
- `last_name text`
- `phone text`
- `store_name text`
- `slug text unique`
- `slug_changed_at timestamptz`
- `activation_status text check ('pending', 'active', 'expired')`
- `activation_requested_at timestamptz`
- `activation_email_sent_at timestamptz`
- `activation_expires_at timestamptz`
- `activation_confirmed_at timestamptz`
- `headline text`
- `accent_color text`
- `text_color text`
- `page_background text`
- `button_text_color text`
- `button_style text`
- `card_style text`
- `cta_label text`
- `bio text`
- `photo_url text`
- `banner_url text`
- `created_at timestamptz`
- `updated_at timestamptz`

### `product_categories`

- `id uuid pk`
- `profile_id uuid fk -> auth.users.id`
- `name text`
- `slug text`
- `sort_order integer`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices sugeridos:

- `(profile_id, sort_order)`
- `(profile_id, slug)` único

### `produtos`

- `id uuid pk`
- `profile_id uuid fk -> auth.users.id`
- `category_id uuid fk -> product_categories.id`
- `created_by uuid fk -> auth.users.id`
- `titulo text`
- `preco numeric(12,2)`
- `imagem_url text`
- `product_url text`
- `descricao text`
- `source_url text`
- `ml_item_id text`
- `ml_currency text`
- `ml_permalink text`
- `ml_thumbnail text`
- `ml_pictures jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Índices sugeridos:

- `(profile_id, updated_at desc)`
- `(profile_id, category_id)`

## Funções utilitárias

- `normalize_slug(text)`
- `is_reserved_store_slug(text)`
- `generate_unique_store_slug(text, uuid)`
- `check_public_slug_availability(text, uuid)`
- `get_public_store_by_slug(text)`
- `get_public_products_by_profile(uuid)`
- `finalize_account_activation()`

## Regras de acesso

- `admin`: lê e administra toda a base
- `advertiser`: lê e altera apenas seu perfil, suas categorias e seus produtos
- leitura pública: somente via funções/visões da loja pública
