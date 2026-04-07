# Modelo de Dados

## Entidades base

### `user_profiles`

Responsavel por:

- identidade da conta
- dados publicos da loja
- slug principal
- configuracoes legadas de tema da vitrine

### `product_categories`

Responsavel por:

- agrupamento e ordenacao de produtos por loja

### `produtos`

Responsavel por:

- catalogo
- destaque principal (`is_featured`)
- dados de exibicao publica

## Novas entidades do page builder

### `store_pages`

Uma pagina por afiliado/loja.

Campos principais:

- `profile_id`
- `status`
- `theme_key`
- `title`
- `description`
- `theme_settings jsonb`
- `seo_settings jsonb`
- `conversion_settings jsonb`
- `page_settings jsonb`

Uso:

- concentrar configuracao global da pagina
- separar tema, SEO e conversao do perfil basico da loja

### `store_page_blocks`

Lista de blocos que compoe a pagina.

Campos principais:

- `page_id`
- `profile_id`
- `block_type`
- `label`
- `is_enabled`
- `position`
- `config jsonb`

Blocos suportados:

- `hero`
- `products`
- `cta`
- `testimonials`
- `video`
- `faq`
- `footer`

### `store_page_analytics`

Tabela preparada para rastrear eventos da pagina.

Campos principais:

- `profile_id`
- `page_id`
- `product_id`
- `event_name`
- `event_source`
- `block_type`
- `page_slug`
- `visitor_id`
- `referrer_url`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `payload jsonb`

Eventos iniciais:

- `page_view`
- `product_click`
- `cta_click`

## Funcoes novas

- `get_public_store_page(text)`
- `track_store_page_event(...)`

## Regras de acesso

### Publico

- le via RPC publica
- rastreia eventos via RPC publica

### Authenticated advertiser/admin

- le e altera `store_pages`
- le e altera `store_page_blocks`
- le analytics da propria loja ou como admin

## Observacoes de evolucao

- a estrutura ja suporta novos blocos via `block_type + config jsonb`
- a camada de URL publica foi preparada para slug por caminho e subdominio futuro
- analytics pode evoluir para dashboard sem trocar o modelo base
