# Projeto Vitrine Mercado Livre

Base para organizar uma loja pública simples com:

- frontend em HTML + Bootstrap 5 + JavaScript puro
- autenticação e banco no Supabase
- deploy preparado para Vercel
- área pública em `index.html`
- área de gestão para produtos, categorias, loja e usuários
- captura automática de título, preço e imagem via `/api/preview`

## Estrutura

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
|   |-- preview.js
|   |-- preview-debug.js
|   |-- register-user.js
|   |-- admin-create-user.js
|   `-- admin-manage-user.js
|-- assets/
|   |-- css/
|   `-- js/
`-- supabase/
    |-- schema.sql
    |-- email-template-confirmation.html
    `-- email-template-recovery.html
```

## 1) Configurar Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, execute [`supabase/schema.sql`](./supabase/schema.sql).
3. Em `Authentication > Providers`, deixe email/senha ativo.
4. Em `Authentication > URL Configuration`, adicione:
- `Site URL`: URL da Vercel ou `http://localhost:3000`
- `Redirect URLs`: inclua `http://localhost:3000/ativacao`, `http://localhost:3000/ativacao.html`, `http://localhost:3000/recuperar-senha`, `http://localhost:3000/recuperar-senha.html` e as URLs finais da Vercel
5. Em `Authentication > Email Templates > Confirm signup`, copie o conteúdo de [`supabase/email-template-confirmation.html`](./supabase/email-template-confirmation.html).
6. Em `Authentication > Email Templates > Reset password`, copie o conteúdo de [`supabase/email-template-recovery.html`](./supabase/email-template-recovery.html).
7. O schema já promove `paulino.covabra@gmail.com` para perfil `admin`.

## 2) Configurar variáveis do frontend

Edite [`assets/js/config.js`](./assets/js/config.js):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `RECAPTCHA_SITE_KEY` se quiser ativar proteção do cadastro direto no frontend

## 3) Configurar variáveis do backend

As funções em `api/` usam:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RECAPTCHA_SECRET_KEY` se o cadastro protegido estiver ativo

Importante:

- Configure essas variáveis na Vercel.
- Em ambiente local com `vercel dev`, use `.env.local`.
- `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para o frontend.

## 4) Rodar localmente

```bash
npm i -g vercel
vercel dev
```

Abra:

- `http://localhost:3000/index.html`
- `http://localhost:3000/login.html`
- `http://localhost:3000/admin.html`

## 5) Fluxo principal

1. Crie a conta em `cadastro.html`.
2. Ative o email em `ativacao.html`.
3. Entre pelo `login.html`.
4. No painel:
- ajuste a loja em `loja.html`
- organize categorias em `categorias.html`
- cadastre produtos em `produtos.html`
5. A página pública por slug aparece em `/{slug}`.

Perfis ativos:

- `admin`: gerencia usuários e acompanha a base
- `advertiser`: gestor da loja, produtos e categorias

## 6) Captura automática de produto

O endpoint [`/api/preview`](./api/preview.js) tenta preencher:

- nome do produto
- imagem principal
- preço
- descrição

Você pode usar o campo de link do produto em `produtos.html` e clicar em `Preencher`.

## 7) Open.Claw opcional

O projeto ainda aceita Open.Claw como fonte principal de captura. Variáveis:

- `OPENCLAW_BASE_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_GATEWAY_PASSWORD`
- `OPENCLAW_AGENT_ID`
- `OPENCLAW_MODEL`
- `OPENCLAW_TIMEOUT_MS`

Se falhar, o sistema continua com fallback.

## 8) Recuperação de senha

O fluxo implementado:

- responde de forma neutra
- valida o link antes de consumir o token
- usa regras mínimas de senha
- devolve o usuário ao login após a troca

## 9) Limitações da captura

A captura automática pode falhar quando:

- o site de destino bloqueia bots
- o conteúdo depende de JavaScript
- faltam metatags úteis
- Open.Claw não está configurada

Nesses casos, o formulário permite edição manual.
