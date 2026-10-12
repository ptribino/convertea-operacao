import { useState } from "react";
import { useClientes, usePropostas } from "../lib/api";
import { ETAPAS, FLUXO } from "../lib/etapas";
import { brl, hoje } from "../components/ui";
import { mensagemErro } from "../lib/supabase";

export default function Painel() {
  const cl = useClientes();
  const pr = usePropostas();
  const [teste, setTeste] = useState(false);
  if (cl.isLoading || pr.isLoading) return <p className="sub">Carregando…</p>;
  if (cl.error || pr.error) return <div className="erro">{mensagemErro(cl.error ?? pr.error)}</div>;

  const clientes = (cl.data ?? []).filter((c) => teste || !c.teste);
  const ids = new Set(clientes.map((c) => c.id));
  const propostas = (pr.data ?? []).filter((p) => ids.has(p.cliente_id));
  const pagas = propostas.filter((p) => p.pago_em);
  const receita = pagas.reduce((s, p) => s + Number(p.valor), 0);
  const atrasados = clientes.filter((c) => c.proxima_data && c.proxima_data < hoje() && c.etapa !== "perdido");
  const perdidos = clientes.filter((c) => c.etapa === "perdido");
  const emDiag = clientes.filter((c) => ETAPAS.find((e) => e.k === c.etapa)?.fase === "diag").length;
  const comProposta = new Set(propostas.map((p) => p.cliente_id));

  // Quantos escritórios chegaram a cada etapa de venda (perdidos contam até onde foram)
  const chegou = (k: string) => clientes.filter((c) => {
    if (c.etapa === "perdido") return k === "pre" || k === "conversa" || (k === "proposta" && comProposta.has(c.id));
    return FLUXO.indexOf(c.etapa) >= FLUXO.indexOf(k as never);
  }).length;
  const venda = [["Pré-diagnóstico", "pre"], ["Conversa", "conversa"], ["Proposta", "proposta"], ["Pago", "pago"]].map(([n, k]) => ({ n, v: chegou(k) }));
  const max = Math.max(1, venda[0].v);

  return (
    <>
      <div className="ficha-top">
        <div><div className="eyebrow">Painel Convertea</div><h1 style={{ marginTop: 4 }}>Os números da própria Convertea</h1></div>
        <label className="chk"><input type="checkbox" id="painel-teste" checked={teste} onChange={(e) => setTeste(e.target.checked)} /> Incluir clientes de teste</label>
      </div>
      <div className="grid4" style={{ marginTop: 22 }}>
        <div className="bloco"><div className="rot">Clientes pagantes</div><div className="big num">{new Set(pagas.map((p) => p.cliente_id)).size}</div><p className="sub">de {clientes.length} no ciclo</p></div>
        <div className="bloco"><div className="rot">Receita de diagnósticos</div><div className="big num">{brl(receita)}</div><p className="sub">propostas pagas</p></div>
        <div className="bloco"><div className="rot">Em diagnóstico agora</div><div className="big num">{emDiag}</div><p className="sub">do questionário ao relatório</p></div>
        <div className="bloco"><div className="rot">Ações atrasadas</div><div className="big num" style={{ color: atrasados.length ? "var(--bad)" : undefined }}>{atrasados.length}</div><p className="sub">{atrasados.map((c) => c.escritorio).join(", ") || "nenhuma"}</p></div>
      </div>
      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="bloco"><h2>Funil de venda</h2><p className="sub">Escritórios que chegaram a cada etapa, incluindo os perdidos</p>
          <div className="fun">{venda.map((s, i) => (
            <div className="fun-row" key={s.n}><span>{s.n}</span><div className="fun-bar"><i style={{ width: `${(100 * s.v) / max}%` }} /></div>
              <span className="q num"><b style={{ color: "var(--ink)" }}>{s.v}</b>{i ? ` · ${venda[i - 1].v ? Math.round((100 * s.v) / venda[i - 1].v) : 0}%` : ""}</span></div>
          ))}</div>
        </div>
        <div className="bloco"><h2>Vendas perdidas</h2><p className="sub">Motivo obrigatório ao marcar como perdido</p>
          {perdidos.length ? <div className="tbl-wrap"><table><tbody>{perdidos.map((c) => <tr key={c.id}><td><b>{c.escritorio}</b></td><td>{c.motivo_perda}</td></tr>)}</tbody></table></div> : <p className="sub">Nenhuma.</p>}
          <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>Por etapa agora</h3>
          <div className="tbl-wrap"><table className="num"><tbody>{ETAPAS.map((e) => <tr key={e.k}><td>{e.nome}</td><td style={{ textAlign: "right" }}><b>{clientes.filter((c) => c.etapa === e.k).length}</b></td></tr>)}</tbody></table></div>
        </div>
      </div>
    </>
  );
}
