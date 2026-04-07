# Arquitetura do Produto

## Direcao atual

O projeto deixou de ser apenas uma vitrine simples e passou a ter duas camadas principais:

- operacao da loja: perfil, loja, categorias, produtos e administracao
- experiencia publica: pagina dinamica por blocos com foco em conversao

## Modulos ativos

### 1. Loja publica

Objetivo:

- resolver a loja por slug
- aplicar tema personalizado
- montar a pagina a partir de blocos
- registrar analytics de navegacao e clique

Arquivos centrais:

- `index.html`
- `assets/js/index.js`
- `assets/js/page-builder.js`
- `assets/js/page-analytics.js`

### 2. Gestao da loja

Objetivo:

- manter identidade da loja
- gerenciar SEO e configuracoes de conversao
- editar a pagina publica visualmente

Arquivos centrais:

- `loja.html`
- `assets/js/store.js`
- `assets/js/store-page-editor.js`

### 3. Catalogo

Objetivo:

- organizar produtos e categorias
- sustentar o bloco de produtos da pagina publica

Arquivos centrais:

- `produtos.html`
- `categorias.html`
- `assets/js/products.js`
- `assets/js/categories.js`

### 4. Admin

Objetivo:

- governar usuarios e a base

Arquivos centrais:

- `dashboard-admin.html`
- `users.html`

## Renderer reutilizavel

O renderer da pagina publica e o preview do painel usam a mesma base:

- temas e presets em `page-builder.js`
- biblioteca de blocos em `page-builder.js`
- renderizacao publica e preview com o mesmo codigo

Isso reduz divergencia entre:

- o que o afiliado edita
- o que o visitante realmente ve

## Blocos iniciais

- `hero`
- `products`
- `cta`
- `testimonials`
- `video`
- `faq`
- `footer`

Cada bloco possui:

- `enabled`
- `position`
- `config`

## Temas

Presets base:

- `moderno`
- `elegante`
- `vibrante`

Configuracoes principais:

- cor primaria
- cor secundaria
- cor do texto
- fundo da pagina
- superficie dos cards
- tipografia
- raio de borda
- estilo dos botoes
- layout dos cards
- escala de espacamento

## Conversao

Camada de conversao separada da estrutura dos blocos:

- prova social
- badge de destaque
- banner promocional
- countdown
- CTA principal
- WhatsApp flutuante

## SEO e identidade

Cada pagina pode ter:

- titulo dinamico
- meta description
- imagem de compartilhamento
- favicon/logo
- logo da pagina

## URL publica

Hoje:

- `meusite.com/slug`

Preparado para evolucao:

- `slug.meusite.com`

Essa preparacao foi concentrada em `assets/js/store-utils.js` para evitar espalhar regra de URL pelo projeto.
