# Vitrine

Base de catalogo, loja publica e page builder para afiliados usando Vercel + Supabase.

## O que existe hoje

- frontend em HTML + Bootstrap + JavaScript puro
- autenticacao e banco no Supabase
- deploy preparado para Vercel
- painel para loja, perfil, produtos, categorias e usuarios
- pagina publica por slug
- editor visual de pagina com blocos dinamicos
- temas personalizaveis com presets
- analytics para page view, clique em CTA e clique em produto

## Estrutura principal

```text
.
|-- index.html
|-- admin.html
|-- dashboard-anunciante.html
|-- dashboard-admin.html
|-- login.html
|-- cadastro.html
|-- ativacao.html
|-- recuperar-senha.html
|-- produtos.html
|-- categorias.html
|-- loja.html
|-- perfil.html
|-- users.html
|-- api/
|-- assets/
|   |-- css/
|   |   `-- style.css
|   `-- js/
|       |-- auth.js
|       |-- app-shell.js
|       |-- store-utils.js
|       |-- page-builder.js
|       |-- page-analytics.js
|       |-- store-page-editor.js
|       `-- ...
`-- supabase/
    |-- schema.sql
    |-- email-template-confirmation.html
    `-- email-template-recovery.html
```

## Setup rapido

1. Crie um projeto no Supabase.
2. Execute [supabase/schema.sql](./supabase/schema.sql) no SQL Editor.
3. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` em [assets/js/config.js](./assets/js/config.js).
4. Configure na Vercel as variaveis de backend usadas pela pasta `api/`.
5. Rode localmente com:

```bash
npm i -g vercel
vercel dev
```

## Fluxo principal

1. Ajuste a identidade da loja em `loja.html`.
2. Organize as categorias em `categorias.html`.
3. Cadastre os produtos em `produtos.html`.
4. Monte a pagina publica no editor visual da propria `loja.html`.
5. Compartilhe a loja em `/{slug}`.

## Page builder

Blocos iniciais:

- `hero`
- `products`
- `cta`
- `testimonials`
- `video`
- `faq`
- `footer`

Cada bloco pode:

- ser ativado ou desativado
- ser reordenado
- ter configuracao propria
- ser salvo no banco

## Temas e conversao

Presets:

- `moderno`
- `elegante`
- `vibrante`

Elementos disponiveis:

- CTA destacado
- prova social
- selo visual
- countdown opcional
- banner promocional opcional
- botao flutuante de WhatsApp

## Analytics

Tabelas novas:

- `store_pages`
- `store_page_blocks`
- `store_page_analytics`

RPCs novas:

- `get_public_store_page(text)`
- `track_store_page_event(...)`

Eventos rastreados:

- visualizacao de pagina
- clique em produto
- clique em CTA
- origem por `utm_source`, `utm_medium` e `utm_campaign`

## Preparado para evolucao futura

- suporte a subdominio por afiliado na camada de URL publica
- expansao de blocos adicionais
- dashboard de analytics
- dominio customizado
- templates de pagina por nicho
