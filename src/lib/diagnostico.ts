// Cálculos do diagnóstico a partir da planilha do escritório e do questionário.
// Tudo aqui é número medido; as notas das 8 áreas são dadas pela equipe, com evidência.

export type Lead = {
  lead_id: string | null;
  data_entrada: string | null;
  origem: string | null;
  area: string | null;
  subtema: string | null;
  cidade: string | null;
  tempo_1a_resposta_min: number | null;
  respondeu: boolean | null;
  qualificado: boolean | null;
  avancou_consulta: boolean | null;
  docs_enviados: boolean | null;
  proposta_enviada: boolean | null;
  fechado: boolean | null;
  etapa_atual: string | null;
  motivo: string | null;
  responsavel: string | null;
  honorario: number | null;
  id_conversa: string | null;
};

export type Mensagem = { id_conversa: string; lead_id: string | null; seq: number | null; data_hora: string | null; autor: string | null; mensagem: string | null };

export type LinhaDxr = { tema: string; declarado: string; real: string; selo: "confirma" | "diverge" | "sem dado"; comentario?: string };

export const AREAS = [
  { k: "velocidade", nome: "Velocidade", desc: "Quanto tempo o lead leva para receber atenção." },
  { k: "qualificacao", nome: "Qualificação", desc: "Se o escritório entende o perfil, a necessidade e a urgência." },
  { k: "diagnostico", nome: "Diagnóstico", desc: "Profundidade na investigação do problema do cliente." },
  { k: "conducao", nome: "Condução", desc: "Se o atendimento leva o lead para um próximo passo." },
  { k: "acompanhamento", nome: "Acompanhamento", desc: "Frequência, momento e qualidade dos retornos." },
  { k: "documentacao", nome: "Documentação", desc: "Pedido, explicação e acompanhamento dos documentos." },
  { k: "fechamento", nome: "Fechamento", desc: "Proposta, objeções, tentativa de fechamento e continuidade." },
  { k: "recuperacao", nome: "Recuperação", desc: "Oportunidades que pararam, mas ainda podem ter potencial." },
] as const;
export type AreaKey = (typeof AREAS)[number]["k"];

// Texto inicial das prioridades por área com nota baixa (a equipe edita antes do relatório)
export const PRIORIDADE_PADRAO: Record<AreaKey, { titulo: string; texto: string }> = {
  velocidade: { titulo: "Responder rápido, inclusive fora do horário", texto: "Definir quem responde o primeiro contato e em quanto tempo, com cobertura à noite e no fim de semana." },
  qualificacao: { titulo: "Qualificar antes de marcar a consulta", texto: "Usar perguntas padrão por área para entender perfil, necessidade e urgência antes de avançar." },
  diagnostico: { titulo: "Investigar melhor o caso de cada lead", texto: "Aprofundar as perguntas sobre o problema do cliente antes de propor o próximo passo." },
  conducao: { titulo: "Levar cada conversa a um próximo passo", texto: "Terminar toda conversa com um passo combinado (consulta, documentos ou proposta) e um roteiro aprovado pelo escritório." },
  acompanhamento: { titulo: "Retomar quem parou", texto: "Criar uma rotina de retorno em 1, 3 e 7 dias para quem parou após a consulta, os documentos ou a proposta." },
  documentacao: { titulo: "Facilitar e cobrar os documentos", texto: "Enviar a lista por tipo de caso e lembrar o cliente até o envio completo." },
  fechamento: { titulo: "Conduzir a proposta até a decisão", texto: "Apresentar a proposta com data de retorno combinada e respostas preparadas para as objeções mais comuns." },
  recuperacao: { titulo: "Reativar a base parada", texto: "Contatar leads antigos com relação prévia e consentimento, respeitando quem pediu para não ser contatado." },
};

// ---------------------------------------------------------------- importação
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
const simNao = (v: unknown): boolean | null => {
  const s = norm(v);
  if (!s) return null;
  if (["sim", "s", "true", "1", "yes"].includes(s)) return true;
  if (["nao", "n", "false", "0", "no"].includes(s)) return false;
  return null;
};
const numero = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const data = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T${br[4] ?? "00"}:${br[5] ?? "00"}:00`).toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const texto = (v: unknown) => (v == null || v === "" ? null : String(v).trim());

type Linha = unknown[];
function porCabecalho(linhas: Linha[]) {
  const cab = (linhas[0] ?? []).map(norm);
  return linhas.slice(1).filter((l) => l.some((c) => c != null && c !== "")).map((l) => {
    const o: Record<string, unknown> = {};
    cab.forEach((h, i) => { o[h] = l[i]; });
    return o;
  });
}

const COLUNAS_LEADS = ["lead_id", "data_entrada", "origem", "area_informada", "tempo_1a_resposta_min", "respondeu", "qualificado", "avancou_consulta", "docs_enviados", "proposta_enviada", "fechado"];

export function lerLeads(linhas: Linha[]): Lead[] {
  const rows = porCabecalho(linhas);
  const faltam = COLUNAS_LEADS.filter((c) => !(c in (rows[0] ?? {})));
  if (!rows.length) throw new Error("A aba Leads está vazia.");
  if (faltam.length) throw new Error("Faltam colunas na aba Leads: " + faltam.join(", ") + ". Use o modelo de planilha.");
  // Nome e telefone do lead NÃO são lidos (LGPD): o diagnóstico não precisa deles.
  return rows.map((r) => ({
    lead_id: texto(r.lead_id),
    data_entrada: data(r.data_entrada),
    origem: texto(r.origem),
    area: texto(r.area_informada ?? r.area),
    subtema: texto(r.subtema),
    cidade: texto(r.cidade),
    tempo_1a_resposta_min: numero(r.tempo_1a_resposta_min),
    respondeu: simNao(r.respondeu),
    qualificado: simNao(r.qualificado),
    avancou_consulta: simNao(r.avancou_consulta),
    docs_enviados: simNao(r.docs_enviados),
    proposta_enviada: simNao(r.proposta_enviada),
    fechado: simNao(r.fechado),
    etapa_atual: texto(r.etapa_atual),
    motivo: texto(r.motivo_perda_ou_parada ?? r.motivo),
    responsavel: texto(r.responsavel),
    honorario: numero(r.honorario_contratado ?? r.honorario),
    id_conversa: texto(r.id_conversa),
  }));
}

export function lerConversas(linhas: Linha[]): Mensagem[] {
  const rows = porCabecalho(linhas);
  if (rows.length && !("id_conversa" in rows[0] && "mensagem" in rows[0])) throw new Error("A aba Conversas precisa das colunas id_conversa e mensagem. Use o modelo de planilha.");
  return rows.map((r) => ({
    id_conversa: String(r.id_conversa ?? ""),
    lead_id: texto(r.lead_id),
    seq: numero(r.seq),
    data_hora: data(r.data_hora),
    autor: texto(r.autor),
    mensagem: texto(r.mensagem),
  })).filter((m) => m.id_conversa && m.mensagem);
}

// ---------------------------------------------------------------- números
const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export function calcular(leads: Lead[]) {
  const total = leads.length;
  const conta = (f: (l: Lead) => boolean) => leads.filter(f).length;
  const funil = [
    { etapa: "Entraram", n: total },
    { etapa: "Responderam", n: conta((l) => !!l.respondeu) },
    { etapa: "Qualificados", n: conta((l) => !!l.qualificado) },
    { etapa: "Consulta", n: conta((l) => !!l.avancou_consulta) },
    { etapa: "Documentos", n: conta((l) => !!l.docs_enviados) },
    { etapa: "Proposta", n: conta((l) => !!l.proposta_enviada) },
    { etapa: "Fecharam", n: conta((l) => !!l.fechado) },
  ];
  const tempos = leads.map((l) => l.tempo_1a_resposta_min).filter((t): t is number => t != null);
  const fechados = leads.filter((l) => l.fechado);
  const comHonorario = fechados.map((l) => l.honorario).filter((h): h is number => h != null && h > 0);
  const ticket = comHonorario.length ? comHonorario.reduce((a, b) => a + b, 0) / comHonorario.length : 0;
  const perdido = (l: Lead) => norm(l.etapa_atual) === "perdido";
  const paradosProposta = conta((l) => !!l.proposta_enviada && !l.fechado && !perdido(l));
  const paradosDocs = conta((l) => !!l.avancou_consulta && !l.docs_enviados && !perdido(l));

  const agrupa = (chave: (l: Lead) => string | null) => {
    const m = new Map<string, { leads: number; fechados: number; tempos: number[] }>();
    leads.forEach((l) => {
      const k = chave(l) ?? "Não informado";
      const g = m.get(k) ?? { leads: 0, fechados: 0, tempos: [] };
      g.leads++; if (l.fechado) g.fechados++; if (l.tempo_1a_resposta_min != null) g.tempos.push(l.tempo_1a_resposta_min);
      m.set(k, g);
    });
    return [...m.entries()].map(([nome, g]) => ({ nome, leads: g.leads, fechados: g.fechados, tempo_mediano: Math.round(mediana(g.tempos)) })).sort((a, b) => b.leads - a.leads);
  };
  const motivos = new Map<string, number>();
  leads.forEach((l) => { if (l.motivo) motivos.set(l.motivo, (motivos.get(l.motivo) ?? 0) + 1); });

  const datas = leads.map((l) => l.data_entrada).filter(Boolean).map((d) => new Date(d!).getTime());
  const meses = datas.length ? Math.max(1, (Math.max(...datas) - Math.min(...datas)) / (30.4 * 864e5)) : 1;
  const fmtMes = (t: number) => new Date(t).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  const periodo = datas.length ? `${fmtMes(Math.min(...datas))} a ${fmtMes(Math.max(...datas))}` : "";

  return {
    total, funil, ticket, meses, periodo,
    fechados: fechados.length,
    honorarios: comHonorario.reduce((a, b) => a + b, 0),
    tempoMediano: Math.round(mediana(tempos)),
    acima1h: tempos.filter((t) => t > 60).length,
    acima4h: tempos.filter((t) => t > 240).length,
    comTempo: tempos.length,
    paradosProposta, paradosDocs,
    porOrigem: agrupa((l) => l.origem),
    porResponsavel: agrupa((l) => l.responsavel?.replace(/\s*\(.*\)/, "") ?? null),
    motivos: [...motivos.entries()].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n),
    semOrigem: conta((l) => !l.origem),
    leadsAcima: (min: number) => tempos.filter((t) => t > min).length,
  };
}
export type Calculo = ReturnType<typeof calcular>;

// ---------------------------------------------------------------- Declarado × Real
const FAIXA_TEMPO: Record<string, number> = { "Até 5 minutos": 5, "Até 1 hora": 60, "Até 4 horas": 240, "No mesmo dia": 720, "No dia seguinte ou mais": 1440 };
const FAIXA_CONV: Record<string, [number, number]> = { "0 a 1": [0, 1], "2 a 3": [2, 3], "4 a 5": [4, 5], "6 ou mais": [6, 10] };
const FAIXA_VOL: Record<string, [number, number]> = { "Até 20": [0, 20], "21 a 50": [21, 50], "51 a 100": [51, 100], "101 a 300": [101, 300], "Mais de 300": [301, 1e9] };
const FAIXA_TICKET: Record<string, [number, number]> = { "Até R$ 2 mil": [0, 2000], "R$ 2 a 5 mil": [2000, 5000], "R$ 5 a 10 mil": [5000, 10000], "R$ 10 a 20 mil": [10000, 20000], "Acima de R$ 20 mil": [20000, 1e9] };
const FAIXA_PESSOAS: Record<string, [number, number]> = { "1": [1, 1], "2 a 3": [2, 3], "4 a 6": [4, 6], "7 ou mais": [7, 1e3] };
const CANAL: Record<string, string[]> = {
  "Indicação": ["indica"], "Instagram": ["instagram", "insta"], "Anúncios no Google": ["google"],
  "Anúncios no Instagram/Facebook": ["meta", "facebook", "instagram"], "Site": ["site", "formul"],
  "Perfil no Google Maps": ["maps", "meu negocio"], "Parcerias": ["parceri"],
};
const PERDA: Record<string, string[]> = {
  "Demora para responder": ["demor", "primeiro retorno"], "O contato some e não responde": ["sem resposta"],
  "Atendemos casos sem perfil": ["sem perfil", "fora da area"], "O cliente não envia os documentos": ["document"],
  "Falta retomar quem parou": ["parado"], "Na hora de apresentar a proposta": ["proposta"],
  "Nas objeções, como preço": ["preco"], "Na hora de fechar": ["proposta", "outro escritorio"],
};

const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const um = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

export function declaradoReal(resp: Record<string, unknown> | null | undefined, c: Calculo): LinhaDxr[] {
  const r = resp ?? {};
  const linhas: LinhaDxr[] = [];
  const add = (tema: string, declarado: unknown, real: string, selo: LinhaDxr["selo"]) =>
    linhas.push({ tema, declarado: lista(declarado).join(", ") || "Não respondeu", real, selo: declarado ? selo : "sem dado" });

  // Tempo de resposta
  const lim = FAIXA_TEMPO[String(r.tempo_resposta ?? "")];
  if (c.comTempo) {
    const acima = lim ? c.leadsAcima(lim) : 0;
    const pct = Math.round((100 * acima) / c.comTempo);
    add("Tempo de resposta", r.tempo_resposta,
      lim ? `Mediana de ${c.tempoMediano} min; ${pct}% esperaram mais que o declarado e ${c.acima4h} leads mais de 4h` : `Mediana de ${c.tempoMediano} min; ${c.acima4h} leads esperaram mais de 4h`,
      lim ? (pct > 25 ? "diverge" : "confirma") : "sem dado");
  }
  // Conversão
  const conv = (10 * c.fechados) / Math.max(1, c.total);
  const fc = FAIXA_CONV[String(r.conversao ?? "")];
  add("Conversão", r.conversao ? `${r.conversao} de cada 10` : null, `${c.fechados} de ${c.total} leads fecharam: ${um(conv)} de cada 10`,
    fc ? (conv >= fc[0] && conv < fc[1] + 1 ? "confirma" : "diverge") : "sem dado");
  // Retomada
  const parados = c.paradosProposta + c.paradosDocs;
  add("Retomada de quem parou", r.followup, `${c.paradosProposta} parados após a proposta e ${c.paradosDocs} sem enviar documentos`,
    r.followup === "Sim" && parados / Math.max(1, c.total) > 0.1 ? "diverge" : r.followup ? "confirma" : "sem dado");
  // Onde mais perde
  const top = c.motivos.slice(0, 2);
  const decl = lista(r.perda);
  const bate = decl.some((d) => (PERDA[d] ?? []).some((k) => top.some((m) => norm(m.motivo).includes(norm(k)))));
  add("Onde mais perde", decl.length ? decl : null,
    top.length ? "Maiores motivos na base: " + c.motivos.slice(0, 4).map((m) => `${m.motivo} (${m.n})`).join("; ") : "Planilha sem motivos de perda",
    !top.length || decl.includes("Não sei exatamente") ? "sem dado" : bate ? "confirma" : "diverge");
  // Canal principal
  const melhor = [...c.porOrigem].filter((o) => o.nome !== "Não informado").sort((a, b) => b.fechados - a.fechados)[0];
  const chaves = CANAL[String(r.canal_principal ?? "")] ?? [];
  if (melhor) add("Canal principal", r.canal_principal,
    "Fechamentos por origem: " + c.porOrigem.slice(0, 4).map((o) => `${o.nome} ${o.fechados} de ${o.leads}`).join("; "),
    chaves.length ? (chaves.some((k) => norm(melhor.nome).includes(norm(k))) ? "confirma" : "diverge") : "sem dado");
  // Volume
  const porMes = Math.round(c.total / c.meses);
  const fv = FAIXA_VOL[String(r.volume ?? "")];
  add("Volume mensal", r.volume, `${c.total} leads em ${um(c.meses)} meses: cerca de ${porMes} por mês`, fv ? (porMes >= fv[0] && porMes <= fv[1] ? "confirma" : "diverge") : "sem dado");
  // Ticket
  const ft = FAIXA_TICKET[String(r.ticket ?? "")];
  if (c.ticket) add("Valor por cliente", r.ticket, `Ticket médio de ${brl0(c.ticket)}`, ft ? (c.ticket >= ft[0] && c.ticket <= ft[1] ? "confirma" : "diverge") : "sem dado");
  // Qualificação
  const semPerfil = c.motivos.filter((m) => /sem perfil|fora da area/.test(norm(m.motivo).replace(/_/g, " "))).reduce((s, m) => s + m.n, 0);
  add("Verificação de perfil", r.qualificacao, `${semPerfil} leads (${Math.round((100 * semPerfil) / Math.max(1, c.total))}%) saíram por falta de perfil ou área`,
    r.qualificacao === "Sim" ? (semPerfil / Math.max(1, c.total) > 0.2 ? "diverge" : "confirma") : r.qualificacao ? "confirma" : "sem dado");
  // Origem registrada
  add("Origem dos contatos", r.origem ? `Sabem a origem: ${r.origem}` : null, c.semOrigem ? `${c.semOrigem} leads sem origem registrada` : `Todos os ${c.total} leads têm origem registrada`,
    r.origem === "Sim" ? (c.semOrigem ? "diverge" : "confirma") : r.origem ? (c.semOrigem ? "confirma" : "diverge") : "sem dado");
  // Pessoas
  const pessoas = c.porResponsavel.filter((p) => p.nome !== "Não informado");
  const fp = FAIXA_PESSOAS[String(r.pessoas ?? "")];
  if (pessoas.length) add("Quem atende", r.pessoas ? `${r.pessoas} pessoas` : null, `${pessoas.length} atendentes na base: ${pessoas.map((p) => p.nome).join(", ")}`,
    fp ? (pessoas.length >= fp[0] && pessoas.length <= fp[1] ? "confirma" : "diverge") : "sem dado");
  return linhas;
}
