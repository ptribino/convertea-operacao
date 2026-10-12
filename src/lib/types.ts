import type { EtapaKey } from "./etapas";

export type Cliente = {
  id: string;
  criado_em: string;
  atualizado_em: string;
  escritorio: string;
  contato_nome: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  area: string | null;
  etapa: EtapaKey;
  responsavel: "Pri" | "Mateus";
  proxima_acao: string | null;
  proxima_data: string | null;
  temperatura: string | null;
  motivo_perda: string | null;
  saida: string | null;
  pre_diagnostico_id: string | null;
  diagnostico_id: string | null;
  teste: boolean;
};

export type Interacao = {
  id: string;
  cliente_id: string;
  criado_em: string;
  autor: string;
  tipo: "nota" | "etapa" | "proposta" | "sistema";
  texto: string;
};

export type Proposta = {
  id: string;
  cliente_id: string;
  criado_em: string;
  valor: number;
  enviada_em: string;
  status: "enviada" | "aceita" | "recusada";
  pago_em: string | null;
};

export type Diagnostico = {
  id: string;
  criado_em: string;
  nome: string;
  escritorio: string;
  whatsapp: string;
  email: string;
  cidade: string | null;
  respostas: Record<string, unknown>;
  status: string;
};

export type PreDiagnostico = Record<string, unknown> & { id: string; criado_em?: string };
