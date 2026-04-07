# Arquitetura do Produto

## Direção atual

O projeto foi reposicionado para um escopo mais enxuto:

- catálogo de produtos
- categorias
- página pública por slug
- personalização visual da loja
- gestão de usuários

## Módulos ativos

### 1. Público

Objetivo: apresentar o produto e renderizar lojas públicas.

Páginas:

- `/`
- `/{slug}`

### 2. Gestão da loja

Objetivo: manter a base da loja organizada.

Páginas:

- `/admin`
- `/dashboard-anunciante`
- `/produtos`
- `/categorias`
- `/loja`
- `/perfil`

### 3. Admin

Objetivo: governar acessos e acompanhar a saúde da base.

Páginas:

- `/dashboard-admin`
- `/users`

## Navegação

### Gestor

- Painel
- Loja
- Perfil
- Produtos
- Categorias

### Admin

- Painel
- Usuários
- Loja
- Perfil
- Produtos
- Categorias

## Princípios da remodelagem

- uma tela para cada responsabilidade principal
- separação clara entre dados pessoais e identidade da loja
- catálogo e categorias como centro da rotina
- página pública como saída natural do trabalho no painel
- backoffice restrito à gestão de usuários e visão geral da base

## Estrutura de dados

O modelo atual precisa de poucas entidades:

- `user_profiles`
- `product_categories`
- `produtos`

Além disso:

- funções para slug público
- função de ativação de conta
- funções públicas para buscar loja e produtos por slug

## Próximos passos possíveis

- melhorar o editor visual da loja
- adicionar upload mais rico de mídia
- criar indicadores simples de qualidade do catálogo
- evoluir importação de produtos em lote
