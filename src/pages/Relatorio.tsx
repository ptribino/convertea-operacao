import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useCliente } from "../lib/api";
import { useAnalise, useEvidencias, useLeads, useNotas } from "../lib/apiDiagnostico";
import { AREAS, calcular } from "../lib/diagnostico";
import { brl } from "../components/ui";
import { mensagemErro } from "../lib/supabase";
import { Funil } from "./Diagnostico";

// Relatório do diagnóstico, na estrutura do slide 9 da metodologia. Salvo em PDF pelo navegador.
export default function Relatorio() {
  const { id = "" } = useParams();
  const a = useAnalise(id);
  const cl = useCliente(a.data?.cliente_id ?? "");
  const leads = useLeads(a.data?.id);
  const notas = useNotas(a.data?.id);
  const evid = useEvidencias(a.data?.id);
  const c = useMemo(() => (leads.data ? calcular(leads.data) : null), [leads.data]);

  if (a.error) return <div className="erro">{mensagemErro(a.error)}</div>;
  if (!a.data || !cl.data || !c || !notas.data || !evid.data) return <p className="sub">Montando o relatório…</p>;
  const A = a.data;
  const nomeArea = (k?: string | null) => AREAS.find((x) => x.k === k)?.nome ?? "";
  const notaDe = (k: string) => notas.data!.find((n) => n.area === k);
  const exemplo = evid.data.find((e) => e.area === A.gargalo) ?? evid.data[0];
  const diverge = (A.dxr ?? []).filter((l) => l.selo === "diverge");
  const conv = ((10 * c.fechados) / Math.max(1, c.total)).toFixed(1).replace(".", ",");

  return (
    <div className="rel-pagina">
      <div className="no-print acoes" style={{ marginBottom: 16 }}>
        <Link to={`/clientes/${A.cliente_id}`} className="btn">← Voltar à ficha</Link>
        <button className="btn pri" onClick={() => window.print()}>Salvar em PDF</button>
        <span className="sub" style={{ margin: 0 }}>Na janela de impressão, escolha "Salvar como PDF".</span>
      </div>
      <article className="rel">
        <header className="rel-capa">
          <div className="marca rel-marca">convert<span>ea</span></div>
          <div className="eyebrow" style={{ color: "var(--lime)", marginTop: 28 }}>Diagnóstico comercial</div>
          <h1>{cl.data.escritorio}</h1>
          <p>Período analisado: {A.periodo} · {c.total} contatos · {A.status === "entregue" ? `entregue em ${A.entregue_em?.split("-").reverse().join("/")}` : "versão para revisão"}</p>
        </header>

        <section className="rel-sec"><h2>1. Resumo</h2><p>{A.resumo}</p>
          <div className="rel-kpis num">
            <div><b>{conv}</b><span>de cada 10 contatos viraram contrato</span></div>
            <div><b>{c.tempoMediano} min</b><span>mediana da 1ª resposta</span></div>
            <div><b>{c.paradosProposta}</b><span>pessoas paradas após a proposta</span></div>
          </div>
        </section>

        <section className="rel-sec"><h2>2. O caminho dos contatos</h2><Funil funil={c.funil} /></section>

        <section className="rel-sec"><h2>3. Notas das áreas avaliadas</h2>
          <p className="sub">De 0 a 100. Cada nota se apoia em conversas reais do escritório.</p>
          <div className="rel-notas">
            {AREAS.map((ar) => {
              const n = notaDe(ar.k);
              const cor = n?.nota == null ? "var(--line)" : n.nota < 50 ? "var(--bad)" : n.nota < 60 ? "var(--warn)" : "var(--good)";
              return (
                <div key={ar.k} className={ar.k === A.gargalo ? "destaque" : ""}>
                  <span>{ar.nome}</span>
                  <span className="nb"><i style={{ width: `${n?.nota ?? 0}%`, background: cor }} /></span>
                  <b className="num">{n?.nao_se_aplica ? "n/a" : n?.nota ?? "—"}</b>
                  {n?.comentario && <small>{n.comentario}</small>}
                </div>
              );
            })}
          </div>
        </section>

        {diverge.length > 0 && (
          <section className="rel-sec"><h2>4. O que o escritório disse e o que os dados mostram</h2>
            <table><thead><tr><th>Tema</th><th>No questionário</th><th>Nos dados</th></tr></thead>
              <tbody>{diverge.map((l) => <tr key={l.tema}><td><b>{l.tema}</b></td><td>{l.declarado}</td><td>{l.real}{l.comentario ? <><br /><small>{l.comentario}</small></> : null}</td></tr>)}</tbody></table>
          </section>
        )}

        {exemplo && (
          <section className="rel-sec"><h2>5. Exemplo real, anonimizado</h2>
            <p className="sub">{nomeArea(exemplo.area)}{exemplo.comentario ? `: ${exemplo.comentario}` : ""}</p>
            <div className="zap">{exemplo.trecho.map((m, i) => <p key={i} className={m.autor === "Lead" ? "" : "at"}><small>{m.autor === "Lead" ? "Cliente" : "Atendimento"}</small>{m.mensagem}</p>)}</div>
          </section>
        )}

        <section className="rel-sec"><h2>6. Principal gargalo e impacto</h2>
          <p><span className="mark"><b>{nomeArea(A.gargalo)}</b>{notaDe(A.gargalo ?? "")?.nota != null ? `, nota ${notaDe(A.gargalo!)!.nota}` : ""}</span></p>
          <div className="rel-imp">
            <div><span className="rot comp">Comprovado</span><b className="num">{brl(Number(A.impacto_comprovado ?? 0))}</b><small>Honorários dos {c.fechados} contratos fechados no período.</small></div>
            <div><span className="rot est">Estimado</span><b className="num">{brl(Number(A.impacto_estimado ?? 0))}</b><small>{A.impacto_nota}</small></div>
          </div>
        </section>

        <section className="rel-sec"><h2>7. Três prioridades para começar</h2>
          <ol>{(A.prioridades ?? []).map((p, i) => <li key={i}><b>{p.titulo}.</b> {p.texto}</li>)}</ol>
        </section>

        <footer className="rel-rodape">Diagnóstico preparado pela Convertea com base nos dados enviados pelo escritório. Valores estimados indicam potencial, não garantia de resultado. Os contratos são sempre fechados pelo escritório.</footer>
      </article>
    </div>
  );
}
