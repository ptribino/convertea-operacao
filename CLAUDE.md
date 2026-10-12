# Convertea Operação

Sistema interno da Convertea (Pri e Mateus): funil de escritórios clientes, do pré-diagnóstico ao pós-venda.
O documento de produto (ciclo de 13 etapas, módulos, fases) é a referência; este repositório implementa as fases 1 e 2.

## Stack
- Vite + React 18 + TypeScript, React Router, TanStack Query. CSS próprio em `src/styles.css` (sem Tailwind).
- Supabase: o MESMO projeto "convertea" do site (repositório ptribino/convertea). O site grava em
  `pre_diagnosticos` e `diagnosticos`; este sistema lê essas tabelas e cria as suas.
- Deploy: Netlify (`netlify.toml`), variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Regras que não podem quebrar
- **Etapa só muda pelas funções do banco** `mover_etapa` e `confirmar_pagamento`. Um gatilho recusa update direto
  em `clientes.etapa`. Regras: perdido exige motivo; do diagnóstico em diante exige proposta paga.
- **Acesso só para a tabela `equipe`** (RLS com `is_equipe()`). Nunca usar a chave service_role no front.
- **O site continua insert-only** em `pre_diagnosticos` e `diagnosticos`: não dar select a `anon`.
- Pré-diagnóstico do site vira cliente sozinho (gatilho). Questionário liga ao cliente por WhatsApp (11 últimos
  dígitos) ou e-mail; o que não bate aparece em /questionarios para vincular à mão.
- Clientes fictícios têm `teste = true` (seed em `supabase/seed_teste.sql`) e podem ser escondidos no funil.
- OAB: nenhum texto do sistema diz que a Convertea capta ou fecha clientes; quem fecha é o escritório.
- LGPD: conversas de clientes de escritórios (fase 2) são dados pessoais. Acesso restrito, sem exportar para fora.
- Tema claro/escuro escolhido por pessoa (seletor na barra, `data-theme` no <html>, salvo no navegador). Cores sempre por variável em `src/styles.css`, nunca fixas, para valer nos dois temas.
- Textos da interface em português, falando com Pri e Mateus (não com o escritório). Sem travessões longos.

## Banco
- Migrações em `supabase/migrations`, idempotentes (podem rodar duas vezes). Aplicar depois das do site.
- Ordem das etapas: `etapas_ordem()` no banco e `FLUXO` em `src/lib/etapas.ts`. Mudou uma, mude a outra.

## Diagnóstico (fase 2, aba "Diagnóstico e relatório" da ficha)
- Importa a planilha do escritório no formato de `public/modelo_diagnostico.xlsx` (abas Leads e Conversas), lida no navegador.
  Nome e telefone dos leads NUNCA são lidos nem gravados.
- Cálculos em `src/lib/diagnostico.ts` (funil, Declarado × Real, impacto). Notas são da equipe; o gatilho `validar_nota`
  recusa nota sem evidência. Etapas avançam sozinhas: importação → Dados recebidos; 1ª nota → Em análise;
  gerar relatório → Relatório em revisão; entregar (checklist completo) → Relatório entregue.
- Relatório em `/relatorio/:id`, papel claro mesmo no tema escuro, salvo em PDF pelo navegador. Não cita produtos.

## Próximas fases (documento de produto)
3. Oportunidades (catálogo de produtos por gargalo, a partir das notas).
4. Implementação, acompanhamento mensal (antes × depois) e IA sugerindo triagem e notas.
A tabela de análises deve servir ao diagnóstico E às medições mensais (linha de base comparável).

## Comandos
- `npm run dev` | `npm run build` (inclui checagem de tipos)
