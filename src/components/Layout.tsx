import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEu, useQuestionariosSemCliente } from "../lib/api";

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
        <div className="quem"><span>{eu.data?.nome}</span><button className="btn peq" onClick={() => supabase.auth.signOut()}>Sair</button></div>
      </div></header>
      <main><Outlet /></main>
    </>
  );
}
