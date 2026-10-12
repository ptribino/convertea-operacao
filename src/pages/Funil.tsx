import { useState } from "react";
import { Link } from "react-router-dom";
import { useClientes } from "../lib/api";
import { ETAPAS, FASES } from "../lib/etapas";
import type { Cliente } from "../lib/types";
import { PrazoChip, hoje } from "../components/ui";
import { mensagemErro } from "../lib/supabase";

function lerPref(k: string, padrao: string) {
  try { return localStorage.getItem(k) ?? padrao; } catch { return padrao; }
}
function gravarPref(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* sem armazenamento: ignora */ }
}

function Cartao({ c }: { c: Cliente }) {
  return (
    <Link to={`/clientes/${c.id}`} className="card">
      <b>{c.escritorio}</b>
      <span className="meta">{[c.cidade, c.area].filter(Boolean).join(" · ")}</span>
      <div className="chips">
        <span className="chip v">{c.responsavel}</span>
        {c.temperatura && <span className={"chip" + (c.temperatura === "Quente" ? " q" : "")}>{c.temperatura}</span>}
        {c.teste && <span className="chip">teste</span>}
        <PrazoChip c={c} />
      </div>
      <span className="prox">{c.etapa === "perdido" ? `Motivo: ${c.motivo_perda}` : c.proxima_acao}</span>
    </Link>
  );
}

export default function Funil() {
  const q = useClientes();
  const [teste, setTeste] = useState(() => lerPref("op-teste", "1") === "1");
  const [resp, setResp] = useState(() => lerPref("op-resp", ""));
  const [busca, setBusca] = useState("");

  if (q.isLoading) return <p className="sub">Carregando…</p>;
  if (q.error) return <div className="erro">{mensagemErro(q.error)}</div>;

  const todos = q.data ?? [];
  const lista = todos.filter((c) =>
    (teste || !c.teste) && (!resp || c.responsavel === resp) &&
    (!busca || c.escritorio.toLowerCase().includes(busca.toLowerCase())));
  const acao = lista.filter((c) => c.proxima_data && c.proxima_data <= hoje() && c.etapa !== "perdido");

  return (
    <>
      <div className="ficha-top">
        <div>
          <div className="eyebrow">Funil Convertea</div>
          <h1 style={{ marginTop: 4 }}>{lista.length} escritórios no ciclo</h1>
          <p className="lead">{acao.length ? <><b>{acao.length} precisam de ação hoje:</b> {acao.map((c) => c.escritorio).join(", ")}.</> : "Nenhuma ação vencida."}</p>
        </div>
        <Link to="/clientes/novo" className="btn pri">+ Novo cliente</Link>
      </div>
      <div className="filtros">
        <input type="search" id="busca" placeholder="Buscar escritório" aria-label="Buscar escritório" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select id="filtro-resp" aria-label="Responsável" value={resp} onChange={(e) => { setResp(e.target.value); gravarPref("op-resp", e.target.value); }} style={{ width: "auto" }}>
          <option value="">Todos os responsáveis</option><option>Pri</option><option>Mateus</option>
        </select>
        <label className="chk"><input type="checkbox" id="filtro-teste" checked={teste} onChange={(e) => { setTeste(e.target.checked); gravarPref("op-teste", e.target.checked ? "1" : "0"); }} /> Mostrar clientes de teste</label>
      </div>
      <div className="board-wrap" tabIndex={0} aria-label="Quadro do funil">
        <div className="board">
          {FASES.map((fa) => {
            const cols = ETAPAS.filter((e) => e.fase === fa.k);
            const n = lista.filter((c) => cols.some((e) => e.k === c.etapa)).length;
            return (
              <section className="fase" key={fa.k}>
                <div className="fase-nome">{fa.nome}<em>{fa.desc} · {n}</em></div>
                <div className="cols">
                  {cols.map((e) => {
                    const cs = lista.filter((c) => c.etapa === e.k);
                    return (
                      <div className="col" key={e.k}>
                        <h3><span>{e.nome}</span><span className="num">{cs.length}</span></h3>
                        {cs.length ? cs.map((c) => <Cartao key={c.id} c={c} />) : <div className="vazio">Nenhum</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
