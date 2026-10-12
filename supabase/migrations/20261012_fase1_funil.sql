-- Convertea Operação | Fase 1: funil de clientes, propostas e questionários
-- Aplicar no projeto Supabase "convertea" (o mesmo do site), depois das migrações do site.
-- Tudo aqui é lido e escrito apenas por quem está na tabela equipe (Pri e Mateus).

-- ---------------------------------------------------------------- equipe
create table if not exists public.equipe (
  email text primary key check (email = lower(email)),
  nome text not null
);

create or replace function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.equipe
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.nome_equipe() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nome from public.equipe where email = lower(coalesce(auth.jwt() ->> 'email', ''))),
    'Sistema'
  );
$$;

-- ---------------------------------------------------------------- etapas
-- Ordem do ciclo. "perdido" fica fora da sequência.
create or replace function public.etapas_ordem() returns text[]
language sql immutable as $$
  select array['pre','conversa','proposta','pago','questionario','dados','analise',
               'revisao','entregue','implementacao','acompanhamento','renovacao'];
$$;

create or replace function public.etapa_padrao(p_etapa text, out acao text, out dias int)
language sql immutable as $$
  select a, d from (values
    ('pre','Primeiro contato pelo WhatsApp',1),
    ('conversa','Fazer a conversa',3),
    ('proposta','Retomar a proposta (2 dias)',2),
    ('pago','Enviar o link do questionário',1),
    ('perdido','Nova tentativa, se o motivo for o momento',90),
    ('questionario','Pedir planilha de leads e conversas',2),
    ('dados','Começar a análise',3),
    ('analise','Fechar as 8 notas com evidência',7),
    ('revisao','Revisão por quem não fez a análise',2),
    ('entregue','Oferecer a implementação',5),
    ('implementacao','Executar as tarefas dos 7 pilares',14),
    ('acompanhamento','Medir e comparar com a linha de base',30),
    ('renovacao','Renovar, pedir depoimento ou indicação',7)
  ) as t(e, a, d) where e = p_etapa;
$$;

create or replace function public.etapa_nome(p_etapa text) returns text
language sql immutable as $$
  select n from (values
    ('pre','Pré-diagnóstico'),('conversa','Conversa agendada'),('proposta','Proposta enviada'),('pago','Pago'),
    ('perdido','Perdido'),('questionario','Questionário respondido'),('dados','Dados recebidos'),('analise','Em análise'),
    ('revisao','Relatório em revisão'),('entregue','Relatório entregue'),('implementacao','Implementação'),
    ('acompanhamento','Acompanhamento mensal'),('renovacao','Renovação ou case')
  ) as t(e, n) where e = p_etapa;
$$;

-- ---------------------------------------------------------------- clientes
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  escritorio text not null check (char_length(escritorio) between 1 and 160),
  contato_nome text,
  whatsapp text,
  email text,
  cidade text,
  area text,
  etapa text not null default 'pre'
    check (etapa = 'perdido' or etapa = any (public.etapas_ordem())),
  responsavel text not null default 'Mateus' check (responsavel in ('Pri','Mateus')),
  proxima_acao text,
  proxima_data date,
  temperatura text,
  motivo_perda text,
  saida text check (saida is null or saida in ('relatorio','treinamento','implementacao')),
  pre_diagnostico_id uuid,
  diagnostico_id uuid,
  teste boolean not null default false,
  check (etapa <> 'perdido' or motivo_perda is not null)
);
create index if not exists clientes_etapa_idx on public.clientes (etapa);
create index if not exists clientes_whatsapp_idx on public.clientes ((right(regexp_replace(coalesce(whatsapp,''), '\D', '', 'g'), 11)));

create table if not exists public.interacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  autor text not null default 'Sistema',
  tipo text not null default 'nota' check (tipo in ('nota','etapa','proposta','sistema')),
  texto text not null check (char_length(texto) between 1 and 2000)
);
create index if not exists interacoes_cliente_idx on public.interacoes (cliente_id, criado_em);

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  valor numeric(10,2) not null check (valor >= 0),
  enviada_em date not null default current_date,
  status text not null default 'enviada' check (status in ('enviada','aceita','recusada')),
  pago_em date
);
create index if not exists propostas_cliente_idx on public.propostas (cliente_id);

create or replace function public.tocar_atualizado() returns trigger
language plpgsql as $$ begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists clientes_atualizado on public.clientes;
create trigger clientes_atualizado before update on public.clientes
  for each row execute function public.tocar_atualizado();

-- ---------------------------------------------------------------- regras do funil
-- Toda mudança de etapa passa por aqui: valida, define a próxima ação e registra no histórico.
create or replace function public.mover_etapa(p_cliente uuid, p_etapa text, p_motivo text default null)
returns public.clientes
language plpgsql security definer set search_path = public as $$
declare
  c public.clientes;
  pad record;
  pago boolean;
begin
  if not public.is_equipe() then raise exception 'Acesso restrito à equipe'; end if;
  select * into c from public.clientes where id = p_cliente for update;
  if not found then raise exception 'Cliente não encontrado'; end if;
  if p_etapa <> 'perdido' and not (p_etapa = any (public.etapas_ordem())) then
    raise exception 'Etapa inválida: %', p_etapa;
  end if;
  if p_etapa = 'perdido' and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da perda';
  end if;
  if array_position(public.etapas_ordem(), p_etapa) >= array_position(public.etapas_ordem(), 'pago') then
    select exists (select 1 from public.propostas where cliente_id = p_cliente and pago_em is not null) into pago;
    if not pago then raise exception 'Confirme o pagamento da proposta antes de seguir para o diagnóstico'; end if;
  end if;

  select * into pad from public.etapa_padrao(p_etapa);
  perform set_config('convertea.mudanca_etapa', 'ok', true);
  update public.clientes set
    etapa = p_etapa,
    motivo_perda = case when p_etapa = 'perdido' then trim(p_motivo) else null end,
    proxima_acao = pad.acao,
    proxima_data = current_date + pad.dias
  where id = p_cliente returning * into c;

  insert into public.interacoes (cliente_id, autor, tipo, texto)
  values (p_cliente, public.nome_equipe(), 'etapa',
    case when p_etapa = 'perdido' then 'Marcado como perdido: ' || trim(p_motivo)
         else 'Movido para ' || public.etapa_nome(p_etapa) end);
  return c;
end $$;

-- Ninguém muda a etapa direto na tabela: só pelas funções acima, que aplicam as regras.
create or replace function public.proteger_etapa() returns trigger
language plpgsql as $$
begin
  if new.etapa is distinct from old.etapa and coalesce(current_setting('convertea.mudanca_etapa', true), '') <> 'ok' then
    raise exception 'Use mover_etapa para mudar a etapa do cliente';
  end if;
  return new;
end $$;
drop trigger if exists clientes_protege_etapa on public.clientes;
create trigger clientes_protege_etapa before update on public.clientes
  for each row execute function public.proteger_etapa();

-- Confirma o pagamento e libera o questionário
create or replace function public.confirmar_pagamento(p_proposta uuid, p_data date default current_date)
returns public.clientes
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.is_equipe() then raise exception 'Acesso restrito à equipe'; end if;
  update public.propostas set status = 'aceita', pago_em = p_data
    where id = p_proposta returning cliente_id into cid;
  if cid is null then raise exception 'Proposta não encontrada'; end if;
  insert into public.interacoes (cliente_id, autor, tipo, texto)
    values (cid, public.nome_equipe(), 'proposta', 'Pagamento confirmado em ' || to_char(p_data, 'DD/MM'));
  return public.mover_etapa(cid, 'pago');
end $$;

-- ---------------------------------------------------------------- integração com o site
-- Pré-diagnóstico respondido no site vira cliente na etapa "pre".
create or replace function public.cliente_do_pre_diagnostico() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(new); novo uuid;
begin
  insert into public.clientes (escritorio, contato_nome, whatsapp, email, area, etapa,
    proxima_acao, proxima_data, temperatura, pre_diagnostico_id)
  values (coalesce(nullif(r->>'escritorio',''), r->>'nome', 'Sem nome'), r->>'nome', r->>'whatsapp',
    nullif(r->>'email',''), r->>'area', 'pre', 'Primeiro contato pelo WhatsApp', current_date + 1,
    initcap(coalesce(r->>'temperatura', r->>'temperatura_lead')), (r->>'id')::uuid)
  returning id into novo;
  insert into public.interacoes (cliente_id, tipo, texto) values (novo, 'sistema', 'Respondeu o pré-diagnóstico no site');
  return new;
end $$;

-- Questionário completo: liga ao cliente pelo WhatsApp ou e-mail; se já pagou, avança a etapa.
create or replace function public.vincular_diagnostico() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.clientes; zap text := right(regexp_replace(coalesce(new.whatsapp,''), '\D', '', 'g'), 11);
begin
  select * into c from public.clientes
   where diagnostico_id is null and etapa <> 'perdido'
     and ((zap <> '' and right(regexp_replace(coalesce(whatsapp,''), '\D', '', 'g'), 11) = zap)
          or lower(email) = lower(new.email))
   order by atualizado_em desc limit 1;
  if found then
    perform set_config('convertea.mudanca_etapa', 'ok', true);
    update public.clientes set diagnostico_id = new.id,
      etapa = case when etapa = 'pago' then 'questionario' else etapa end,
      proxima_acao = case when etapa = 'pago' then 'Pedir planilha de leads e conversas' else proxima_acao end,
      proxima_data = case when etapa = 'pago' then current_date + 2 else proxima_data end
    where id = c.id;
    insert into public.interacoes (cliente_id, tipo, texto) values (c.id, 'sistema', 'Questionário do diagnóstico respondido');
  end if;
  return new;
end $$;

do $$ begin
  if to_regclass('public.pre_diagnosticos') is not null then
    drop trigger if exists pre_diagnostico_vira_cliente on public.pre_diagnosticos;
    create trigger pre_diagnostico_vira_cliente after insert on public.pre_diagnosticos
      for each row execute function public.cliente_do_pre_diagnostico();
    grant select, update on public.pre_diagnosticos to authenticated;
    drop policy if exists "equipe le pre_diagnosticos" on public.pre_diagnosticos;
    create policy "equipe le pre_diagnosticos" on public.pre_diagnosticos for select to authenticated using (public.is_equipe());
  end if;
  if to_regclass('public.diagnosticos') is not null then
    drop trigger if exists diagnostico_vincula_cliente on public.diagnosticos;
    create trigger diagnostico_vincula_cliente after insert on public.diagnosticos
      for each row execute function public.vincular_diagnostico();
    grant select, update on public.diagnosticos to authenticated;
    drop policy if exists "equipe le diagnosticos" on public.diagnosticos;
    create policy "equipe le diagnosticos" on public.diagnosticos for select to authenticated using (public.is_equipe());
    drop policy if exists "equipe atualiza diagnosticos" on public.diagnosticos;
    create policy "equipe atualiza diagnosticos" on public.diagnosticos for update to authenticated using (public.is_equipe()) with check (public.is_equipe());
  end if;
end $$;

-- ---------------------------------------------------------------- acesso (RLS)
alter table public.equipe enable row level security;
alter table public.clientes enable row level security;
alter table public.interacoes enable row level security;
alter table public.propostas enable row level security;

revoke all on public.equipe, public.clientes, public.interacoes, public.propostas from anon;
grant select on public.equipe to authenticated;
grant select, insert, update, delete on public.clientes, public.interacoes, public.propostas to authenticated;

drop policy if exists "equipe le equipe" on public.equipe;
create policy "equipe le equipe" on public.equipe for select to authenticated using (public.is_equipe());

drop policy if exists "equipe gerencia clientes" on public.clientes;
create policy "equipe gerencia clientes" on public.clientes for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());
drop policy if exists "equipe gerencia interacoes" on public.interacoes;
create policy "equipe gerencia interacoes" on public.interacoes for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());
drop policy if exists "equipe gerencia propostas" on public.propostas;
create policy "equipe gerencia propostas" on public.propostas for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());

revoke all on function public.mover_etapa(uuid, text, text), public.confirmar_pagamento(uuid, date) from public, anon;
grant execute on function public.mover_etapa(uuid, text, text), public.confirmar_pagamento(uuid, date) to authenticated;

-- Pessoas com acesso. O login é por link mágico no e-mail; só estes e-mails entram.
insert into public.equipe (email, nome) values
  ('ptribino@gmail.com', 'Pri'),
  ('mmnezes2003@gmail.com', 'Mateus')
on conflict (email) do nothing;
