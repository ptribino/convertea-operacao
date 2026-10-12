import { useState, type FormEvent } from "react";
import { supabase, mensagemErro } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"livre" | "enviando" | "enviado">("livre");
  const [erro, setErro] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEstado("enviando");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    if (error) { setErro(mensagemErro(error)); setEstado("livre"); }
    else setEstado("enviado");
  }

  return (
    <div className="login">
      <form className="bloco" onSubmit={enviar}>
        <div className="marca">convert<span>ea</span><small>Operação</small></div>
        {estado === "enviado" ? (
          <p className="lead">Enviamos um link de acesso para <b>{email}</b>. Abra o e-mail neste mesmo navegador.</p>
        ) : (
          <>
            <p className="lead">Sistema interno. Entre com o e-mail cadastrado na equipe; você recebe um link de acesso.</p>
            <label className="campo" htmlFor="email">E-mail
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {erro && <div className="erro">{erro}</div>}
            <button className="btn pri" disabled={estado === "enviando"}>{estado === "enviando" ? "Enviando…" : "Receber link de acesso"}</button>
          </>
        )}
      </form>
    </div>
  );
}
