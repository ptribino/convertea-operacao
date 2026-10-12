import { useState } from "react";
import { Link } from "react-router-dom";
import { useClientes } from "../lib/api";
import { ETAPAS, FASES, etapa, type Fase } from "../lib/etapas";
import type { Cliente } from "../lib/types";
import { PrazoChip, dataCurta, hoje } from "../components/ui";
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
  const [modo, setModo] = useState(() => lerPref("op-modo", "quadro"));
  const [fase, setFase] = useState<Fase>(() => lerPref("op-fase", "venda") as Fase);
  const mudarModo = (m: string) => { setModo(m); gravarPref("op-modo", m); };
  const mudarFase = (f: Fase) => { setFase(f); gravarPref("op-fase", f); };

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
      <div className="vista">
        <div className="seg" role="tablist" aria-label="Forma de ver">
          <button role="tab" aria-selected={modo === "quadro"} onClick={() => mudarModo("quadro")}>Quadro</button>
          <button role="tab" aria-selected={modo === "lista"} onClick={() => mudarModo("lista")}>Lista do dia</button>
        </div>
        {modo === "quadro" && (
          <div className="fases" role="tablist" aria-label="Fase">
            {FASES.map((fa) => {
              const cs = lista.filter((c) => etapa(c.etapa).fase === fa.k);
              const atras = cs.filter((c) => c.proxima_data && c.proxima_data <= hoje() && c.etapa !== "perdido").length;
              return (
                <button key={fa.k} role="tab" aria-selected={fase === fa.k} onClick={() => mudarFase(fa.k)}>
                  {fa.nome} <span className="num">{cs.length}</span>
                  {atras ? <span className="chip atraso">{atras} p/ hoje</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {modo === "quadro" ? (() => {
        const cols = ETAPAS.filter((e) => e.fase === fase);
        return (
          <div className="board-wrap" tabIndex={0} aria-label="Quadro da fase">
            <div className="grade" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(200px, 1fr))` }}>
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
          </div>
        );
      })() : (
        <div className="bloco" style={{ marginTop: 16, padding: 0 }}>
          <div className="tbl-wrap">
            <table className="lista">
              <thead><tr><th>Quando</th><th>Escritório</th><th>Próxima ação</th><th>Etapa</th><th>Responsável</th></tr></thead>
              <tbody>
                {[...lista].sort((a, b) => {
                  const pa = a.etapa === "perdido" ? 1 : 0, pb = b.etapa === "perdido" ? 1 : 0;
                  if (pa !== pb) return pa - pb;
                  return (a.proxima_data ?? "9999").localeCompare(b.proxima_data ?? "9999");
                }).map((c) => (
                  <tr key={c.id}>
                    <td className="num">{c.etapa === "perdido" ? <span className="chip">{dataCurta(c.proxima_data)}</span> : <PrazoChip c={c} />}</td>
                    <td><Link to={`/clientes/${c.id}`}><b>{c.escritorio}</b></Link>{c.teste && <span className="chip" style={{ marginLeft: 6 }}>teste</span>}</td>
                    <td>{c.etapa === "perdido" ? `Motivo: ${c.motivo_perda}` : c.proxima_acao}</td>
                    <td>{etapa(c.etapa).nome}</td>
                    <td><span className="chip v">{c.responsavel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
