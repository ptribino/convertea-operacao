import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import { useDiagnostico, useEu, useMoverEtapa } from "../lib/api";
import {
  useAnalises, useAtualizarAnalise, useConversas, useEvidencias, useExcluirAnalise, useExcluirEvidencia,
  useImportar, useLeads, useNovaEvidencia, useNotas, useSalvarNota, type Analise, type Evidencia, type Nota,
} from "../lib/apiDiagnostico";
import {
  AREAS, PRIORIDADE_PADRAO, calcular, declaradoReal, lerConversas, lerLeads,
  type AreaKey, type Calculo, type Lead, type LinhaDxr, type Mensagem,
} from "../lib/diagnostico";
import { jaPagou } from "../lib/etapas";
import type { Cliente } from "../lib/types";
import { brl, useToast } from "../components/ui";
import { mensagemErro } from "../lib/supabase";

type Passo = "numeros" | "dxr" | "notas" | "impacto" | "relatorio";
const PASSOS: { k: Passo; n: string }[] = [
  { k: "numeros", n: "1. Números" }, { k: "dxr", n: "2. Declarado × Real" }, { k: "notas", n: "3. Notas das 8 áreas" },
  { k: "impacto", n: "4. Impacto e prioridades" }, { k: "relatorio", n: "5. Relatório" },
];
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export function Funil({ funil }: { funil: { etapa: string; n: number }[] }) {
  const max = Math.max(1, funil[0]?.n ?? 1);
  let pior = -1, perda = 0;
  funil.forEach((s, i) => { if (i && funil[i - 1].n) { const p = 1 - s.n / funil[i - 1].n; if (p > perda) { perda = p; pior = i; } } });
  return (
    <>
      <div className="fun">
        {funil.map((s, i) => (
          <div className={"fun-row" + (i === pior ? " pior" : "")} key={s.etapa}>
            <span>{s.etapa}</span>
            <div className="fun-bar"><i style={{ width: `${(100 * s.n) / max}%` }} /></div>
            <span className="q num"><b style={{ color: "var(--ink)" }}>{s.n}</b>{i ? ` · ${pct(s.n, funil[i - 1].n)}%` : ""}</span>
          </div>
        ))}
      </div>
      {pior > 0 && <p className="sub" style={{ margin: "12px 0 0" }}>Percentual = quantos seguiram da etapa anterior. Em destaque, a maior queda: {funil[pior - 1].etapa.toLowerCase()} → {funil[pior].etapa.toLowerCase()}.</p>}
    </>
  );
}

export default function Diagnostico({ cl }: { cl: Cliente }) {
  const analises = useAnalises(cl.id);
  const a = analises.data?.find((x) => x.tipo === "diagnostico");
  if (!jaPagou(cl.etapa)) return <div className="aviso">O diagnóstico começa depois do pagamento confirmado.</div>;
  if (analises.isLoading) return <p className="sub">Carregando…</p>;
  if (analises.error) return <div className="erro">{mensagemErro(analises.error)}</div>;
  return a ? <Operacao cl={cl} a={a} /> : <Importar cl={cl} />;
}

// ---------------------------------------------------------------- 0. importar
function Importar({ cl }: { cl: Cliente }) {
  const toast = useToast();
  const quest = useDiagnostico(cl.diagnostico_id);
  const importar = useImportar();
  const mover = useMoverEtapa();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dados, setDados] = useState<{ leads: Lead[]; conversas: Mensagem[]; calc: Calculo } | null>(null);
  const [erro, setErro] = useState("");
  const [progresso, setProgresso] = useState("");

  async function ler(f: File) {
    setErro(""); setDados(null); setArquivo(f);
    try {
      const abas = await readSheetNames(f);
      const achar = (nome: string) => abas.find((s) => s.trim().toLowerCase() === nome);
      if (!achar("leads")) throw new Error(`A planilha precisa de uma aba "Leads". Abas encontradas: ${abas.join(", ")}.`);
      const leads = lerLeads(await readXlsxFile(f, { sheet: achar("leads")! }));
      const conversas = achar("conversas") ? lerConversas(await readXlsxFile(f, { sheet: achar("conversas")! })) : [];
      setDados({ leads, conversas, calc: calcular(leads) });
    } catch (e) { setErro(mensagemErro(e)); }
  }

  async function gravar() {
    if (!dados || !arquivo) return;
    const c = dados.calc;
    try {
      await importar.mutateAsync({
        cliente: cl.id, arquivo: arquivo.name, periodo: c.periodo, leads: dados.leads, conversas: dados.conversas,
        dxr: declaradoReal(quest.data?.respostas, c), ticket: c.ticket, comprovado: c.honorarios, estimado: c.paradosProposta * c.ticket,
        progresso: setProgresso,
      });
      if (cl.etapa === "pago" || cl.etapa === "questionario") await mover.mutateAsync({ cliente: cl.id, etapa: "dados" });
      toast("Planilha importada. O cliente foi para Dados recebidos.");
    } catch (e) { toast(mensagemErro(e), true); setProgresso(""); }
  }

  const c = dados?.calc;
  return (
    <div className="grid2">
      <div className="bloco">
        <h2>Começar o diagnóstico</h2>
        <p className="sub">Importe a planilha que o escritório enviou, com a aba Leads e, se tiver, a aba Conversas.</p>
        {!cl.diagnostico_id && <p className="aviso" style={{ marginBottom: 14 }}>Este cliente ainda não tem questionário respondido. Dá para importar, mas o Declarado × Real só fica completo com o questionário.</p>}
        <label className="campo" htmlFor="planilha">Planilha do escritório (.xlsx)
          <input id="planilha" type="file" accept=".xlsx" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
        </label>
        <p className="sub" style={{ marginTop: 10 }}><a href="/modelo_diagnostico.xlsx" download>Baixar o modelo de planilha</a> para enviar ao escritório. Nome e telefone dos leads não são lidos nem guardados.</p>
        {erro && <div className="erro">{erro}</div>}
      </div>
      {c && (
        <div className="bloco">
          <h2>Conferência antes de gravar</h2>
          <p className="sub">{arquivo?.name}</p>
          <dl className="kv num">
            <dt>Leads</dt><dd>{c.total}</dd>
            <dt>Período</dt><dd>{c.periodo || "sem datas"}</dd>
            <dt>Fecharam</dt><dd>{c.fechados} ({c.total ? ((10 * c.fechados) / c.total).toFixed(1).replace(".", ",") : 0} de cada 10)</dd>
            <dt>Ticket médio</dt><dd>{c.ticket ? brl(c.ticket) : "sem honorários na planilha"}</dd>
            <dt>Mensagens de conversa</dt><dd>{dados!.conversas.length} em {new Set(dados!.conversas.map((m) => m.id_conversa)).size} conversas</dd>
            <dt>Leads sem tempo de resposta</dt><dd>{c.total - c.comTempo}</dd>
          </dl>
          {!dados!.conversas.length && <p className="aviso" style={{ marginTop: 12 }}>Sem conversas, as notas não terão de onde tirar evidências. Peça as conversas ao escritório.</p>}
          <button className="btn pri" style={{ marginTop: 16 }} disabled={importar.isPending} onClick={gravar}>{importar.isPending ? progresso || "Gravando…" : "Importar e começar"}</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- operação
function Operacao({ cl, a }: { cl: Cliente; a: Analise }) {
  const leads = useLeads(a.id);
  const notas = useNotas(a.id);
  const [passo, setPasso] = useState<Passo>(a.status === "dados" ? "numeros" : a.status === "notas" ? "notas" : "relatorio");
  const calc = useMemo(() => (leads.data ? calcular(leads.data) : null), [leads.data]);
  const feitas = (notas.data ?? []).filter((n) => n.nota != null || n.nao_se_aplica).length;

  return (
    <>
      <div className="ficha-top">
        <div>
          <div className="eyebrow">Diagnóstico · {a.periodo || "período não informado"}</div>
          <p className="sub" style={{ margin: "2px 0 0" }}>Planilha {a.arquivo} · {leads.data?.length ?? "…"} leads · notas {feitas} de 8</p>
        </div>
        <Excluir a={a} />
      </div>
      <div className="seg" role="tablist" aria-label="Passos do diagnóstico" style={{ flexWrap: "wrap", borderRadius: 14 }}>
        {PASSOS.map((p) => <button key={p.k} role="tab" aria-selected={passo === p.k} onClick={() => setPasso(p.k)}>{p.n}{p.k === "notas" ? ` (${feitas}/8)` : ""}</button>)}
      </div>
      {!calc ? <p className="sub">Carregando os leads…</p> : (
        <>
          {passo === "numeros" && <Numeros c={calc} />}
          {passo === "dxr" && <Dxr cl={cl} a={a} c={calc} />}
          {passo === "notas" && <Notas cl={cl} a={a} notas={notas.data ?? []} />}
          {passo === "impacto" && <Impacto key={a.id + a.status} cl={cl} a={a} c={calc} notas={notas.data ?? []} irRelatorio={() => setPasso("relatorio")} />}
          {passo === "relatorio" && <Revisao cl={cl} a={a} feitas={feitas} />}
        </>
      )}
    </>
  );
}

function Excluir({ a }: { a: Analise }) {
  const [aberto, setAberto] = useState(false);
  const excluir = useExcluirAnalise();
  const toast = useToast();
  if (a.status === "entregue") return null;
  return aberto ? (
    <div className="caixa perigo" style={{ marginTop: 0 }}>
      <span>Apagar esta análise, os leads, as conversas, as notas e as evidências? A etapa do cliente não muda.</span>
      <div className="acoes">
        <button className="btn perigo" onClick={async () => { try { await excluir.mutateAsync(a.id); toast("Análise apagada. Importe a planilha de novo."); } catch (e) { toast(mensagemErro(e), true); } }}>Apagar e reimportar</button>
        <button className="btn" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  ) : <button className="btn peq" onClick={() => setAberto(true)}>Trocar planilha</button>;
}

// ---------------------------------------------------------------- 1. números
function Numeros({ c }: { c: Calculo }) {
  return (
    <div className="grid2">
      <div className="bloco"><h2>Caminho dos leads</h2><p className="sub">{c.total} leads · {c.periodo}</p><Funil funil={c.funil} /></div>
      <div className="bloco">
        <h2>Origem × fechamento</h2><p className="sub">Volume não é o mesmo que resultado</p>
        <div className="tbl-wrap"><table className="num"><thead><tr><th>Origem</th><th>Leads</th><th>Fecharam</th><th>Taxa</th></tr></thead>
          <tbody>{c.porOrigem.map((o) => <tr key={o.nome}><td>{o.nome}</td><td>{o.leads}</td><td>{o.fechados}</td><td>{(100 * o.fechados / o.leads).toFixed(1).replace(".", ",")}%</td></tr>)}</tbody></table></div>
        <h3 style={{ fontSize: 15, margin: "18px 0 6px" }}>Por atendente</h3>
        <div className="tbl-wrap"><table className="num"><thead><tr><th>Atendente</th><th>Leads</th><th>Fecharam</th><th>1ª resposta (mediana)</th></tr></thead>
          <tbody>{c.porResponsavel.map((o) => <tr key={o.nome}><td>{o.nome}</td><td>{o.leads}</td><td>{o.fechados}</td><td>{o.tempo_mediano} min</td></tr>)}</tbody></table></div>
      </div>
      <div className="bloco"><h2>Motivos de perda ou parada</h2><p className="sub">Como a própria planilha registra</p>
        <div className="tbl-wrap"><table className="num"><tbody>{c.motivos.map((m) => <tr key={m.motivo}><td>{m.motivo}</td><td style={{ textAlign: "right" }}><b>{m.n}</b></td></tr>)}</tbody></table></div>
      </div>
      <div className="bloco"><h2>Tempo e paradas</h2><p className="sub">Base para Velocidade, Acompanhamento e impacto</p>
        <dl className="kv num">
          <dt>1ª resposta (mediana)</dt><dd>{c.tempoMediano} min</dd>
          <dt>Esperaram mais de 1h</dt><dd>{c.acima1h} ({pct(c.acima1h, c.comTempo)}%)</dd>
          <dt>Esperaram mais de 4h</dt><dd>{c.acima4h}</dd>
          <dt>Parados após a proposta</dt><dd>{c.paradosProposta}</dd>
          <dt>Parados sem documentos</dt><dd>{c.paradosDocs}</dd>
          <dt>Ticket médio</dt><dd>{brl(c.ticket)}</dd>
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 2. Declarado × Real
function Dxr({ cl, a, c }: { cl: Cliente; a: Analise; c: Calculo }) {
  const quest = useDiagnostico(cl.diagnostico_id);
  const salvar = useAtualizarAnalise();
  const toast = useToast();
  const [linhas, setLinhas] = useState<LinhaDxr[]>(a.dxr ?? []);
  const set = (i: number, campo: keyof LinhaDxr, v: string) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const dv = linhas.filter((l) => l.selo === "diverge").length;
  return (
    <div className="bloco">
      <div className="ficha-top"><div><h2>Declarado × Real</h2><p className="sub">{dv} de {linhas.length} respostas do questionário não batem com a planilha. O selo é sugerido pelo sistema; ajuste se discordar e explique no comentário.</p></div>
        {quest.data && <button className="btn peq" onClick={() => { setLinhas(declaradoReal(quest.data!.respostas, c)); toast("Recalculado a partir do questionário. Salve para manter."); }}>Recalcular</button>}
      </div>
      {!linhas.length ? <p className="aviso">Sem questionário vinculado. Vincule em Questionários e clique em Recalcular.</p> : (
        <div className="tbl-wrap"><table><thead><tr><th>Tema</th><th>O escritório disse</th><th>A planilha mostra</th><th>Selo</th><th>Comentário</th></tr></thead>
          <tbody>{linhas.map((l, i) => (
            <tr key={l.tema}>
              <td><b>{l.tema}</b></td><td className="sub" style={{ margin: 0 }}>{l.declarado}</td><td className="num">{l.real}</td>
              <td><select aria-label={`Selo de ${l.tema}`} value={l.selo} onChange={(e) => set(i, "selo", e.target.value)} className={"selo-sel " + l.selo.replace(" ", "")}><option value="confirma">confirma</option><option value="diverge">diverge</option><option value="sem dado">sem dado</option></select></td>
              <td><input aria-label={`Comentário de ${l.tema}`} value={l.comentario ?? ""} onChange={(e) => set(i, "comentario", e.target.value)} placeholder="Opcional" /></td>
            </tr>))}</tbody></table></div>
      )}
      <button className="btn pri" style={{ marginTop: 14 }} disabled={salvar.isPending} onClick={async () => { try { await salvar.mutateAsync({ id: a.id, campos: { dxr: linhas } }); toast("Declarado × Real salvo"); } catch (e) { toast(mensagemErro(e), true); } }}>Salvar</button>
    </div>
  );
}

// ---------------------------------------------------------------- 3. notas
function Notas({ cl, a, notas }: { cl: Cliente; a: Analise; notas: Nota[] }) {
  const evid = useEvidencias(a.id);
  const [aberta, setAberta] = useState<AreaKey | null>(null);
  return (
    <div className="bloco">
      <h2>Notas das 8 áreas</h2>
      <p className="sub">Cada nota de 0 a 100 precisa de pelo menos um trecho de conversa como evidência (slide 5 da metodologia). Use "Não se aplica" quando a área não aparecer nos dados.</p>
      <div className="areas">
        {AREAS.map((ar) => {
          const n = notas.find((x) => x.area === ar.k);
          const evs = (evid.data ?? []).filter((e) => e.area === ar.k);
          const cor = n?.nota == null ? "var(--line)" : n.nota < 50 ? "var(--bad)" : n.nota < 60 ? "var(--warn)" : "var(--good)";
          return (
            <div className="area" key={ar.k}>
              <button className="area-cab" aria-expanded={aberta === ar.k} onClick={() => setAberta(aberta === ar.k ? null : ar.k)}>
                <span><b>{ar.nome}</b><small>{ar.desc}</small></span>
                <span className="nb" aria-hidden="true"><i style={{ width: `${n?.nota ?? 0}%`, background: cor }} /></span>
                <b className="num" style={{ textAlign: "right" }}>{n?.nao_se_aplica ? "n/a" : n?.nota ?? "—"}</b>
                <span className="chip">{evs.length} evid.</span>
              </button>
              {aberta === ar.k && <EditarArea key={ar.k + (n?.nota ?? "") + evs.length} cl={cl} a={a} area={ar.k} nota={n} evs={evs} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditarArea({ cl, a, area, nota, evs }: { cl: Cliente; a: Analise; area: AreaKey; nota?: Nota; evs: Evidencia[] }) {
  const toast = useToast();
  const eu = useEu();
  const autor = eu.data?.nome ?? "Equipe";
  const salvar = useSalvarNota();
  const excluirEv = useExcluirEvidencia();
  const mover = useMoverEtapa();
  const atualizar = useAtualizarAnalise();
  const [valor, setValor] = useState<number>(nota?.nota ?? 50);
  const [na, setNa] = useState(nota?.nao_se_aplica ?? false);
  const [coment, setComent] = useState(nota?.comentario ?? "");
  const [escolher, setEscolher] = useState(false);

  async function gravar() {
    try {
      await salvar.mutateAsync({ analise_id: a.id, area, nota: na ? null : valor, nao_se_aplica: na, comentario: coment || null, autor });
      if (a.status === "dados") await atualizar.mutateAsync({ id: a.id, campos: { status: "notas" } });
      if (cl.etapa === "dados") await mover.mutateAsync({ cliente: cl.id, etapa: "analise" });
      toast("Nota salva");
    } catch (e) { toast(mensagemErro(e), true); }
  }

  return (
    <div className="area-corpo">
      <div className="ev-lista">
        <b style={{ fontSize: 14 }}>Evidências</b>
        {evs.length ? evs.map((e) => (
          <div className="ev" key={e.id}>
            <div className="zap">{e.trecho.map((m, i) => <p key={i} className={m.autor === "Lead" ? "" : "at"}><small>{m.autor}</small>{m.mensagem}</p>)}</div>
            {e.comentario && <p style={{ margin: "8px 0 0", fontSize: 13.5 }}>{e.comentario}</p>}
            <div className="chips" style={{ marginTop: 8 }}><span className="chip">{e.id_conversa}</span><span className="chip">por {e.criado_por}</span>
              <button className="btn peq perigo" onClick={() => excluirEv.mutate(e.id)}>Remover</button></div>
          </div>
        )) : <p className="sub" style={{ margin: 0 }}>Nenhuma evidência ainda.</p>}
        {escolher ? <EscolherTrecho a={a} area={area} autor={autor} fechar={() => setEscolher(false)} /> : <button className="btn" onClick={() => setEscolher(true)}>+ Adicionar evidência de uma conversa</button>}
      </div>
      <div className="form" style={{ alignItems: "end" }}>
        <label className="campo" htmlFor={`nota-${area}`}>Nota (0 a 100)
          <div className="linha" style={{ alignItems: "center" }}>
            <input type="range" min={0} max={100} step={1} value={valor} disabled={na} onChange={(e) => setValor(Number(e.target.value))} aria-label="Nota" />
            <input id={`nota-${area}`} type="number" min={0} max={100} value={valor} disabled={na} onChange={(e) => setValor(Math.max(0, Math.min(100, Number(e.target.value))))} style={{ flex: "0 0 80px" }} />
          </div>
        </label>
        <label className="chk"><input type="checkbox" checked={na} onChange={(e) => setNa(e.target.checked)} /> Não se aplica a este escritório</label>
      </div>
      <label className="campo" htmlFor={`coment-${area}`}>O que aconteceu, qual o impacto, o que precisa ser feito
        <textarea id={`coment-${area}`} value={coment} onChange={(e) => setComent(e.target.value)} />
      </label>
      <div className="acoes"><button className="btn pri" disabled={salvar.isPending || (!na && !evs.length)} onClick={gravar}>Salvar nota</button>
        {!na && !evs.length && <span className="sub" style={{ margin: 0 }}>Adicione uma evidência para liberar a nota.</span>}</div>
    </div>
  );
}

function EscolherTrecho({ a, area, autor, fechar }: { a: Analise; area: AreaKey; autor: string; fechar: () => void }) {
  const conversas = useConversas(a.id);
  const leads = useLeads(a.id);
  const nova = useNovaEvidencia();
  const toast = useToast();
  const [conv, setConv] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const [coment, setComent] = useState("");
  const grupos = useMemo(() => {
    const m = new Map<string, Mensagem[]>();
    (conversas.data ?? []).forEach((x) => m.set(x.id_conversa, [...(m.get(x.id_conversa) ?? []), x]));
    return m;
  }, [conversas.data]);
  const lead = (id: string) => leads.data?.find((l) => l.id_conversa === id);
  const msgs = grupos.get(conv) ?? [];
  if (conversas.isLoading) return <p className="sub">Carregando conversas…</p>;
  if (!grupos.size) return <p className="aviso">Esta análise não tem conversas importadas.</p>;
  return (
    <div className="caixa">
      <label className="campo" htmlFor="conv">Conversa
        <select id="conv" value={conv} onChange={(e) => { setConv(e.target.value); setSel([]); }}>
          <option value="">Escolha uma conversa</option>
          {[...grupos.keys()].map((k) => { const l = lead(k); return <option key={k} value={k}>{k}{l ? ` · ${l.area ?? ""} · ${l.etapa_atual ?? ""}${l.tempo_1a_resposta_min != null ? ` · 1ª resposta ${l.tempo_1a_resposta_min} min` : ""}` : ""}</option>; })}
        </select>
      </label>
      {conv && (
        <>
          <span className="sub" style={{ margin: 0 }}>Marque as mensagens que mostram o que aconteceu.</span>
          <div className="zap escolha">
            {msgs.map((m, i) => (
              <label key={i} className={m.autor === "Lead" ? "" : "at"}>
                <input type="checkbox" checked={sel.includes(i)} onChange={(e) => setSel(e.target.checked ? [...sel, i] : sel.filter((x) => x !== i))} />
                <span><small>{m.autor}{m.data_hora ? ` · ${new Date(m.data_hora).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</small>{m.mensagem}</span>
              </label>
            ))}
          </div>
          <label className="campo" htmlFor="ev-coment">Por que este trecho sustenta a nota<input id="ev-coment" value={coment} onChange={(e) => setComent(e.target.value)} /></label>
        </>
      )}
      <div className="acoes">
        <button className="btn pri" disabled={!sel.length || nova.isPending} onClick={async () => {
          try {
            await nova.mutateAsync({ analise_id: a.id, area, id_conversa: conv, trecho: [...sel].sort((x, y) => x - y).map((i) => ({ autor: msgs[i].autor ?? "", mensagem: msgs[i].mensagem ?? "" })), comentario: coment || null, criado_por: autor });
            toast("Evidência adicionada"); fechar();
          } catch (e) { toast(mensagemErro(e), true); }
        }}>Adicionar {sel.length ? `${sel.length} ${sel.length > 1 ? "mensagens" : "mensagem"}` : ""}</button>
        <button className="btn" onClick={fechar}>Cancelar</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 4. impacto e prioridades
function Impacto({ cl, a, c, notas, irRelatorio }: { cl: Cliente; a: Analise; c: Calculo; notas: Nota[]; irRelatorio: () => void }) {
  const toast = useToast();
  const salvar = useAtualizarAnalise();
  const mover = useMoverEtapa();
  const comNota = notas.filter((n) => n.nota != null).sort((x, y) => (x.nota ?? 0) - (y.nota ?? 0));
  const menor = comNota[0]?.area;
  const nomeArea = (k?: string | null) => AREAS.find((x) => x.k === k)?.nome ?? "";
  const [gargalo, setGargalo] = useState<string>(a.gargalo ?? menor ?? "");
  const [comprovado, setComprovado] = useState(String(Math.round(a.impacto_comprovado ?? c.honorarios)));
  const [estimado, setEstimado] = useState(String(Math.round(a.impacto_estimado ?? c.paradosProposta * c.ticket)));
  const [notaImp, setNotaImp] = useState(a.impacto_nota ?? `${c.paradosProposta} leads parados após a proposta × ticket médio de ${brl(c.ticket)}. É valor potencial, não garantido.`);
  const conv = ((10 * c.fechados) / Math.max(1, c.total)).toFixed(1).replace(".", ",");
  const [resumo, setResumo] = useState(a.resumo ?? `De cada 10 contatos que chegaram, ${conv} viraram contrato. A maior perda está em ${nomeArea(gargalo || menor).toLowerCase() || "[área]"}: ${c.paradosProposta} pessoas receberam proposta e não fecharam, e ${c.paradosDocs} pararam no envio de documentos.`);
  const [prior, setPrior] = useState(() => {
    const base = a.prioridades?.length ? a.prioridades : comNota.slice(0, 3).map((n) => PRIORIDADE_PADRAO[n.area]);
    return [...base, ...Array.from({ length: Math.max(0, 3 - base.length) }, () => ({ titulo: "", texto: "" }))];
  });
  const faltam = 8 - notas.filter((n) => n.nota != null || n.nao_se_aplica).length;
  const num = (s: string) => Number(s.replace(/\D/g, "")) || 0;

  async function gravar(gerar: boolean) {
    try {
      await salvar.mutateAsync({ id: a.id, campos: {
        gargalo: gargalo || null, impacto_comprovado: num(comprovado), impacto_estimado: num(estimado), impacto_nota: notaImp,
        resumo, prioridades: prior.filter((p) => p.titulo.trim()), ...(gerar ? { status: "relatorio" as const } : {}),
      } });
      if (gerar && (cl.etapa === "dados" || cl.etapa === "analise")) await mover.mutateAsync({ cliente: cl.id, etapa: "revisao" });
      toast(gerar ? "Relatório gerado. O cliente foi para Relatório em revisão." : "Salvo");
      if (gerar) irRelatorio();
    } catch (e) { toast(mensagemErro(e), true); }
  }

  return (
    <>
      <div className="grid2">
        <div className="bloco">
          <h2>Impacto financeiro</h2><p className="sub">Comprovado e estimado ficam sempre separados no relatório</p>
          <div className="form">
            <label className="campo" htmlFor="comprovado">Comprovado (R$)<input id="comprovado" inputMode="numeric" value={comprovado} onChange={(e) => setComprovado(e.target.value)} /></label>
            <label className="campo" htmlFor="estimado">Estimado (R$)<input id="estimado" inputMode="numeric" value={estimado} onChange={(e) => setEstimado(e.target.value)} /></label>
          </div>
          <label className="campo" htmlFor="nota-imp" style={{ marginTop: 12 }}>Como o estimado foi calculado<textarea id="nota-imp" value={notaImp} onChange={(e) => setNotaImp(e.target.value)} /></label>
        </div>
        <div className="bloco">
          <h2>Gargalo e resumo</h2><p className="sub">Sugestão: a área com a menor nota{menor ? ` (${nomeArea(menor)})` : ""}</p>
          <label className="campo" htmlFor="gargalo">Principal gargalo
            <select id="gargalo" value={gargalo} onChange={(e) => setGargalo(e.target.value)}><option value="">Escolha</option>{AREAS.map((x) => <option key={x.k} value={x.k}>{x.nome}{notas.find((n) => n.area === x.k)?.nota != null ? ` (${notas.find((n) => n.area === x.k)!.nota})` : ""}</option>)}</select>
          </label>
          <label className="campo" htmlFor="resumo" style={{ marginTop: 12 }}>Resumo para o escritório<textarea id="resumo" style={{ minHeight: 110 }} value={resumo} onChange={(e) => setResumo(e.target.value)} /></label>
        </div>
      </div>
      <div className="bloco">
        <h2>Três prioridades para começar</h2><p className="sub">Vêm das três menores notas; reescreva com a realidade do escritório. Sem citar produtos da Convertea.</p>
        <div className="grid3p">
          {prior.slice(0, 3).map((p, i) => (
            <Fragment key={i}>
              <div className="campo" style={{ gap: 8 }}>
                <label htmlFor={`pt-${i}`}>Prioridade {i + 1}</label>
                <input id={`pt-${i}`} value={p.titulo} onChange={(e) => setPrior(prior.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} />
                <textarea aria-label={`Texto da prioridade ${i + 1}`} value={p.texto} onChange={(e) => setPrior(prior.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} />
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="acoes">
        <button className="btn" disabled={salvar.isPending} onClick={() => gravar(false)}>Salvar rascunho</button>
        <button className="btn pri" disabled={salvar.isPending || faltam > 0 || !gargalo} onClick={() => gravar(true)}>Gerar relatório →</button>
        {faltam > 0 && <span className="sub" style={{ margin: 0 }}>Faltam {faltam} notas para gerar o relatório.</span>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- 5. revisão e entrega
export const ITENS_REVISAO = [
  "Números conferidos com a planilha do escritório",
  "Nomes de clientes do escritório retirados dos exemplos",
  "Comprovado e estimado com rótulos diferentes",
  "Nenhuma promessa de resultado e nenhuma oferta de produto no texto (OAB)",
  "Revisado por quem não fez a análise",
];

function Revisao({ cl, a, feitas }: { cl: Cliente; a: Analise; feitas: number }) {
  const toast = useToast();
  const eu = useEu();
  const salvar = useAtualizarAnalise();
  const mover = useMoverEtapa();
  const [marcados, setMarcados] = useState<number[]>(a.revisao ?? []);
  const marcar = (i: number, on: boolean) => {
    const novo = on ? [...new Set([...marcados, i])] : marcados.filter((x) => x !== i);
    setMarcados(novo);
    salvar.mutate({ id: a.id, campos: { revisao: novo, revisado_por: eu.data?.nome ?? null } }, { onError: (e) => toast(mensagemErro(e), true) });
  };
  const pronto = marcados.length === ITENS_REVISAO.length;
  if (a.status === "dados" || a.status === "notas")
    return <div className="aviso">O relatório é gerado no passo 4, depois das 8 notas ({feitas} de 8 lançadas).</div>;
  return (
    <div className="grid2">
      <div className="bloco">
        <h2>Relatório</h2>
        <p className="sub">{a.status === "entregue" ? `Entregue em ${a.entregue_em?.split("-").reverse().join("/")}` : "Abra, confira e salve em PDF pelo navegador."}</p>
        <Link className="btn pri" to={`/relatorio/${a.id}`} target="_blank">Abrir relatório ↗</Link>
        <p className="sub" style={{ marginTop: 12 }}>Para mudar textos, volte ao passo 4 e gere de novo; as notas e evidências ficam salvas.</p>
      </div>
      <div className="bloco">
        <h2>Revisão</h2><p className="sub">Só dá para entregar com tudo marcado</p>
        <ul className="check">
          {ITENS_REVISAO.map((t, i) => (
            <li key={i}><label><input type="checkbox" id={`rev-${i}`} disabled={a.status === "entregue"} checked={marcados.includes(i)}
              onChange={(e) => marcar(i, e.target.checked)} /> {t}</label></li>
          ))}
        </ul>
        {a.status !== "entregue" && (
          <button className="btn pri" style={{ marginTop: 16 }} disabled={!pronto} onClick={async () => {
            try {
              await salvar.mutateAsync({ id: a.id, campos: { status: "entregue", entregue_em: new Date().toLocaleDateString("sv-SE") } });
              if (cl.etapa === "revisao") await mover.mutateAsync({ cliente: cl.id, etapa: "entregue" });
              toast("Relatório entregue. Próximo passo: oferecer a implementação.");
            } catch (e) { toast(mensagemErro(e), true); }
          }}>Marcar como entregue</button>
        )}
      </div>
    </div>
  );
}
