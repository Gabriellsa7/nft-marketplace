# Kurio — NFT Marketplace

Frontend do desafio "Marketplace de NFTs": catálogo, carrinho, checkout, conta do colecionador e tempo real via Socket.IO, tudo contra uma API 100% simulada com MSW (sem backend real). Ver `challenge.md` para o enunciado completo e `ARCHITECTURE.md` para contratos, decisões de arquitetura e desvios do Figma.

## Deploy

**URL pública:** <https://nft-marketplace-wheat.vercel.app/>

Publicado na Vercel a partir deste repositório (build de produção `npm run build`), com os mocks (MSW + Socket.IO) ativos — a versão publicada roda inteiramente sem backend real, igual ao ambiente local. Acesso direto e refresh em qualquer rota funcionam normalmente.

## Stack

React 19 + TypeScript, TanStack Router (rotas e estado da URL) e TanStack Query (estado remoto), Axios, Socket.IO (`socket.io-client` + [`@mswjs/socket.io-binding`](https://github.com/mswjs/socket.io-binding) do lado mock), Tailwind CSS v4 + shadcn/ui (sobre Base UI), MSW 2, Playwright, Lighthouse.

## Setup

```bash
npm install
cp .env.example .env.local   # valores padrão já funcionam sem edição
npm run dev                  # http://localhost:5173, mocks ligados
```

Não há backend real: todo tráfego de rede é interceptado por um Service Worker do MSW (`public/mockServiceWorker.js`, gerado por `npx msw init public/`) enquanto `VITE_ENABLE_MOCKS=true`. O estado da simulação (usuários, NFTs, carrinho, pedidos, sessões) persiste em `localStorage` do navegador, então cada aba/perfil de navegador tem seu próprio "banco" — não há dados compartilhados entre dispositivos nem serviço externo.

### Variáveis de ambiente

| Variável | Padrão (`.env.example`) | Efeito |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST + Socket.IO). Com `false`, o app tentaria falar com uma API/Socket real em `VITE_API_URL`/`VITE_SOCKET_URL` — não há tal backend nesta entrega, então mantenha `true`. |
| `VITE_API_URL` | `/api` | Base das chamadas Axios. |
| `VITE_SOCKET_URL` | `/` | Origem à qual o `socket.io-client` tenta conectar. |

### Resetar o cenário para o estado inicial

O "banco" simulado vive em `localStorage["nft-marketplace-mock-db-v2"]`. Para voltar ao estado inicial (42 NFTs, 2 usuários demo, sem carrinho/pedidos):

```js
localStorage.removeItem('nft-marketplace-mock-db-v2')
```

e recarregue a página — ou simplesmente abra em uma aba anônima/nova, já que cada `localStorage` é isolado por origem/perfil. Cada teste Playwright já parte disso automaticamente (contexto de navegador novo = storage vazio = reseed).

## Credenciais fictícias

| E-mail | Senha | Observação |
| --- | --- | --- |
| `ana@demo.nft` | `demo1234` | 1 carteira (Ethereum), favoritos pré-cadastrados |
| `bruno@demo.nft` | `demo1234` | 2 carteiras (Polygon principal + Arbitrum secundária) |

Cadastro (`/register`) também funciona livremente para criar novas contas — sem verificação de e-mail, senha nunca é armazenada em claro (hash simples do lado mock, ver `src/mocks/hash.ts`).

Cupons de teste (aplicáveis no carrinho): `WELCOME10` (desconto de 0.05 ETH), `NFTDROP` (0.1 ETH), `EXPIRED5` (expirado — sempre rejeitado, para testar tratamento de erro).

## Cenários de mock (rede, latência e falhas)

A rede simulada tem 5 cenários (`src/mocks/scenario.ts`), selecionáveis de duas formas:

- Query string: `?mock_scenario=slow` (persiste em `localStorage` automaticamente após a primeira leitura);
- Diretamente: `localStorage.setItem('nft-marketplace-mock-scenario', 'offline')` + recarregar/reagir a uma nova requisição.

| Cenário | Comportamento |
| --- | --- |
| `default` | Latência leve (80–300ms), sem falhas artificiais. |
| `slow` | Latência alta (1.5–4s) em toda chamada — para exercitar skeletons. |
| `flaky` | Latência variável + ~25% de chance de falha de conexão por chamada (determinístico por chave de requisição, então reproduzível). |
| `offline` | Toda chamada falha com "falha de conexão" (503 `transient_error`) após 300ms. |
| `empty` | O catálogo (`GET /api/nfts`) sempre retorna 0 itens, para testar o estado vazio independente de filtros. |

Os cenários afetam apenas as chamadas REST simuladas (`simulateNetwork()` dentro de cada handler); a UI trata cada erro pelo `code` do corpo `ApiErrorBody` (`transient_error`, `unauthenticated`, `validation_error`, `conflict`, `coupon_invalid`, `coupon_expired`, `availability_conflict`, `quote_stale`, `idempotency_conflict`, `not_found`).

### Reproduzindo fluxos de falha específicos

- **Sessão expirada**: `POST /api/auth/_expire` (hook só-de-teste, requer `Authorization: Bearer <token>`) expira a sessão atual imediatamente — qualquer chamada autenticada seguinte devolve 401 e a UI redireciona para `/login?redirect=...`.
- **Preço/disponibilidade mudando ao vivo**: `POST /api/nfts/:id/_simulate-update` com corpo `{ editionId?, priceEth?, available? }` dispara um `nft.updated` real via Socket.IO (mesmo caminho que o drift ambiente automático a cada 25s, mas determinístico). Usado extensivamente em `e2e/realtime.spec.ts` e `e2e/purchase.spec.ts`.
- **Pedido confirmado/recusado sem esperar a simulação de ~4s**: `POST /api/orders/:id/_resolve` com `{ status: 'confirmed' | 'declined' }` resolve um pedido pendente na hora, emitindo `order.updated`. Sem isso, todo pedido resolve sozinho após 4s com 8% de chance de recusa (aleatório, para a demonstração parecer "viva").
- **Cupom inválido/expirado**: use qualquer código além de `WELCOME10`/`NFTDROP` (inválido) ou `EXPIRED5` (expirado).
- **Conflito de cadastro/carteira**: cadastre-se com `ana@demo.nft` (e-mail já existe) ou cadastre uma carteira com o endereço `0xA1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2` (carteira principal da Ana).
- **Idempotência de pedido**: reenviar `POST /api/orders` com o mesmo header `Idempotency-Key` e corpo idêntico devolve o mesmo pedido (200); corpo diferente com a mesma chave devolve 409 `idempotency_conflict`.

Todos os hooks `_expire`/`_simulate-update`/`_resolve` são endpoints reais do MSW (não atalhos na UI) — os testes Playwright passam por eles via `fetch()` na página, nunca chamando lógica de negócio diretamente.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) com mocks ligados. |
| `npm run build` | `tsr generate && tsc -b && vite build` — build de produção (mocks continuam disponíveis, controlados por `VITE_ENABLE_MOCKS` no ambiente de build/deploy). |
| `npm run preview` | Serve o build de produção localmente. |
| `npm run typecheck` | `tsr generate && tsc -b --noEmit`. Para checagens rápidas ad-hoc, prefira `npx tsc --noEmit -p tsconfig.app.json` (`tsc -p .` sozinho não checa nada neste repo — o `tsconfig.json` raiz é só um solution file). |
| `npm run lint` | ESLint. |
| `npm run test:e2e` | Playwright — sobe o próprio dev server (`webServer` no `playwright.config.ts`) e roda em Chromium desktop + mobile (Pixel 7). Relatório HTML em `playwright-report/` (`npx playwright show-report`); traces de falhas ficam em `test-results/`. |
| `npx playwright test --update-snapshots` | Regenera as baselines de regressão visual (`e2e/visual.spec.ts-snapshots/`) depois de uma mudança visual intencional. |
| `npm run lighthouse` | Builda (se necessário), sobe o preview de produção e audita início/detalhe em mobile e desktop, 3 execuções cada, com os mocks ativos. Config em `scripts/lighthouse.mjs`. Relatórios HTML/JSON por execução em `lighthouse-reports/` (não versionados, regeneráveis); a mediana consolidada fica em `lighthouse-reports/summary.md` (versionado). Análise e causas de qualquer categoria abaixo da meta estão em `ARCHITECTURE.md` → "Performance (Lighthouse)". |

## Estrutura dos testes E2E (`e2e/`)

Cada arquivo cobre um fluxo do enunciado (§9): `catalog` (busca/filtros/paginação/histórico + acesso direto/404), `auth` (cadastro/login/expiração/logout/troca de usuário), `favorites`, `cart`, `purchase` (compra completa + preço mudando durante o checkout), `payment-failure` (recusa, idempotência, clique repetido), `account` (perfil/senha/carteiras), `realtime` (eventos duplicados/antigos, reconexão, retomada de pedido pendente), `keyboard-a11y`, `loading-states` (skeletons/erro/recuperação) e `visual` (regressão visual). `e2e/utils.ts` concentra os helpers compartilhados — em especial, chamadas a endpoints mockados feitas a partir do teste **precisam** passar por `fetch()` dentro da página (`fetchInPage`), nunca por `page.request`, porque o Service Worker do MSW só intercepta requisições da própria página.
