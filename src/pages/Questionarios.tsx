import { useState } from "react";
import { useClientes, useEu, useQuestionariosSemCliente, useVincularQuestionario } from "../lib/api";
import { dataHora, useToast } from "../components/ui";
import { mensagemErro } from "../lib/supabase";

// Respostas que chegaram do site sem WhatsApp/e-mail igual ao de um cliente.
export default function Questionarios() {
  const soltos = useQuestionariosSemCliente();
  const clientes = useClientes();
  const eu = useEu();
  const vincular = useVincularQuestionario();
  const toast = useToast();
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const candidatos = (clientes.data ?? []).filter((c) => !c.diagnostico_id && c.etapa !== "perdido");

  return (
    <>
      <div className="eyebrow">Questionários do diagnóstico</div>
      <h1 style={{ marginTop: 4 }}>Respostas sem cliente vinculado</h1>
      <p className="lead">O sistema liga cada resposta ao cliente pelo WhatsApp ou e-mail. As que não bateram ficam aqui para você vincular. Se o cliente já pagou, ele avança para Questionário respondido.</p>
      <div className="painel">
        {soltos.isLoading && <p className="sub">Carregando…</p>}
        {soltos.error && <div className="erro">{mensagemErro(soltos.error)}</div>}
        {soltos.data && !soltos.data.length && <div className="aviso">Nenhuma resposta pendente. Todas estão ligadas a um cliente.</div>}
        {soltos.data?.map((d) => (
          <div className="bloco" key={d.id}>
            <h2>{d.escritorio}</h2>
            <p className="sub">{d.nome} · {d.whatsapp} · {d.email} · respondido em {dataHora(d.criado_em)}</p>
            <form className="linha" onSubmit={async (e) => {
              e.preventDefault();
              const c = candidatos.find((x) => x.id === escolha[d.id]); if (!c) return;
              try { await vincular.mutateAsync({ cliente: c, diagnostico: d.id, autor: eu.data?.nome ?? "Equipe" }); toast(`Vinculado a ${c.escritorio}`); }
              catch (er) { toast(mensagemErro(er), true); }
            }}>
              <label className="campo" htmlFor={`v-${d.id}`}>Vincular a
                <select id={`v-${d.id}`} value={escolha[d.id] ?? ""} onChange={(e) => setEscolha({ ...escolha, [d.id]: e.target.value })}>
                  <option value="">Escolha o cliente</option>
                  {candidatos.map((c) => <option key={c.id} value={c.id}>{c.escritorio}{c.teste ? " (teste)" : ""}</option>)}
                </select>
              </label>
              <button className="btn pri" disabled={!escolha[d.id] || vincular.isPending}>Vincular</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
