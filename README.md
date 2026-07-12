# Edison Duel Simulator — MVP

Projeto de fã, não afiliado à Konami. Deck Builder + autenticação + economia (gold/cash) + loja
para o formato Edison de Yu-Gi-Oh.

## O que está implementado neste MVP

- ✅ Autenticação (Auth.js: registro + login por credenciais, senha com argon2id)
- ✅ Deck Builder (busca, Main/Extra/Side, validação de tamanho e banlist, import/export `.ydk`)
- ✅ Economia (carteira gold/cash, ledger transacional `CurrencyTransaction`)
- ✅ Loja (compra de cartas com gold e/ou cash, limite de 3 cópias por carta)
- ✅ Middleware protegendo rotas autenticadas

## O que NÃO está implementado (propositalmente fora do escopo deste MVP)

- ❌ Motor de duelo automático (ocgcore/EDOPro) — é um projeto à parte, que exige compilar o
  motor para WASM e integrar milhares de scripts Lua de efeitos. Os modelos `Match`,
  `MatchPlayer`, `GameAction` e `Replay` já estão no schema, prontos para quando essa fase
  começar, mas a implementação do motor em si não está aqui.
- ❌ Pagamento real de cash (Stripe/Mercado Pago) — o `Payment` model existe no schema, mas o
  fluxo de checkout/webhook não foi implementado. Ver seção 15 do documento de arquitetura para
  o desenho completo desse fluxo antes de implementar.
- ❌ Envio de e-mail de verificação real — hoje o registro marca `emailVerified` automaticamente
  para o MVP rodar sem depender de um provedor de e-mail. Trocar por um fluxo de token +
  Resend/SendGrid antes de ir para produção.
- ❌ 2FA (o campo já existe no schema, mas a UI/lógica de TOTP não foi implementada)

## Como rodar localmente

```bash
npm install

cp .env.example .env
# edite .env se quiser trocar alguma configuração; o padrão já funciona com SQLite local

npx prisma migrate dev --name init
npm run prisma:seed

npm run dev
```

Acesse http://localhost:3000

## Fluxo de teste sugerido

1. Crie uma conta em `/register`
2. Faça login em `/login`
3. Vá em `/shop` e compre algumas cartas com o gold inicial (você vai precisar dar gold manualmente
   pelo Prisma Studio na primeira vez — `npm run prisma:studio` — já que a concessão de gold real
   só acontece ao fim de uma partida, que ainda não existe neste MVP)
4. Vá em `/deck-builder`, monte um deck com as cartas que você possui, salve, exporte `.ydk`

## Próximos passos recomendados (ordem sugerida)

1. Endpoint `/api/dev/grant-gold` (protegido, só em dev) para facilitar testes sem precisar do
   Prisma Studio toda vez.
2. Endpoint `GET /api/banlist` e conectar de verdade na `DeckSummary` (hoje está com array vazio
   inline, como simplificação do MVP).
3. Fluxo real de verificação de e-mail antes de liberar compras.
4. Prova de conceito do ocgcore compilado para WASM, isolada, fora do Next (fase 5 do roadmap
   original).
