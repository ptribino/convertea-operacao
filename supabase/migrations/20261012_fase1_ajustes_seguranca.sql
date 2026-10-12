-- Ajustes apontados pela checagem de segurança do Supabase após a fase 1.
-- Funções de gatilho e auxiliares não precisam ser chamadas pela API; só os gatilhos e as políticas as usam.
revoke execute on function public.cliente_do_pre_diagnostico(), public.vincular_diagnostico() from public, anon, authenticated;
revoke execute on function public.is_equipe(), public.nome_equipe() from public, anon;
grant execute on function public.is_equipe(), public.nome_equipe() to authenticated;

alter function public.etapas_ordem() set search_path = public;
alter function public.etapa_padrao(text) set search_path = public;
alter function public.etapa_nome(text) set search_path = public;
alter function public.tocar_atualizado() set search_path = public;
alter function public.proteger_etapa() set search_path = public;
