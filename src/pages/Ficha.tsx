import { Fragment, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAtualizarCliente, useCliente, useConfirmarPagamento, useDiagnostico, useEu, useInteracoes,
  useMoverEtapa, useNovaNota, useNovaProposta, usePreDiagnostico, usePropostas,
} from "../lib/api";
import { ETAPAS, FLUXO, MOTIVOS_PERDA, etapa, jaPagou, proximaEtapa } from "../lib/etapas";
import type { Cliente } from "../lib/types";
import { PrazoChip, brl, dataCurta, dataHora, hoje, useToast } from "../components/ui";
import { mensagemErro } from "../lib/supabase";
import Diagnostico from "./Diagnostico";

const FASE_NOME = { venda: "Venda", diag: "Diagnóstico", pos: "Pós-venda" } as const;

// Perguntas do questionário do site (public/diagnostico/index.html no repositório convertea)
const QPARTES: [string, [string, string][]][] = [
  ["O seu escritório", [["areas", "Áreas de atuação"], ["area_outra", "Outra área"], ["servicos", "Principais serviços"], ["cobranca", "Cobrança dos honorários"], ["ticket", "Quanto rende cada cliente"], ["pessoas", "Pessoas no 1º atendimento"], ["quem", "Quem faz o 1º atendimento"], ["gestor", "Alguém acompanha resultados"]]],
  ["De onde vêm os clientes", [["canais", "Canais"], ["canal_principal", "Canal principal"], ["volume", "Contatos novos por mês"], ["investimento", "Investimento mensal em anúncios"], ["origem", "Sabem a origem de cada contato"]]],
  ["Como o atendimento funciona", [["processo", "Passo a passo definido"], ["roteiro", "Segue roteiro"], ["qualificacao", "Verifica perfil antes da consulta"], ["followup", "Rotina para retomar quem parou"], ["registro", "Onde registra os contatos"], ["crm_nome", "Qual sistema"], ["tempo_resposta", "Tempo de resposta"], ["conversao", "De cada 10, viram clientes"], ["perdido", "Quando consideram perdido"]]],
  ["Onde acham que perdem", [["perda", "Onde mais perdem"], ["expectativa", "O que querem descobrir"]]],
];
const PRE_CAMPOS: [string, string][] = [["area", "Área"], ["volume", "Contatos por mês"], ["ticket", "Valor por contrato"], ["tempo_resposta", "Tempo de resposta"], ["conversao", "Fecham de cada 10"], ["dificuldade", "Principal dificuldade"], ["temperatura", "Temperatura"]];

const txt = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "" : String(v));

type Aba = "resumo" | "pre" | "quest" | "diag" | "ops" | "pos";
const ABAS: { k: Aba; n: string; fase?: string }[] = [
  { k: "resumo", n: "Resumo" }, { k: "pre", n: "Pré-diagnóstico" }, { k: "quest", n: "Questionário" },
  { k: "diag", n: "Diagnóstico e relatório" },
  { k: "ops", n: "Oportunidades", fase: "em breve" }, { k: "pos", n: "Pós-venda", fase: "em breve" },
];

export default function Ficha() {
  const { id = "" } = useParams();
  const c = useCliente(id);
  const [aba, setAba] = useState<Aba>(() => {
    try { const v = sessionStorage.getItem("op-aba-" + id); if (v) return v as Aba; } catch { /* ignora */ }
    return "resumo";
  });
  const trocarAba = (k: Aba) => { setAba(k); try { sessionStorage.setItem("op-aba-" + id, k); } catch { /* ignora */ } };
  if (c.isLoading) return <p className="sub">Carregando…</p>;
  if (c.error || !c.data) return <div className="erro">{c.error ? mensagemErro(c.error) : "Cliente não encontrado."}</div>;
  const cl = c.data;
  const e = etapa(cl.etapa);
  const i = FLUXO.indexOf(cl.etapa);

  return (
    <>
      <Link to="/" className="voltar">← Funil</Link>
      <div className="ficha-top">
        <div>
          <div className="eyebrow">{FASE_NOME[e.fase]} · {e.nome}{cl.teste ? " · cliente de teste" : ""}</div>
          <h1 style={{ marginTop: 4 }}>{cl.escritorio}</h1>
          <p className="lead">{[cl.contato_nome, cl.cidade, cl.area].filter(Boolean).join(" · ")} · responsável: {cl.responsavel}</p>
        </div>
        <Acoes cl={cl} />
      </div>
      {cl.etapa !== "perdido" && (
        <>
          <div className="trilho" aria-label={`Etapa ${i + 1} de ${FLUXO.length}`}>
            {FLUXO.map((k, j) => <i key={k} title={etapa(k).nome} className={j < i ? "feito" : j === i ? "agora" : ""} />)}
          </div>
          <div className="trilho-leg"><span>Venda</span><span>Diagnóstico</span><span>Pós-venda</span></div>
        </>
      )}
      <div className="tabs" role="tablist">
        {ABAS.map((a) => (
          <button key={a.k} role="tab" id={`aba-${a.k}`} aria-selected={aba === a.k} onClick={() => trocarAba(a.k)}>
            {a.n}{a.fase ? <span className="chip" style={{ marginLeft: 6 }}>{a.fase}</span> : null}
          </button>
        ))}
      </div>
      <div className="painel" role="tabpanel">
        {aba === "resumo" && <Resumo key={cl.atualizado_em} cl={cl} />}
        {aba === "pre" && <PreDiag cl={cl} />}
        {aba === "quest" && <Questionario cl={cl} />}
        {aba === "diag" && <Diagnostico cl={cl} />}
        {ABAS.find((a) => a.k === aba)?.fase && (
          <div className="aviso">Esta parte ainda vai ser construída, conforme o documento de produto. O protótipo mostra como ela vai funcionar.</div>
        )}
      </div>
    </>
  );
}

function Acoes({ cl }: { cl: Cliente }) {
  const toast = useToast();
  const mover = useMoverEtapa();
  const pagar = useConfirmarPagamento();
  const props = usePropostas(cl.id);
  const [modo, setModo] = useState<"" | "perda" | "pagamento" | "mover">("");
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [dataPag, setDataPag] = useState(hoje());
  const [destino, setDestino] = useState("");
  const prox = proximaEtapa(cl.etapa);
  const aberta = props.data?.find((p) => !p.pago_em && p.status !== "recusada");

  const rodar = async (f: () => Promise<unknown>, ok: string) => {
    try { await f(); toast(ok); setModo(""); } catch (e) { toast(mensagemErro(e), true); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, maxWidth: "100%" }}>
      <div className="acoes">
        {cl.etapa === "perdido" ? (
          <button className="btn" onClick={() => rodar(() => mover.mutateAsync({ cliente: cl.id, etapa: props.data?.length ? "proposta" : "conversa" }), "Cliente reaberto")}>Reabrir</button>
        ) : cl.etapa === "proposta" ? (
          <button className="btn pri" onClick={() => setModo("pagamento")}>Confirmar pagamento →</button>
        ) : prox ? (
          <button className="btn pri" disabled={mover.isPending} onClick={() => rodar(() => mover.mutateAsync({ cliente: cl.id, etapa: prox }), "Movido para " + etapa(prox).nome)}>
            Avançar para {etapa(prox).nome} →
          </button>
        ) : null}
        {["pre", "conversa", "proposta"].includes(cl.etapa) && <button className="btn perigo" onClick={() => setModo("perda")}>Marcar como perdido</button>}
        <button className="btn peq" onClick={() => setModo(modo === "mover" ? "" : "mover")}>Corrigir etapa</button>
      </div>

      {modo === "perda" && (
        <form className="caixa perigo" onSubmit={(e) => { e.preventDefault(); rodar(() => mover.mutateAsync({ cliente: cl.id, etapa: "perdido", motivo: detalhe ? `${motivo}: ${detalhe}` : motivo }), "Marcado como perdido"); }}>
          <label className="campo" htmlFor="motivo">Motivo da perda (obrigatório)
            <select id="motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Escolha</option>{MOTIVOS_PERDA.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label className="campo" htmlFor="motivo-detalhe">Detalhe (opcional)<input id="motivo-detalhe" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} /></label>
          <div className="acoes"><button className="btn perigo">Confirmar perda</button><button type="button" className="btn" onClick={() => setModo("")}>Cancelar</button></div>
        </form>
      )}

      {modo === "pagamento" && (
        <div className="caixa">
          {aberta ? (
            <>
              <span>Proposta de {brl(Number(aberta.valor))} enviada em {dataCurta(aberta.enviada_em)}</span>
              <label className="campo" htmlFor="data-pag">Data do pagamento<input id="data-pag" type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} /></label>
              <div className="acoes">
                <button className="btn pri" onClick={() => rodar(() => pagar.mutateAsync({ proposta: aberta.id, data: dataPag }), "Pagamento confirmado. Envie o link do questionário.")}>Confirmar</button>
                <button className="btn" onClick={() => setModo("")}>Cancelar</button>
              </div>
            </>
          ) : <span>Registre a proposta na aba Resumo antes de confirmar o pagamento.</span>}
        </div>
      )}

      {modo === "mover" && (
        <form className="caixa" onSubmit={(e) => { e.preventDefault(); if (destino) rodar(() => mover.mutateAsync({ cliente: cl.id, etapa: destino }), "Etapa corrigida"); }}>
          <label className="campo" htmlFor="destino">Mover para
            <select id="destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Escolha a etapa</option>
              {ETAPAS.filter((x) => x.k !== "perdido" && x.k !== cl.etapa).map((x) => <option key={x.k} value={x.k}>{x.nome}</option>)}
            </select>
          </label>
          <span className="sub" style={{ margin: 0 }}>Etapas do diagnóstico em diante exigem pagamento confirmado. A mudança fica no histórico.</span>
          <div className="acoes"><button className="btn pri" disabled={!destino}>Mover</button><button type="button" className="btn" onClick={() => setModo("")}>Cancelar</button></div>
        </form>
      )}
    </div>
  );
}

function Resumo({ cl }: { cl: Cliente }) {
  const toast = useToast();
  const eu = useEu();
  const autor = eu.data?.nome ?? "Equipe";
  const atualizar = useAtualizarCliente();
  const nota = useNovaNota();
  const novaProp = useNovaProposta();
  const hist = useInteracoes(cl.id);
  const props = usePropostas(cl.id);
  const [acao, setAcao] = useState(cl.proxima_acao ?? "");
  const [data, setData] = useState(cl.proxima_data ?? "");
  const [resp, setResp] = useState(cl.responsavel);
  const [texto, setTexto] = useState("");
  const [valor, setValor] = useState("");
  const [enviada, setEnviada] = useState(hoje());
  const [editando, setEditando] = useState(false);
  const [dados, setDados] = useState({ contato_nome: cl.contato_nome ?? "", whatsapp: cl.whatsapp ?? "", email: cl.email ?? "", cidade: cl.cidade ?? "", area: cl.area ?? "" });

  const salvarAcao = async (e: FormEvent) => {
    e.preventDefault();
    try { await atualizar.mutateAsync({ id: cl.id, campos: { proxima_acao: acao, proxima_data: data || null, responsavel: resp } }); toast("Próxima ação salva"); }
    catch (er) { toast(mensagemErro(er), true); }
  };

  return (
    <>
      <div className="grid2">
        <form className="bloco" onSubmit={salvarAcao}>
          <h2>Próxima ação</h2>
          <p className="sub">Padrão da etapa já vem preenchido quando o cliente muda de etapa.</p>
          <div className="chips" style={{ marginBottom: 12 }}><PrazoChip c={cl} />{cl.motivo_perda && <span className="chip atraso">Perdido: {cl.motivo_perda}</span>}</div>
          <div className="form">
            <label className="campo" htmlFor="acao">O que fazer<input id="acao" value={acao} onChange={(e) => setAcao(e.target.value)} /></label>
            <label className="campo" htmlFor="data">Quando<input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <label className="campo" htmlFor="resp">Responsável<select id="resp" value={resp} onChange={(e) => setResp(e.target.value as Cliente["responsavel"])}><option>Mateus</option><option>Pri</option></select></label>
          </div>
          <button className="btn pri" style={{ marginTop: 14 }} disabled={atualizar.isPending}>Salvar</button>
        </form>

        <div className="bloco">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><h2>Escritório</h2><button className="btn peq" onClick={() => setEditando(!editando)}>{editando ? "Cancelar" : "Editar"}</button></div>
          {editando ? (
            <form className="form" style={{ marginTop: 12 }} onSubmit={async (e) => { e.preventDefault(); try { await atualizar.mutateAsync({ id: cl.id, campos: dados }); setEditando(false); toast("Dados salvos"); } catch (er) { toast(mensagemErro(er), true); } }}>
              {(Object.keys(dados) as (keyof typeof dados)[]).map((k) => (
                <label key={k} className="campo" htmlFor={`d-${k}`}>{({ contato_nome: "Contato", whatsapp: "WhatsApp", email: "E-mail", cidade: "Cidade", area: "Área" })[k]}
                  <input id={`d-${k}`} value={dados[k]} onChange={(e) => setDados({ ...dados, [k]: e.target.value })} /></label>
              ))}
              <button className="btn pri">Salvar dados</button>
            </form>
          ) : (
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Contato</dt><dd>{cl.contato_nome || "—"}</dd>
              <dt>WhatsApp</dt><dd>{cl.whatsapp || "—"}</dd>
              <dt>E-mail</dt><dd>{cl.email || "—"}</dd>
              <dt>Cidade</dt><dd>{cl.cidade || "—"}</dd>
              <dt>Área</dt><dd>{cl.area || "—"}</dd>
              <dt>No sistema desde</dt><dd>{dataCurta(cl.criado_em.slice(0, 10))}</dd>
            </dl>
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="bloco">
          <h2>Proposta do diagnóstico</h2>
          <p className="sub">O questionário só é liberado depois do pagamento confirmado.</p>
          {props.data?.length ? (
            <div className="tbl-wrap"><table className="num"><thead><tr><th>Valor</th><th>Enviada</th><th>Status</th><th>Pago em</th></tr></thead>
              <tbody>{props.data.map((p) => <tr key={p.id}><td>{brl(Number(p.valor))}</td><td>{dataCurta(p.enviada_em)}</td><td>{p.status}</td><td>{p.pago_em ? dataCurta(p.pago_em) : "—"}</td></tr>)}</tbody></table></div>
          ) : <p className="sub">Nenhuma proposta registrada.</p>}
          {!jaPagou(cl.etapa) && cl.etapa !== "perdido" && (
            <form className="linha" style={{ marginTop: 12 }} onSubmit={async (e) => {
              e.preventDefault();
              try { await novaProp.mutateAsync({ cliente: cl.id, autor, valor: Number(valor.replace(/\./g, "").replace(",", ".")), enviada_em: enviada }); setValor(""); toast("Proposta registrada"); }
              catch (er) { toast(mensagemErro(er), true); }
            }}>
              <label className="campo" htmlFor="valor">Valor (R$)<input id="valor" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="3.900" /></label>
              <label className="campo" htmlFor="enviada">Enviada em<input id="enviada" type="date" value={enviada} onChange={(e) => setEnviada(e.target.value)} /></label>
              <button className="btn">Registrar proposta</button>
            </form>
          )}
          {cl.etapa !== "proposta" && !jaPagou(cl.etapa) && props.data?.length ? <p className="sub" style={{ marginTop: 10 }}>Mova o cliente para "Proposta enviada" para acompanhar a retomada.</p> : null}
        </div>

        <div className="bloco">
          <h2>Histórico</h2>
          <form className="linha" style={{ margin: "10px 0 16px" }} onSubmit={async (e) => {
            e.preventDefault(); if (!texto.trim()) return;
            try { await nota.mutateAsync({ cliente: cl.id, autor, texto: texto.trim() }); setTexto(""); } catch (er) { toast(mensagemErro(er), true); }
          }}>
            <label className="campo" htmlFor="nota" style={{ flex: "1 1 260px" }}>Registrar conversa ou nota<input id="nota" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: falei com a sócia, pediu proposta até sexta" /></label>
            <button className="btn">Registrar</button>
          </form>
          <ol className="hist">
            {hist.data?.map((h) => (
              <li key={h.id}><time className="num">{dataHora(h.criado_em)}</time><span>{h.texto} <small>· {h.autor}</small></span></li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

function PreDiag({ cl }: { cl: Cliente }) {
  const p = usePreDiagnostico(cl.pre_diagnostico_id);
  if (!cl.pre_diagnostico_id) return <div className="aviso">Este cliente não veio do pré-diagnóstico do site.</div>;
  if (p.isLoading) return <p className="sub">Carregando…</p>;
  if (p.error || !p.data) return <div className="erro">{mensagemErro(p.error)}</div>;
  return (
    <div className="bloco"><h2>Pré-diagnóstico do site</h2><p className="sub">O que o escritório informou antes da conversa</p>
      <dl className="kv">{PRE_CAMPOS.filter(([k]) => txt(p.data[k])).map(([k, n]) => <Fragment key={k}><dt>{n}</dt><dd>{txt(p.data[k])}</dd></Fragment>)}</dl>
    </div>
  );
}

function Questionario({ cl }: { cl: Cliente }) {
  const d = useDiagnostico(cl.diagnostico_id);
  if (!jaPagou(cl.etapa)) return <div className="aviso">O questionário é liberado depois do pagamento.</div>;
  if (!cl.diagnostico_id)
    return <div className="aviso">Ainda não chegou resposta. Quando o escritório responder pelo link do site, ela entra aqui sozinha (se o WhatsApp ou o e-mail baterem). Se não bater, vincule em Questionários.</div>;
  if (d.isLoading) return <p className="sub">Carregando…</p>;
  if (d.error || !d.data) return <div className="erro">{mensagemErro(d.error)}</div>;
  const r = d.data.respostas ?? {};
  return (
    <>
      <p className="sub" style={{ margin: 0 }}>Respondido em {dataHora(d.data.criado_em)} por {d.data.nome}</p>
      <div className="grid2">
        {QPARTES.map(([titulo, qs], idx) => (
          <div className="bloco" key={titulo}>
            <div className="eyebrow">Parte {idx + 1} de 4</div><h2 style={{ marginTop: 2 }}>{titulo}</h2>
            <dl className="kv" style={{ marginTop: 12 }}>{qs.filter(([k]) => txt(r[k])).map(([k, n]) => <Fragment key={k}><dt>{n}</dt><dd>{txt(r[k])}</dd></Fragment>)}</dl>
          </div>
        ))}
      </div>
    </>
  );
}
