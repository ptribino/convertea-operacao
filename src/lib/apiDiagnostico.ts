import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { AreaKey, Lead, LinhaDxr, Mensagem } from "./diagnostico";

export type Analise = {
  id: string;
  cliente_id: string;
  criado_em: string;
  tipo: "diagnostico" | "acompanhamento";
  status: "dados" | "notas" | "relatorio" | "revisado" | "entregue";
  arquivo: string | null;
  periodo: string | null;
  dxr: LinhaDxr[];
  ticket_medio: number | null;
  impacto_comprovado: number | null;
  impacto_estimado: number | null;
  impacto_nota: string | null;
  gargalo: string | null;
  resumo: string | null;
  prioridades: { titulo: string; texto: string }[];
  revisao: number[];
  revisado_por: string | null;
  entregue_em: string | null;
};
export type Nota = { analise_id: string; area: AreaKey; nota: number | null; nao_se_aplica: boolean; comentario: string | null; atualizado_por: string | null };
export type Evidencia = { id: string; analise_id: string; area: AreaKey; id_conversa: string | null; trecho: { autor: string; mensagem: string }[]; comentario: string | null; criado_por: string | null };

const ok = <T,>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return r.data as T; };

/** Lê todas as linhas, de 1000 em 1000 (limite padrão da API do Supabase). */
async function todas<T>(tabela: string, analise: string, ordem: string[]): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q = supabase.from(tabela).select("*").eq("analise_id", analise);
    ordem.forEach((o) => { q = q.order(o, { ascending: true }); });
    const parte = ok<T[]>(await q.range(de, de + 999));
    saida.push(...parte);
    if (parte.length < 1000) return saida;
  }
}

export const useAnalises = (cliente: string) =>
  useQuery({
    queryKey: ["analises", cliente],
    queryFn: async () => ok<Analise[]>(await supabase.from("analises").select("*").eq("cliente_id", cliente).order("criado_em", { ascending: false })),
  });

export const useAnalise = (id: string) =>
  useQuery({ queryKey: ["analise", id], queryFn: async () => ok<Analise>(await supabase.from("analises").select("*").eq("id", id).single()) });

export const useLeads = (analise?: string) =>
  useQuery({ queryKey: ["leads", analise], enabled: !!analise, staleTime: 5 * 60_000, queryFn: () => todas<Lead>("leads_escritorio", analise!, ["id"]) });

export const useConversas = (analise?: string) =>
  useQuery({ queryKey: ["conversas", analise], enabled: !!analise, staleTime: 5 * 60_000, queryFn: () => todas<Mensagem>("conversas_escritorio", analise!, ["id_conversa", "seq"]) });

export const useNotas = (analise?: string) =>
  useQuery({ queryKey: ["notas", analise], enabled: !!analise, queryFn: async () => ok<Nota[]>(await supabase.from("analise_notas").select("*").eq("analise_id", analise!)) });

export const useEvidencias = (analise?: string) =>
  useQuery({ queryKey: ["evidencias", analise], enabled: !!analise, queryFn: async () => ok<Evidencia[]>(await supabase.from("evidencias").select("*").eq("analise_id", analise!).order("criado_em")) });

const inv = (qc: ReturnType<typeof useQueryClient>) => () => qc.invalidateQueries();

export function useImportar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { cliente: string; arquivo: string; periodo: string; leads: Lead[]; conversas: Mensagem[]; dxr: LinhaDxr[]; ticket: number; comprovado: number; estimado: number; progresso: (p: string) => void }) => {
      const a = ok<Analise>(await supabase.from("analises").insert({
        cliente_id: v.cliente, arquivo: v.arquivo, periodo: v.periodo, dxr: v.dxr,
        ticket_medio: Math.round(v.ticket), impacto_comprovado: v.comprovado, impacto_estimado: Math.round(v.estimado),
      }).select().single());
      try {
        for (let i = 0; i < v.leads.length; i += 500) {
          v.progresso(`Gravando leads ${Math.min(i + 500, v.leads.length)} de ${v.leads.length}`);
          ok(await supabase.from("leads_escritorio").insert(v.leads.slice(i, i + 500).map((l) => ({ ...l, analise_id: a.id }))));
        }
        for (let i = 0; i < v.conversas.length; i += 500) {
          v.progresso(`Gravando mensagens ${Math.min(i + 500, v.conversas.length)} de ${v.conversas.length}`);
          ok(await supabase.from("conversas_escritorio").insert(v.conversas.slice(i, i + 500).map((m) => ({ ...m, analise_id: a.id }))));
        }
      } catch (e) {
        await supabase.from("analises").delete().eq("id", a.id); // não deixa análise pela metade
        throw e;
      }
      return a;
    },
    onSuccess: inv(qc),
  });
}

export function useAtualizarAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; campos: Partial<Analise> }) => ok(await supabase.from("analises").update(v.campos).eq("id", v.id)),
    onSuccess: inv(qc),
  });
}

export function useExcluirAnalise() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => ok(await supabase.from("analises").delete().eq("id", id)), onSuccess: inv(qc) });
}

export function useSalvarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: Omit<Nota, "atualizado_por"> & { autor: string }) =>
      ok(await supabase.from("analise_notas").upsert({ analise_id: n.analise_id, area: n.area, nota: n.nota, nao_se_aplica: n.nao_se_aplica, comentario: n.comentario, atualizado_por: n.autor, atualizado_em: new Date().toISOString() })),
    onSuccess: inv(qc),
  });
}

export function useNovaEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Omit<Evidencia, "id">) => ok(await supabase.from("evidencias").insert(e)),
    onSuccess: inv(qc),
  });
}

export function useExcluirEvidencia() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => ok(await supabase.from("evidencias").delete().eq("id", id)), onSuccess: inv(qc) });
}
