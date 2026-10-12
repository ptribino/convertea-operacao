-- Convertea Operação | Fase 2: operação do diagnóstico, da planilha ao relatório
-- Uma "análise" é um ciclo de medição de um cliente. A primeira (tipo diagnostico) é a linha de base;
-- as medições mensais do pós-venda usam a mesma estrutura (tipo acompanhamento).
-- LGPD: leads são guardados SEM nome e SEM telefone. Conversas guardam só o texto, para evidência.

create table if not exists public.analises (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  tipo text not null default 'diagnostico' check (tipo in ('diagnostico','acompanhamento')),
  status text not null default 'dados' check (status in ('dados','notas','relatorio','revisado','entregue')),
  arquivo text,
  periodo text,
  dxr jsonb not null default '[]'::jsonb,            -- Declarado × Real: [{tema, declarado, real, selo, comentario}]
  ticket_medio numeric(12,2),
  impacto_comprovado numeric(14,2),
  impacto_estimado numeric(14,2),
  impacto_nota text,
  gargalo text,
  resumo text,
  prioridades jsonb not null default '[]'::jsonb,    -- [{titulo, texto}] (3)
  revisao jsonb not null default '[]'::jsonb,        -- itens do checklist marcados
  revisado_por text,
  entregue_em date
);
create index if not exists analises_cliente_idx on public.analises (cliente_id, criado_em);

create table if not exists public.leads_escritorio (
  id bigserial primary key,
  analise_id uuid not null references public.analises(id) on delete cascade,
  lead_id text,
  data_entrada timestamptz,
  origem text,
  area text,
  subtema text,
  cidade text,
  tempo_1a_resposta_min numeric,
  respondeu boolean, qualificado boolean, avancou_consulta boolean,
  docs_enviados boolean, proposta_enviada boolean, fechado boolean,
  etapa_atual text,
  motivo text,
  responsavel text,
  honorario numeric(12,2),
  id_conversa text
);
create index if not exists leads_escritorio_analise_idx on public.leads_escritorio (analise_id);

create table if not exists public.conversas_escritorio (
  id bigserial primary key,
  analise_id uuid not null references public.analises(id) on delete cascade,
  id_conversa text not null,
  lead_id text,
  seq int,
  data_hora timestamptz,
  autor text,
  mensagem text
);
create index if not exists conversas_escritorio_idx on public.conversas_escritorio (analise_id, id_conversa, seq);

create table if not exists public.analise_notas (
  analise_id uuid not null references public.analises(id) on delete cascade,
  area text not null check (area in ('velocidade','qualificacao','diagnostico','conducao','acompanhamento','documentacao','fechamento','recuperacao')),
  nota int check (nota between 0 and 100),
  nao_se_aplica boolean not null default false,
  comentario text,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  primary key (analise_id, area)
);

create table if not exists public.evidencias (
  id uuid primary key default gen_random_uuid(),
  analise_id uuid not null references public.analises(id) on delete cascade,
  area text not null,
  id_conversa text,
  trecho jsonb not null default '[]'::jsonb,         -- [{autor, mensagem}] copiados da conversa
  comentario text,
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists evidencias_analise_idx on public.evidencias (analise_id, area);

drop trigger if exists analises_atualizado on public.analises;
create trigger analises_atualizado before update on public.analises
  for each row execute function public.tocar_atualizado();

-- Regra do método: uma área só pode ter nota se tiver ao menos uma evidência (ou for "não se aplica").
create or replace function public.validar_nota() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.nota is not null and not new.nao_se_aplica and not exists (
    select 1 from public.evidencias where analise_id = new.analise_id and area = new.area
  ) then
    raise exception 'Ligue ao menos uma evidência (trecho de conversa) antes de dar a nota';
  end if;
  return new;
end $$;
drop trigger if exists analise_notas_valida on public.analise_notas;
create trigger analise_notas_valida before insert or update on public.analise_notas
  for each row execute function public.validar_nota();

-- Acesso: só a equipe
alter table public.analises enable row level security;
alter table public.leads_escritorio enable row level security;
alter table public.conversas_escritorio enable row level security;
alter table public.analise_notas enable row level security;
alter table public.evidencias enable row level security;

revoke all on public.analises, public.leads_escritorio, public.conversas_escritorio, public.analise_notas, public.evidencias from anon;
grant select, insert, update, delete on public.analises, public.leads_escritorio, public.conversas_escritorio, public.analise_notas, public.evidencias to authenticated;
grant usage, select on sequence public.leads_escritorio_id_seq, public.conversas_escritorio_id_seq to authenticated;

do $$
declare t text;
begin
  foreach t in array array['analises','leads_escritorio','conversas_escritorio','analise_notas','evidencias'] loop
    execute format('drop policy if exists "equipe gerencia %1$s" on public.%1$I', t);
    execute format('create policy "equipe gerencia %1$s" on public.%1$I for all to authenticated using (public.is_equipe()) with check (public.is_equipe())', t);
  end loop;
end $$;
