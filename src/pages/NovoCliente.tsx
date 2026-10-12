import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNovoCliente } from "../lib/api";
import { hoje, useToast } from "../components/ui";
import { mensagemErro } from "../lib/supabase";

// Para quem chega por indicação, WhatsApp ou evento. Quem vem do site entra sozinho.
export default function NovoCliente() {
  const novo = useNovoCliente();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ escritorio: "", contato_nome: "", whatsapp: "", email: "", cidade: "", area: "", responsavel: "Mateus", temperatura: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      const c = await novo.mutateAsync({
        ...f, responsavel: f.responsavel as "Pri" | "Mateus",
        email: f.email || null, temperatura: f.temperatura || null,
        proxima_acao: "Primeiro contato pelo WhatsApp", proxima_data: hoje(),
      });
      toast("Cliente cadastrado");
      nav(`/clientes/${c.id}`);
    } catch (er) { toast(mensagemErro(er), true); }
  }

  return (
    <>
      <Link to="/" className="voltar">← Funil</Link>
      <h1>Novo cliente</h1>
      <p className="lead">Para escritórios que chegaram por indicação, WhatsApp ou evento. Quem responde o pré-diagnóstico do site entra no funil sozinho.</p>
      <form className="bloco" style={{ marginTop: 20, maxWidth: 820 }} onSubmit={salvar}>
        <div className="form">
          <label className="campo" htmlFor="escritorio">Escritório *<input id="escritorio" required value={f.escritorio} onChange={set("escritorio")} /></label>
          <label className="campo" htmlFor="contato">Contato<input id="contato" value={f.contato_nome} onChange={set("contato_nome")} /></label>
          <label className="campo" htmlFor="whatsapp">WhatsApp<input id="whatsapp" inputMode="tel" placeholder="(48) 99999-9999" value={f.whatsapp} onChange={set("whatsapp")} /></label>
          <label className="campo" htmlFor="email">E-mail<input id="email" type="email" value={f.email} onChange={set("email")} /></label>
          <label className="campo" htmlFor="cidade">Cidade<input id="cidade" value={f.cidade} onChange={set("cidade")} /></label>
          <label className="campo" htmlFor="area">Área principal<input id="area" value={f.area} onChange={set("area")} /></label>
          <label className="campo" htmlFor="responsavel">Responsável<select id="responsavel" value={f.responsavel} onChange={set("responsavel")}><option>Mateus</option><option>Pri</option></select></label>
          <label className="campo" htmlFor="temperatura">Temperatura<select id="temperatura" value={f.temperatura} onChange={set("temperatura")}><option value="">Não definida</option><option>Quente</option><option>Morno</option><option>Frio</option></select></label>
        </div>
        <p className="sub" style={{ marginTop: 14 }}>O WhatsApp e o e-mail servem para ligar automaticamente o questionário quando o escritório responder.</p>
        <button className="btn pri" disabled={novo.isPending}>Cadastrar no pré-diagnóstico</button>
      </form>
    </>
  );
}
