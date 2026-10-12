-- Escritórios FICTÍCIOS para testar o funil (todos com teste = true).
-- Rodar no SQL Editor do Supabase depois da migração. Para apagar: delete from public.clientes where teste;
-- As etapas são gravadas direto (sem mover_etapa) só aqui, para montar o cenário de teste.

begin;
select set_config('convertea.mudanca_etapa', 'ok', true);

with novos(escritorio, contato, zap, cidade, area, etapa, resp, prox, dias, temp, motivo) as (values
  ('Ramos & Teixeira Advogados','Dra. Paula Ramos','(48) 90000-1101','Florianópolis','Trabalhista','pre','Mateus','Primeiro contato pelo WhatsApp',0,'Quente',null),
  ('Coelho Previdenciário','Dr. André Coelho','(48) 90000-1102','Palhoça','Previdenciário','conversa','Mateus','Conversa por vídeo com a sócia',2,'Morno',null),
  ('Duarte Advocacia Bancária','Dra. Lúcia Duarte','(48) 90000-1103','Florianópolis','Bancário','proposta','Mateus','Retomar a proposta (2º contato)',-2,'Quente',null),
  ('Martins & Lima Advogados','Dr. Rui Martins','(48) 90000-1104','Biguaçu','Consumidor','perdido','Mateus','Nova tentativa',64,'Frio','Momento: escritório em mudança de sede'),
  ('Bittencourt Advocacia','Dra. Ana Bittencourt','(48) 90000-1105','Florianópolis','Previdenciário','pago','Mateus','Cobrar resposta do questionário',1,'Quente',null),
  ('Farias Trabalhista','Dr. Hugo Farias','(48) 90000-1106','São José','Trabalhista','analise','Pri','Fechar as notas das 8 áreas',2,null,null),
  ('Escritório Exemplo Advocacia','Dra. Helena Souza','(48) 90000-1107','São José','Previd., Trab. e Bancário','revisao','Mateus','Revisar o relatório',1,null,null),
  ('Souza Cardoso Advogados','Dr. Caio Cardoso','(48) 90000-1108','Florianópolis','Previd. e Trabalhista','acompanhamento','Pri','Medição de outubro',19,null,null)
), ins as (
  insert into public.clientes (escritorio, contato_nome, whatsapp, cidade, area, etapa, responsavel,
    proxima_acao, proxima_data, temperatura, motivo_perda, teste)
  select escritorio, contato, zap, cidade, area, etapa, resp, prox, current_date + dias, temp, motivo, true from novos
  returning id, escritorio, etapa
), props as (
  insert into public.propostas (cliente_id, valor, enviada_em, status, pago_em)
  select id, 3900, current_date - 10,
    case when etapa in ('proposta','perdido') then case when etapa='perdido' then 'recusada' else 'enviada' end else 'aceita' end,
    case when etapa in ('proposta','perdido') then null else current_date - 6 end
  from ins where etapa not in ('pre','conversa')
  returning cliente_id
)
insert into public.interacoes (cliente_id, autor, tipo, texto)
select id, 'Sistema', 'sistema', 'Cliente fictício criado para teste do sistema' from ins;

commit;
