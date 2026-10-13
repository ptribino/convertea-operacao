# Convertea Operação

Sistema interno da Convertea para acompanhar cada escritório cliente: funil de venda, pagamento,
questionário do diagnóstico e, nas próximas fases, análise, relatório e pós-venda.

## O que a fase 1 faz
- **Funil** com as 13 etapas (venda, diagnóstico, pós-venda), filtros por responsável e clientes de teste,
  e destaque para quem tem ação vencida.
- **Ficha do cliente**: próxima ação, dados do escritório, proposta e pagamento, histórico de conversas,
  pré-diagnóstico e questionário respondidos no site.
- **Regras no banco**: venda perdida só com motivo; questionário e diagnóstico só depois do pagamento;
  toda mudança de etapa vai para o histórico com o nome de quem fez.
- **Integração com o site**: pré-diagnóstico vira cliente sozinho; questionário liga ao cliente pelo
  WhatsApp ou e-mail (os que não batem ficam em Questionários para vincular).
- **Painel** com clientes pagantes, receita de diagnósticos, funil de venda e motivos de perda.

## Como colocar no ar
1. **Banco.** No Supabase do projeto convertea, rode `supabase/migrations/20261012_fase1_funil.sql`
   no SQL Editor. Para ter os escritórios fictícios, rode também `supabase/seed_teste.sql`
   (apague depois com `delete from public.clientes where teste;`).
2. **Login.** Em Authentication > URL Configuration, coloque o endereço do sistema no Netlify em
   Site URL e em Redirect URLs. No primeiro acesso a pessoa entra pelo link no e-mail e cria uma senha (aviso no funil ou clicando no próprio nome); depois entra com e-mail e senha. Só os e-mails da tabela `equipe` entram. Endereço: https://operacao.convertea.com.br
3. **Netlify.** Novo site a partir deste repositório. Em Environment variables, crie
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings > API, chave pública).
4. Para rodar no computador: copie `.env.example` para `.env.local`, preencha e rode `npm install` e `npm run dev`.

## Incluir alguém na equipe
```sql
insert into public.equipe (email, nome) values ('email@exemplo.com', 'Nome');
```
