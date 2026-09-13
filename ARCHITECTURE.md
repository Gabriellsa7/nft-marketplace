# Arquitetura

Este documento cobre os contratos REST e de eventos, a política de sessão, o estado do carrinho, a estratégia de cache do TanStack Query, a reconciliação REST/Socket.IO, limitações conhecidas, decisões de UX e os desvios do Figma. Para setup/comandos/credenciais, ver `README.md`.

## Contratos REST

Base: `/api` (via Axios, `src/lib/api-client.ts`). Erros seguem sempre o formato `ApiErrorBody`: `{ code, message, fields? }`, com `code` em `ApiErrorCode` (`validation_error`, `unauthenticated`, `conflict`, `not_found`, `availability_conflict`, `coupon_invalid`, `coupon_expired`, `quote_stale`, `idempotency_conflict`, `transient_error`).

| Recurso | Endpoint | Observações |
| --- | --- | --- |
| Sessão | `POST /auth/register` | Cria conta + sessão; 422 (campos) ou 409 (e-mail já cadastrado). |
| | `POST /auth/login` | 401 com erro no campo `password` em caso de credenciais inválidas. |
| | `GET /auth/session` | Nunca dispara o evento global de "sessão expirada" (ver política de sessão); 401 é tratado como "sem sessão", não como erro. |
| | `POST /auth/logout` | Remove a sessão do lado mock. |
| | `POST /auth/_expire` *(teste)* | Expira a sessão atual imediatamente. |
| NFTs | `GET /nfts?search&category&minPrice&maxPrice&sort&page&pageSize` | Paginado (`Paginated<Nft>`); busca cobre nome/coleção/criador/descrição. |
| | `GET /nfts/:id` | Aceita id ou slug; 404 dedicado (tratado como `notFound()` na rota). |
| | `POST /nfts/:id/_simulate-update` *(teste)* | Dispara `nft.updated` determinístico. |
| Favoritos | `GET /favorites` | Requer sessão. |
| | `POST /favorites/:nftId` / `DELETE /favorites/:nftId` | Idempotentes (adicionar 2x não duplica). |
| Carrinho | `GET /cart` | Também re-sincroniza preço/disponibilidade contra o catálogo vivo a cada leitura (ver "Estado do carrinho"). |
| | `POST /cart/items` `{nftId, editionId, quantity}` | 409 `availability_conflict` se exceder o estoque. |
| | `PATCH /cart/items/:itemId` `{quantity}` | |
| | `DELETE /cart/items/:itemId` | |
| | `POST /cart/merge` `{guestCartId}` | Só autenticado; funde o carrinho de visitante no da conta. |
| Cotação | `POST /quote` `{items, couponCode?}` | Recalcula subtotal/desconto/taxa/total em `decimal.js`; devolve `quoteVersion` (TTL de 2 min) usado para criar o pedido. |
| Pedidos | `POST /orders` `{quoteVersion, walletId, network, collectorName, collectorEmail}` | Requer header `Idempotency-Key` (ver "Idempotência"). |
| | `GET /orders/:id` | Só o dono do pedido pode ler. |
| | `POST /orders/:id/_resolve` *(teste)* `{status}` | Resolve um pedido pendente na hora (confirmado/recusado). |
| Perfil | `GET /profile` / `PATCH /profile` `{name?, email?, avatarUrl?}` | E-mail duplicado → 409. |
| | `POST /profile/password` `{currentPassword, newPassword}` | Ao suceder, invalida todas as outras sessões do usuário. |
| Carteiras | `GET /wallets` / `POST /wallets` / `PATCH /wallets/:id` | Endereço deve casar `^0x[a-fA-F0-9]{40}$`; endereço duplicado → 409; marcar uma carteira como `primary` rebaixa a anterior. |

Os três endpoints marcados *(teste)* existem só para dar determinismo aos testes Playwright (ver README) — nunca são chamados pela UI de produção.

## Eventos Socket.IO

Transporte: `socket.io-client` real, mockado via [`@mswjs/socket.io-binding`](https://github.com/mswjs/socket.io-binding) (`src/mocks/socket-server.ts`). Limitações documentadas do ambiente de mock:

- O binding só intercepta o handshake **WebSocket** nativo do Socket.IO, não o long-polling HTTP — por isso o cliente é forçado a `transports: ['websocket']` (`src/lib/socket.ts`), pulando a etapa de upgrade que o mock não entende.
- MSW normaliza `/socket.io/` para `/` no pathname antes de casar o link — o `ws.link()` do lado servidor aponta para a origem "nua" (`ws://host/`), nunca incluindo `/socket.io/` no padrão.
- `socket.io-client` captura `globalThis.WebSocket` no momento em que o módulo é importado, não quando conecta. Por isso `getSocket()` faz um `import()` dinâmico, chamado só de dentro de um `useEffect` — garantindo que o MSW já tenha corrigido `window.WebSocket` antes do cliente real ser instanciado.

Eventos implementados:

| Evento | Payload | Escopo | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | `RealtimeEnvelope<Nft>` | Broadcast (dado público de catálogo) | Atualiza o cache do detalhe se `version` for maior; invalida listas de catálogo, carrinho e cotação. |
| `order.updated` | `RealtimeEnvelope<Order>` | Só para a conexão identificada como dona do pedido | Atualiza o cache do pedido se `version` for maior. |

`RealtimeEnvelope<T> = { resourceId, version, occurredAt, resource }`. Todo handler de evento compara a `version` recebida com a do recurso em cache e só aplica se for estritamente maior — eventos duplicados ou fora de ordem nunca regridem um estado mais novo (coberto por `e2e/realtime.spec.ts`).

O cliente se identifica ao servidor logo após conectar (`socket.emit('identify', token)`), inclusive em toda reconexão — é assim que `order.updated` nunca vaza entre sessões: o servidor só emite para conexões cujo `identify` mais recente corresponde ao usuário dono do pedido.

## Política de sessão

- Token opaco (`tok_...`) emitido em login/registro, guardado em `localStorage["nft-marketplace-auth-token"]`, enviado como `Authorization: Bearer <token>`. TTL de 20 minutos no lado mock (`SESSION_TTL_MS`).
- Visitante (sem token) usa um `X-Guest-Cart-Id` gerado uma vez e persistido em `localStorage["nft-marketplace-guest-cart-id"]`, para o carrinho sobreviver a refresh antes do login.
- `GET /auth/session` resolve para `null` em vez de lançar em caso de 401 (`fetchSession()` em `features/auth/api.ts`) — assim navegação anônima não dispara nenhum evento de "não autorizado".
- Qualquer **outra** chamada autenticada que volte 401 dispara `UNAUTHORIZED_EVENT` (`window` custom event, `src/lib/api-client.ts`), ouvido uma única vez em `__root.tsx`: limpa o cache de `session` e de todos os dados privados (`cart`, `favorites`, `orders`, `profile`, `wallets`) e redireciona para `/login?redirect=<url atual>` — cobrindo tanto expiração durante navegação quanto durante o checkout, com retomada após novo login.
- Logout e troca de usuário passam pelo mesmo `clearPrivateCaches()` (usado também no `onSuccess` de login/registro) — garante que dados da sessão anterior nunca aparecem, nem por um instante, sob a nova sessão.
- Alterar a senha invalida todas as **outras** sessões do usuário (mantém só a que fez a troca).

## Estado do carrinho

- Particionado por "dono do carrinho": `user:<id>` quando autenticado, `guest:<guestCartId>` caso contrário (`resolveCartOwner()`).
- `POST /cart/merge`, chamado automaticamente após login/registro bem-sucedido, funde o carrinho de visitante no da conta (soma quantidades, limitada à disponibilidade da edição) e descarta o carrinho de visitante.
- Toda leitura (`GET /cart`) re-sincroniza cada item contra o catálogo vivo, marcando `priceChanged`/`availabilityChanged` sem alterar a quantidade guardada — é assim que o carrinho mostra o aviso "o preço mudou" mesmo que o usuário não tenha feito nada. Essas flags são "de um só disparo": a própria leitura que as marca `true` já normaliza o preço guardado, então a leitura seguinte já volta a `false`. Por isso `handleConfirm` (`src/routes/checkout.tsx`) **revalida com um refetch explícito de carrinho e cotação**, não com o valor em cache — usar o carrinho em cache podia tanto deixar passar uma mudança real (se o carrinho ainda não tivesse revalidado desde o evento) quanto travar a confirmação indefinidamente (se o único refetch em voo pousasse bem no instante "sujo", sem nada disparando um segundo refetch depois). Bug real pego por `e2e/purchase.spec.ts` (falhava de forma intermitente, ~1 em cada 10 execuções) e corrigido nesta sessão.
- Valores em ETH trafegam sempre como string decimal (nunca `number`), calculados com `decimal.js` no lado mock, para não perder precisão.
- Estoque só é decrementado e itens só são removidos do carrinho **na confirmação** do pedido, nunca na criação (ver "Ciclo de vida do pedido").

## Estratégia de cache (TanStack Query)

| Query | `staleTime` | Retry | Notas |
| --- | --- | --- | --- |
| `session` | 60s | não | Evita rechecar a sessão a cada navegação. |
| `cart` | 10s | padrão | Curto o bastante para refletir mutações de outra aba/evento em tempo real. |
| `favorites` | padrão | padrão | Habilitada só quando há usuário logado. |
| `quote` | 15s | não | `keepPreviousData` evita flicker de skeleton a cada pequena edição de quantidade/cupom; chave inclui os itens + cupom, então muda de identidade a cada edição real. |
| `nfts` (lista) | padrão | padrão | `keepPreviousData` evita flicker ao paginar/filtrar. |
| `nfts` (detalhe) | padrão | 1 tentativa, **nunca** em 404 | 404 vai direto para o estado "não encontrado". |
| `orders/:id` | padrão | padrão | `refetchInterval` de 1.5s **enquanto** `status === 'pending'`; para sozinho ao virar terminal (`confirmed`/`declined`). Esse polling é o fallback REST que reconcilia o estado do pedido em caso de desconexão do socket ou reload da página. |

Atualização otimista com rollback: favoritar/desfavoritar (`useToggleFavoriteMutation`) e alterar quantidade/remover item do carrinho (`useUpdateCartItemMutation`/`useRemoveCartItemMutation`) aplicam a mudança no cache imediatamente (`onMutate`) e revertem (`onError`) se a mutação falhar — cobertos por `e2e/favorites.spec.ts` (falha forçada via cenário `offline`) e `e2e/cart.spec.ts`. Adicionar item ao carrinho **não** é otimista (só atualiza o cache em `onSuccess`) — decisão deliberada, já que adicionar depende de uma resposta do servidor com o item já mesclado/validado contra o estoque.

## Reconciliação REST ↔ Socket.IO

`useRealtimeSync()` (montado uma única vez em `__root.tsx`) é o ponto único de reconciliação:

1. No `connect` do socket (incluindo toda reconexão), emite `identify(token)` e invalida `['nfts']`, `['cart']`, `['quote']` e `['orders']` — qualquer evento perdido enquanto desconectado é reparado por um refetch REST imediato.
2. `nft.updated`/`order.updated` só são aplicados se a `version` do envelope for maior que a do cache (tolera duplicatas/entrega fora de ordem sem regredir estado).
3. O efeito depende do `userId` da sessão — trocar de usuário desconecta e reconecta o socket do zero, então o `identify` sempre reflete a sessão atual e um evento da sessão anterior nunca alcança a próxima.
4. Um pedido pendente sobrevive a um reload de página: `GET /orders/:id` (com `refetchInterval` enquanto pendente) e a reconexão do socket cobrem a mesma necessidade por dois caminhos independentes — o que chegar primeiro atualiza a UI, sem duplicar a compra (coberto por `e2e/realtime.spec.ts`).

## Idempotência e ciclo de vida do pedido

- `POST /orders` exige o header `Idempotency-Key`. O mock guarda `{orderId, requestHash}` por chave (`requestHash` = SHA-256 do corpo). Mesma chave + mesmo corpo → devolve o pedido já criado (200); mesma chave + corpo diferente → 409 `idempotency_conflict`.
- O checkout (`src/routes/checkout.tsx`) gera uma chave por tentativa de compra via `sessionStorage`, só limpa em caso de sucesso — então um clique duplo, um timeout de rede ou um reload antes da resposta reaproveitam a mesma chave, garantindo no máximo um pedido por tentativa.
- Antes de confirmar, o checkout busca uma cotação fresca (`quote.refetch()`) e compara com a cotação revisada na tela; qualquer diferença de total/subtotal, ou um item do carrinho marcado como alterado, bloqueia o envio e exige nova revisão do colecionador (cenário do enunciado: preço mudando durante o checkout).
- **Estoque só é decrementado e o carrinho só perde os itens comprados na confirmação do pedido** (`resolveOrder()` em `src/mocks/handlers/orders.ts`), nunca na criação. Um pedido `pending` ou `declined` não tem nenhum efeito colateral em estoque/carrinho — corrige uma inconsistência inicial em que a recusa "consumia" o item mesmo dizendo ao usuário que ele "continua disponível para nova compra". Resolução acontece via um timer real de ~4s com 8% de chance de recusa (comportamento de demonstração) ou, em teste, via `POST /orders/:id/_resolve`.
- O recibo (`GET /orders/:id`) é um snapshot: valores gravados no momento da criação do pedido, nunca recalculados a partir do catálogo atual — uma mudança de preço posterior no mesmo NFT não altera pedidos já criados.

## Performance (Lighthouse)

Auditoria em `início` (`/`) e `detalhe` (`/nfts/nft-0`), mobile e desktop, 3 execuções cada, com o build de produção (`npm run build && npm run lighthouse`) e os mocks ativos, exatamente como a entrega final é servida. Config versionada em `scripts/lighthouse.mjs`; relatórios brutos (HTML/JSON por execução) ficam em `lighthouse-reports/` (gerados localmente, não versionados — ver `.gitignore`); a mediana consolidada fica em `lighthouse-reports/summary.md`/`summary.json`, versionados.

Mediana das 3 execuções (Lighthouse 13.4.1, Chrome headless, Node 24):

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| início | mobile | 69 ⚠️ | 100 | 96 | 100 | 6.0s | 0.002 | 148ms |
| início | desktop | 97 | 100 | 96 | 100 | 1.2s | 0.001 | 0ms |
| detalhe | mobile | 70 ⚠️ | 100 | 96 | 100 | 5.9s | 0.001 | 119ms |
| detalhe | desktop | 97 | 100 | 96 | 100 | 1.2s | 0.001 | 0ms |

Accessibility, Best Practices e SEO batem a meta com folga em ambos os perfis. CLS é essencialmente zero em todo lugar (os skeletons preservam as dimensões do conteúdo real, como exigido). **Performance mobile fica abaixo da meta (≥90)** — desktop passa com folga (97–98).

### Causa identificada (não é o LCP em si, é o que vem antes dele)

O breakdown do LCP (`lcp-breakdown-insight`) mostra que, uma vez que a imagem do hero começa a carregar, ela é rápida: TTFB + delay + duração + render ficam somados em ~350ms nos três runs. O tempo "perdido" está **antes** disso: o First Contentful Paint mobile já está em ~3.3s — ou seja, **nada** é pintado na tela, nem o cabeçalho estático, até esse ponto. A causa é estrutural: `src/main.tsx` só chama `createRoot(...).render(...)` depois que `enableMocking()` resolve, e essa cadeia baixa e executa ~190KB (gzip) de runtime de mock antes de qualquer render — o worker do MSW (`browser-*.js`, ~42KB) mais um chunk (`realtime-simulation-*.js`, ~136KB) que arrasta consigo todos os handlers REST, `@mswjs/socket.io-binding`, `socket.io` e `decimal.js`, já que `setupWorker(...handlers)` precisa de todos os handlers registrados antes de poder iniciar. Sob o perfil mobile simulado (CPU 4x mais lenta, rede ~1.6Mbps), o tempo de boot desse JS (`bootup-time` 0.9s, `mainthread-work-breakdown` 1.7s) domina o tempo até a primeira pintura.

Esse custo é uma consequência direta de uma exigência do próprio enunciado (§6: "a camada de mocks deve ser ativada por configuração e estar disponível no build de demonstração") — não é uma simplificação para melhorar a nota, é o inverso: a auditoria roda exatamente com a simulação completa ligada, sem atalho. Um app com backend real não pagaria esse custo de bootstrap.

**Melhoria futura identificada, não aplicada nesta entrega** (risco de regressão perto do prazo, e exigiria reestruturar o gate de mounting): renderizar a árvore React imediatamente (cabeçalho, hero estático) e represar apenas as *buscas de dados* até o MSW estar pronto — hoje o gate é on/off para o app inteiro porque qualquer `fetch`/`XHR` disparado antes do `worker.start()` completar escaparia da interceptação do Service Worker.

Nota sobre o ambiente: as medições rodaram numa máquina de desktop compartilhada (não um runner de CI dedicado/isolado) — a primeira bateria (antes dos fixes de SEO/LCP) mediu LCP mobile ~4.1s; medições seguintes, com mais carga concorrente no sistema, mediram entre ~5.7s e ~6.0s. A direção da causa raiz (boot de JS bloqueando o primeiro paint) é a mesma em todas; o valor absoluto varia com ruído de máquina, o que é esperado no modo de throttling simulado do Lighthouse e é a própria razão pela qual o enunciado pede 3 medições e a mediana.

Reauditado após a rodada de fidelidade visual desta sessão (filtro "Rede" + slider de preço no catálogo, abas/seção de relacionados no detalhe, tab bar mobile): Performance mobile caiu levemente (72→69 início, 71→70 detalhe) — mais JS por página (Base UI `Slider`/`Tabs`, mais uma query de NFTs relacionados) empurra o `bootup-time`/`mainthread-work-breakdown` já dominante um pouco mais para cima; a causa raiz continua a mesma descrita acima, não uma regressão nova. Accessibility, Best Practices e SEO seguem 100/96/100. No caminho, a auditoria pegou uma regressão real: os dois `<input type="range">` do novo slider de preço não tinham nome acessível (`aria-label` só estava no wrapper, não nos inputs) — Accessibility caiu para 95 numa rodada intermediária; corrigido passando `getAriaLabel` por thumb no componente `Slider` (`src/components/ui/slider.tsx`), confirmado de volta a 100/100 na rodada final (a que está na tabela acima).

## Limitações conhecidas

- Sem persistência real entre dispositivos/abas incógnitas — tudo vive em `localStorage` do navegador (por design, já que não há backend).
- `POST /nfts/:id/_simulate-update`, `/auth/_expire` e `/orders/:id/_resolve` são hooks só de teste, sem autenticação de operador — aceitáveis aqui porque toda a API já é uma simulação local, mas não deveriam existir num backend real.
- Reserva de estoque a partir da criação do pedido não existe (dois pedidos pendentes simultâneos para a mesma edição poderiam, em teoria, ambos confirmar além do disponível) — irrelevante no cenário de demonstração (um único navegador/sessão por vez), documentado aqui como trade-off consciente em favor de "preservar itens em pedidos não confirmados".
- `ReactQueryDevtools` é renderizado incondicionalmente em `src/main.tsx` (não hospedado atrás de `import.meta.env.DEV`), então o botão flutuante aparece também no build de produção/preview — mantido de propósito, já que a entrega é uma demonstração e o painel ajuda a inspecionar cache/eventos ao vivo.
- Checagem manual de acessibilidade (além do que o Lighthouse audita automaticamente): contraste de texto verificado ponto a ponto para a paleta "Kurio" — todos os pares texto/fundo ficam ≥8:1 (WCAG AAA). Único ponto abaixo do ideal: a borda de `<input>` em repouso (`--input: #55321f` sobre `--background: #140d0a`) tem ~1.7:1 de contraste não-textual, abaixo dos 3:1 recomendados pelo WCAG 1.4.11 — o valor vem direto do Figma (não é um erro de implementação); o foco (`--ring`, 8.5:1) e o `<label>` sempre visível acima de cada campo compensam na prática, mas fica registrado como um ajuste de token possível numa próxima iteração de design. Zoom/reflow sem overflow horizontal já é coberto automaticamente por `e2e/responsive.spec.ts` em 390/768/1440px.

## Desvios do Figma

O layout segue o arquivo do Figma (`challenge.md` tem o link) telas a tela, com estas divergências deliberadas:

- Sem seções de blog/newsletter/banner promocional — fora de escopo por `challenge.md` §3.
- Rodapé simplificado em uma linha, em vez do rodapé de 4 colunas do Figma.
- Login/Cadastro são rotas reais (`/login`, `/register`) estilizadas para lembrar o modal do Figma, em vez de um overlay verdadeiro sobre a página anterior.
- Formulário de carteira só tem os campos realmente ligados ao backend simulado (nome, endereço, rede, papel) — sem "tipo de carteira", ENS ou código de indicação fictícios.
- Itens do menu lateral de conta fora de escopo (Atividade, Lista de interesse, Ofertas, Arquivos baixados, Suporte) e da navegação superior (Criadores, Aprenda) aparecem visualmente como no Figma, mas inertes (`aria-disabled`, sem link) — não devem aparentar uma funcionalidade que não existe.
- Avatares de criador/usuário são iniciais geradas localmente (SVG inline) em vez de um serviço de avatar remoto — evita dependência de rede externa (melhor para Lighthouse/offline).
- Avaliações de colecionadores (nota, contagem e a lista de comentários na aba "Avaliações") são conteúdo estático determinístico gerado nos fixtures — não é um recurso de review real (challenge.md não pede uma API de avaliações), sem formulário de envio.

"Mercado" no Figma não é uma tela separada de "Início": é o mesmo catálogo reaproveitado como pano de fundo do Login/Cadastro (componente "Marketplace Page"), e o link "Mercado" do header sempre apontou para a mesma rota `/` — confirmado por captura de tela do arquivo antes de qualquer alteração. O que estava genuinamente faltando e foi implementado nesta sessão: filtro "Rede" (Ethereum/Polygon/Solana) e slider duplo de preço na sidebar do catálogo; na página de detalhe, avaliação por estrelas, bloco "ID do token/Coleção/Atributos" com compartilhamento real (Web Share API com fallback de copiar link), abas "Detalhes do NFT"/"Avaliações" (rede, contrato, direitos autorais) e "Mais desta coleção"; e uma tab bar mobile fixa (Início/Favoritos/Mercado/Carrinho/Conta) já que o header não expõe nenhuma navegação abaixo do breakpoint `md`, incluindo uma rota `/favorites` nova (o recurso "Favoritos: Consulta" do challenge.md não tinha nenhuma tela própria até então).
