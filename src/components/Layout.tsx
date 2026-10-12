import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEu, useQuestionariosSemCliente } from "../lib/api";

function lerTema() {
  try { return localStorage.getItem("op-tema") ?? "auto"; } catch { return "auto"; }
}
function aplicarTema(t: string) {
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
  try { localStorage.setItem("op-tema", t); } catch { /* sem armazenamento: vale só nesta visita */ }
}

export function SeletorTema() {
  const [tema, setTema] = useState(lerTema);
  return (
    <select className="tema" aria-label="Tema" value={tema} onChange={(e) => { setTema(e.target.value); aplicarTema(e.target.value); }}>
      <option value="auto">Tema automático</option>
      <option value="light">Tema claro</option>
      <option value="dark">Tema escuro</option>
    </select>
  );
}

export default function Layout() {
  const eu = useEu();
  const soltos = useQuestionariosSemCliente();
  const n = soltos.data?.length ?? 0;

  if (eu.data && !eu.data.nome)
    return (
      <div className="login"><div className="bloco">
        <h2>Acesso restrito</h2>
        <p className="sub">O e-mail {eu.data.email} não está na equipe da Convertea. Peça para a Pri incluir você na tabela equipe.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div></div>
    );

  return (
    <>
      <header className="top"><div className="top-in">
        <Link to="/" className="marca">convert<span>ea</span><small>Operação</small></Link>
        <nav aria-label="Seções">
          <NavLink to="/" end>Funil</NavLink>
          <NavLink to="/questionarios">Questionários{n ? ` (${n})` : ""}</NavLink>
          <NavLink to="/painel">Painel</NavLink>
        </nav>
        <div className="quem"><SeletorTema /><span>{eu.data?.nome}</span><button className="btn peq" onClick={() => supabase.auth.signOut()}>Sair</button></div>
      </div></header>
      <main><Outlet /></main>
    </>
  );
}
