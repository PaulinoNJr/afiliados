# Projeto Afiliados Mercado Livre

Site completo para divulgar produtos de afiliado do Mercado Livre, com:

- Frontend em HTML + Bootstrap 5 + JavaScript puro
- Autenticação e banco no Supabase
- Deploy preparado para Vercel
- Área pública (`index.html`) e área protegida (`admin.html`)
- Captura automática de título/preço/imagem via endpoint serverless (`/api/preview`)

## Estrutura

```
.
|-- admin.html
|-- login.html
|-- index.html
|-- vercel.json
|-- api/
|   `-- preview.js
|-- assets/
|   |-- css/
|   |   `-- style.css
|   `-- js/
|       |-- config.js
|       |-- auth.js
|       |-- login.js
|       |-- index.js
|       `-- admin.js
`-- supabase/
    `-- schema.sql
```

## 1) Configurar Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, execute o arquivo [`supabase/schema.sql`](./supabase/schema.sql).
3. No painel `Authentication > Providers`, deixe o provider de email/senha ativo.
4. Em `Authentication > URL Configuration`, adicione:
- `Site URL`: URL do seu domínio da Vercel (ou `http://localhost:3000` para teste)
- `Redirect URLs`: inclua `https://SEU-DOMINIO.vercel.app/admin.html`
5. O `schema.sql` já promove automaticamente `paulino.covabra@gmail.com` para perfil `admin`.

## 2) Configurar variáveis do Supabase no frontend

Edite [`assets/js/config.js`](./assets/js/config.js):

- `SUPABASE_URL`: URL do projeto (ex.: `https://xxxx.supabase.co`)
- `SUPABASE_ANON_KEY`: chave pública anon

Observação: a `anon key` é pública por natureza em apps frontend; a segurança real está nas políticas RLS.

## 3) Rodar localmente

Opção simples com Vercel CLI (recomendado para testar `/api/preview`):

```bash
npm i -g vercel
vercel dev
```

Abra:

- `http://localhost:3000/index.html`
- `http://localhost:3000/login.html`
- `http://localhost:3000/admin.html`

## 4) Deploy na Vercel

1. Suba o projeto para um repositório Git.
2. Importe o repositório na Vercel.
3. Framework preset: `Other`.
4. Deploy.
5. Atualize `Authentication > URL Configuration` no Supabase com a URL final da Vercel.

## Fluxo de uso

1. Acesse `login.html` e faça login com usuário existente no Supabase Auth.
2. Após login, você é redirecionado para `admin.html`.
3. O sistema usa dois perfis:
- `admin`: cria usuários e gerencia todos os produtos.
- `produtor`: gerencia apenas os próprios produtos.
4. No admin:
- Cole o link de afiliado e clique em "Preencher automaticamente".
- Ajuste manualmente campos se necessário.
- Salve produto.
5. A `index.html` pública lista os produtos em cards responsivos.

## Limitações da captura automática

A captura automática depende do HTML retornado pelo link de afiliado. Alguns cenários podem impedir extração total:

- Bloqueio anti-bot do site de destino
- Conteúdo renderizado apenas por JavaScript no lado do cliente
- Ausência de metatags (`og:title`, `og:image`, `product:price`)

Nesses casos, o formulário permite edição manual de título, imagem e preço.
