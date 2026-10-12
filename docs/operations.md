# Operação das funcionalidades

## Antes de atualizar o site

Faça backup do PostgreSQL de produção. A versão contém 18 migrações adicionais em relação à base atual; execute `npx prisma migrate deploy` com a conexão de produção antes de disponibilizar o novo servidor. Não execute `prisma migrate reset` nem os testes de integração em produção.

Configure `ADMIN_PUNISH_PASSWORD` para habilitar punições administrativas. As demais configurações novas estão em `.env.example`. Configure as banlists, calendários, prêmios e preços no painel; os scripts de seed são opcionais e alteram dados, portanto não devem rodar automaticamente no deploy.

O motor OCGCore mantém suas sessões na memória do processo. Use um processo persistente e encaminhe as requisições de cada duelo ao mesmo processo. Reiniciar o servidor perde sessões em andamento; esta atualização não fornece recuperação do motor ou distribuição entre servidores.

## Testes

`npm run build` verifica compilação e tipos. `npm run test:integration` exige `DATABASE_URL` apontando para um PostgreSQL local em `127.0.0.1` e um banco cujo nome termine em `_review`, já migrado. Use um banco descartável: os testes criam jogadores e desativam passes existentes nesse banco de teste.

Os testes cobrem concorrência de compras, limites de cópias, idempotência de moedas e depósitos, evolução de cópias, rollback de recompensas e partidas, validação de relógio, fila de ações por sala e validação de chaves de torneio. Foram validadas também migrações desde um banco vazio e atualização da versão anterior com preservação de saldo, coleção, deck e preços cadastrados.

Não houve validação visual de todas as telas nem partida completa com dois navegadores e o motor OCGCore. Esses fluxos devem passar por homologação antes da publicação.

## Escolhas da revisão

A interface e a API de venda de cartas foram excluídas: os dados disponíveis não relacionam cada cópia, sua raridade e sua origem de compra, podendo converter cartas recebidas gratuitamente em créditos. Os tipos e a tabela de venda ficam reservados, sem endpoint de venda disponível.

As migrações preservam os preços e descontos existentes, sem reduzir preços automaticamente. Operações financeiras compostas usam uma transação compartilhada e bloqueio no PostgreSQL para evitar pagamentos duplicados e recompensas parcialmente entregues. O bloqueio financeiro é global; em grande volume ele limita a concorrência e deve ser monitorado.
