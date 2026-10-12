// Ciclo de vida do cliente. A ordem e as regras valem também no banco (supabase/migrations).
export type Fase = "venda" | "diag" | "pos";
export type EtapaKey =
  | "pre" | "conversa" | "proposta" | "pago" | "perdido"
  | "questionario" | "dados" | "analise" | "revisao" | "entregue"
  | "implementacao" | "acompanhamento" | "renovacao";

export type Etapa = { k: EtapaKey; nome: string; fase: Fase };

export const ETAPAS: Etapa[] = [
  { k: "pre", nome: "Pré-diagnóstico", fase: "venda" },
  { k: "conversa", nome: "Conversa agendada", fase: "venda" },
  { k: "proposta", nome: "Proposta enviada", fase: "venda" },
  { k: "pago", nome: "Pago", fase: "venda" },
  { k: "perdido", nome: "Perdido", fase: "venda" },
  { k: "questionario", nome: "Questionário respondido", fase: "diag" },
  { k: "dados", nome: "Dados recebidos", fase: "diag" },
  { k: "analise", nome: "Em análise", fase: "diag" },
  { k: "revisao", nome: "Relatório em revisão", fase: "diag" },
  { k: "entregue", nome: "Relatório entregue", fase: "diag" },
  { k: "implementacao", nome: "Implementação", fase: "pos" },
  { k: "acompanhamento", nome: "Acompanhamento mensal", fase: "pos" },
  { k: "renovacao", nome: "Renovação ou case", fase: "pos" },
];

export const FASES: { k: Fase; nome: string; desc: string }[] = [
  { k: "venda", nome: "Venda", desc: "até o pagamento" },
  { k: "diag", nome: "Diagnóstico", desc: "questionário ao relatório" },
  { k: "pos", nome: "Pós-venda", desc: "implementação e acompanhamento" },
];

export const FLUXO: EtapaKey[] = ETAPAS.filter((e) => e.k !== "perdido").map((e) => e.k);

export const MOTIVOS_PERDA = ["Preço", "Momento", "Sem retorno", "Escolheu outra solução", "Fora do perfil"];

export const etapa = (k: string) => ETAPAS.find((e) => e.k === k) ?? ETAPAS[0];

export function proximaEtapa(k: EtapaKey): EtapaKey | null {
  const i = FLUXO.indexOf(k);
  return i >= 0 && i < FLUXO.length - 1 ? FLUXO[i + 1] : null;
}

export function jaPagou(k: EtapaKey) {
  return FLUXO.indexOf(k) >= FLUXO.indexOf("pago");
}
