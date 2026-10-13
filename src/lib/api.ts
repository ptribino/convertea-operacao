import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Cliente, Diagnostico, Interacao, PreDiagnostico, Proposta } from "./types";

const ok = <T,>(r: { data: T | null; error: unknown }): T => {
  if (r.error) throw r.error;
  return r.data as T;
};

export const useClientes = () =>
  useQuery({
    queryKey: ["clientes"],
    queryFn: async () => ok<Cliente[]>(await supabase.from("clientes").select("*").order("proxima_data", { ascending: true, nullsFirst: false })),
  });

export const useCliente = (id: string) =>
  useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => ok<Cliente>(await supabase.from("clientes").select("*").eq("id", id).single()),
  });

export const useInteracoes = (id: string) =>
  useQuery({
    queryKey: ["interacoes", id],
    queryFn: async () => ok<Interacao[]>(await supabase.from("interacoes").select("*").eq("cliente_id", id).order("criado_em", { ascending: false })),
  });

export const usePropostas = (id?: string) =>
  useQuery({
    queryKey: ["propostas", id ?? "todas"],
    queryFn: async () => {
      let q = supabase.from("propostas").select("*").order("criado_em", { ascending: false });
      if (id) q = q.eq("cliente_id", id);
      return ok<Proposta[]>(await q);
    },
  });

export const useDiagnostico = (id: string | null) =>
  useQuery({
    queryKey: ["diagnostico", id],
    enabled: !!id,
    queryFn: async () => ok<Diagnostico>(await supabase.from("diagnosticos").select("*").eq("id", id!).single()),
  });

export const usePreDiagnostico = (id: string | null) =>
  useQuery({
    queryKey: ["pre", id],
    enabled: !!id,
    queryFn: async () => ok<PreDiagnostico>(await supabase.from("pre_diagnosticos").select("*").eq("id", id!).single()),
  });

/** Questionários que chegaram do site e não foram ligados a nenhum cliente. */
export const useQuestionariosSemCliente = () =>
  useQuery({
    queryKey: ["questionarios-soltos"],
    queryFn: async () => {
      const diags = ok<Diagnostico[]>(await supabase.from("diagnosticos").select("*").order("criado_em", { ascending: false }));
      const ligados = ok<{ diagnostico_id: string | null }[]>(await supabase.from("clientes").select("diagnostico_id").not("diagnostico_id", "is", null));
      const usados = new Set(ligados.map((l) => l.diagnostico_id));
      return diags.filter((d) => !usados.has(d.id));
    },
  });

function useInvalidar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useMoverEtapa() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (v: { cliente: string; etapa: string; motivo?: string }) =>
      ok(await supabase.rpc("mover_etapa", { p_cliente: v.cliente, p_etapa: v.etapa, p_motivo: v.motivo ?? null })),
    onSuccess: inv,
  });
}

export function useConfirmarPagamento() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (v: { proposta: string; data: string }) => ok(await supabase.rpc("confirmar_pagamento", { p_proposta: v.proposta, p_data: v.data })),
    onSuccess: inv,
  });
}

export function useAtualizarCliente() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (v: { id: string; campos: Partial<Cliente> }) => ok(await supabase.from("clientes").update(v.campos).eq("id", v.id).select().single()),
    onSuccess: inv,
  });
}

export function useNovoCliente() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (c: Partial<Cliente>) => {
      const novo = ok<Cliente>(await supabase.from("clientes").insert({ ...c, etapa: "pre" }).select().single());
      await supabase.from("interacoes").insert({ cliente_id: novo.id, autor: c.responsavel ?? "Sistema", tipo: "sistema", texto: "Cliente cadastrado manualmente" });
      return novo;
    },
    onSuccess: inv,
  });
}

export function useNovaNota() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (v: { cliente: string; autor: string; texto: string }) =>
      ok(await supabase.from("interacoes").insert({ cliente_id: v.cliente, autor: v.autor, tipo: "nota", texto: v.texto })),
    onSuccess: inv,
  });
}

export function useNovaProposta() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (v: { cliente: string; autor: string; valor: number; enviada_em: string }) => {
      ok(await supabase.from("propostas").insert({ cliente_id: v.cliente, valor: v.valor, enviada_em: v.enviada_em }));
      await supabase.from("interacoes").insert({
        cliente_id: v.cliente, autor: v.autor, tipo: "proposta",
        texto: `Proposta registrada: ${v.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      });
    },
    onSuccess: inv,
  });
}

export function useVincularQuestionario() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: async (v: { cliente: Cliente; diagnostico: string; autor: string }) => {
      ok(await supabase.from("clientes").update({ diagnostico_id: v.diagnostico }).eq("id", v.cliente.id));
      await supabase.from("interacoes").insert({ cliente_id: v.cliente.id, autor: v.autor, tipo: "sistema", texto: "Questionário do diagnóstico vinculado manualmente" });
      if (v.cliente.etapa === "pago") ok(await supabase.rpc("mover_etapa", { p_cliente: v.cliente.id, p_etapa: "questionario" }));
    },
    onSuccess: inv,
  });
}

export const useEu = () =>
  useQuery({
    queryKey: ["eu"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase() ?? "";
      const r = await supabase.from("equipe").select("nome").eq("email", email).maybeSingle();
      return { email, nome: (r.data?.nome as string | undefined) ?? null, temSenha: !!data.user?.user_metadata?.tem_senha };
    },
  });
