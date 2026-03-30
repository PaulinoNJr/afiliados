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
|-- users.html
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
|       |-- admin.js
|       `-- users.js
`-- supabase/
    `-- schema.sql
```

## 1) Configurar Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, execute o arquivo [`supabase/schema.sql`](./supabase/schema.sql).
3. No painel `Authentication > Providers`, deixe o provider de email/senha ativo.
4. Em `Authentication > URL Configuration`, adicione:
- `Site URL`: URL do seu domínio da Vercel (ou `http://localhost:3000` para teste)
- `Redirect URLs`: inclua `http://localhost:3000/ativacao`, `http://localhost:3000/ativacao.html`, `https://SEU-DOMINIO.vercel.app/ativacao` e `https://SEU-DOMINIO.vercel.app/ativacao.html`
5. Em `Authentication > Email Templates > Confirm signup`, copie o conteudo de [`supabase/email-template-confirmation.html`](./supabase/email-template-confirmation.html) para que o Supabase use o template customizado do projeto.
6. O `schema.sql` já promove automaticamente `paulino.covabra@gmail.com` para perfil `admin`.

## 2) Configurar variáveis do Supabase no frontend

Edite [`assets/js/config.js`](./assets/js/config.js):

- `SUPABASE_URL`: URL do projeto (ex.: `https://xxxx.supabase.co`)
- `SUPABASE_ANON_KEY`: chave pública anon

Observação: a `anon key` é pública por natureza em apps frontend; a segurança real está nas políticas RLS.

## 2.1) Configurar variaveis do Supabase no backend

As funcoes serverless em `api/` precisam destas variaveis de ambiente:

- `SUPABASE_URL`: URL do projeto Supabase
- `SUPABASE_ANON_KEY`: chave anon usada em fluxos publicos protegidos no backend
- `SUPABASE_SERVICE_ROLE_KEY`: chave privada do backend, obrigatoria para criar, desativar e excluir usuarios pelo painel admin

Importante:

- Configure essas variaveis em `Project Settings > Environment Variables` na Vercel.
- Em ambiente local com `vercel dev`, coloque os valores em `.env.local`.
- A `SUPABASE_SERVICE_ROLE_KEY` nunca deve ir para `assets/js/config.js` nem para o frontend.

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

## 5) Integrar com Open.Claw

O endpoint [`/api/preview`](./api/preview.js) agora tenta usar a Open.Claw como fonte principal para extrair:

- nome do produto
- imagem principal
- preço
- descrição

Configure estas variáveis de ambiente na Vercel ou no ambiente local:

- `OPENCLAW_BASE_URL`: base HTTP do Gateway OpenClaw com `chatCompletions` habilitado. Ex.: `http://127.0.0.1:18789`
- `OPENCLAW_GATEWAY_TOKEN`: token bearer do Gateway
- `OPENCLAW_GATEWAY_PASSWORD`: alternativa ao token, se o Gateway estiver em modo password
- `OPENCLAW_AGENT_ID`: agente alvo. Padrão: `main`
- `OPENCLAW_MODEL`: opcional. Padrão: `openclaw:<agentId>`
- `OPENCLAW_TIMEOUT_MS`: timeout da chamada HTTP. Padrão: `30000`

Observações:

- A Open.Claw é usada primeiro; se falhar ou retornar dados parciais, o sistema continua com o fallback atual.
- A URL em `OPENCLAW_BASE_URL` precisa ser alcançável pelo ambiente onde o endpoint roda. `127.0.0.1` funciona em `vercel dev`, mas não no deploy hospedado da Vercel.
- O endpoint `/v1/chat/completions` da OpenClaw deve estar habilitado no Gateway.
- Mantenha o Gateway privado. O bearer token da Open.Claw deve ser tratado como credencial sensível de operador.

### Teste local com `vercel dev`

1. Inicie a Open.Claw com o endpoint `chatCompletions` habilitado.
2. Crie um arquivo `.env.local` na raiz do projeto com algo como:

```env
OPENCLAW_BASE_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=seu-token-forte
OPENCLAW_AGENT_ID=main
OPENCLAW_MODEL=openclaw:main
OPENCLAW_TIMEOUT_MS=30000
```

3. Suba o projeto com:

```bash
vercel dev
```

4. Teste a configuração da Open.Claw:

```bash
curl "http://localhost:3000/api/preview-debug"
```

5. Teste conectividade/autenticação com o gateway:

```bash
curl "http://localhost:3000/api/preview-debug?probe=1"
```

6. Teste extração com um link de afiliado:

```bash
curl "http://localhost:3000/api/preview-debug?url=https%3A%2F%2Fmeli.la%2F2uK99UE"
```

Leituras esperadas:

- `config.configured: true`: variáveis carregadas.
- `probe.ok: true`: gateway respondeu.
- `probe.parsed_json`: a Open.Claw conseguiu devolver JSON de produto.

Se o `probe` vier com erro, o motivo é retornado no próprio JSON.

### Deploy na Vercel

Se o projeto estiver hospedado na Vercel, configure as mesmas variáveis em `Project Settings > Environment Variables`.

Importante:

- `OPENCLAW_BASE_URL=http://127.0.0.1:18789` não funciona na Vercel hospedada.
- A Open.Claw precisa estar em uma URL privada alcançável pela função serverless, por exemplo:
  - uma máquina/VPS na mesma rede privada
  - um proxy interno protegido
  - um host acessível via VPN/tailnet

Depois do deploy, você pode validar pelo navegador ou `curl`:

```bash
curl "https://SEU-DOMINIO.vercel.app/api/preview-debug"
curl "https://SEU-DOMINIO.vercel.app/api/preview-debug?probe=1"
```

### Diagnóstico rápido

O endpoint [`/api/preview-debug`](./api/preview-debug.js) serve para isolar a Open.Claw do resto da captura:

- sem query: mostra se a configuração existe
- `?probe=1`: testa se o gateway responde
- `?url=...`: testa a extração de um link de afiliado usando a Open.Claw

No `admin.html`, a mensagem de preenchimento automático agora informa também quando:

- a Open.Claw não está configurada
- a Open.Claw falhou e o sistema caiu no fallback do Mercado Livre

## Fluxo de uso

1. Acesse `login.html` e faça login com usuário existente no Supabase Auth.
2. Após login, você é redirecionado para `admin.html`.
3. O sistema usa dois perfis:
- `admin`: cria usuários e gerencia todos os produtos.
- `produtor`: gerencia apenas os próprios produtos.
4. O `admin` também acessa `users.html` para:
- listar usuários
- alterar perfil (`admin`/`produtor`)
- criar novos usuários
5. No admin:
- Cole o link de afiliado e clique em "Preencher automaticamente".
- Ajuste manualmente campos se necessário.
- Salve produto.
6. A `index.html` pública lista os produtos em cards responsivos.

## Limitações da captura automática

A captura automática pode usar Open.Claw, API pública do Mercado Livre e metadados HTML. Alguns cenários ainda podem impedir extração total:

- Bloqueio anti-bot do site de destino
- Conteúdo renderizado apenas por JavaScript no lado do cliente
- Ausência de metatags (`og:title`, `og:image`, `product:price`)
- Open.Claw não configurada, indisponível ou sem acesso ao link de destino

Nesses casos, o formulário permite edição manual de título, imagem e preço.
