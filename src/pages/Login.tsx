import { useState, type FormEvent } from "react";
import { supabase, mensagemErro } from "../lib/supabase";

type Modo = "senha" | "link" | "esqueci";

// Entrada principal com e-mail e senha. O link por e-mail serve para o primeiro acesso e para quem esqueceu a senha.
export default function Login() {
  const [modo, setModo] = useState<Modo>("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<"livre" | "enviando" | "enviado">("livre");
  const [erro, setErro] = useState("");
  const em = () => email.trim().toLowerCase();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(""); setEstado("enviando");
    const r =
      modo === "senha" ? await supabase.auth.signInWithPassword({ email: em(), password: senha })
      : modo === "link" ? await supabase.auth.signInWithOtp({ email: em(), options: { emailRedirectTo: window.location.origin, shouldCreateUser: true } })
      : await supabase.auth.resetPasswordForEmail(em(), { redirectTo: window.location.origin });
    if (r.error) {
      setEstado("livre");
      setErro(r.error.message.includes("Invalid login credentials")
        ? "E-mail ou senha incorretos. Se ainda não criou uma senha, entre pelo link por e-mail e defina a senha depois."
        : mensagemErro(r.error));
    } else if (modo !== "senha") setEstado("enviado");
  }

  const trocar = (m: Modo) => { setModo(m); setErro(""); setEstado("livre"); };

  return (
    <div className="login">
      <form className="bloco" onSubmit={enviar}>
        <div className="marca">convert<span>ea</span><small>Operação</small></div>
        {estado === "enviado" ? (
          <>
            <p className="lead">{modo === "link" ? "Enviamos um link de acesso" : "Enviamos um link para criar uma nova senha"} para <b>{email}</b>. Abra o e-mail neste mesmo navegador.</p>
            <button type="button" className="btn" onClick={() => trocar("senha")}>Voltar</button>
          </>
        ) : (
          <>
            <p className="lead">
              {modo === "senha" ? "Sistema interno. Entre com o e-mail da equipe e a sua senha."
                : modo === "link" ? "Receba um link de acesso no e-mail. Use no primeiro acesso ou se ainda não criou uma senha."
                : "Informe o e-mail da equipe para receber um link e criar uma nova senha."}
            </p>
            <label className="campo" htmlFor="email">E-mail
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {modo === "senha" && (
              <label className="campo" htmlFor="senha">Senha
                <input id="senha" type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </label>
            )}
            {erro && <div className="erro">{erro}</div>}
            <button className="btn pri" disabled={estado === "enviando"}>
              {estado === "enviando" ? "Aguarde…" : modo === "senha" ? "Entrar" : modo === "link" ? "Receber link de acesso" : "Receber link para nova senha"}
            </button>
            <div className="acoes" style={{ justifyContent: "space-between" }}>
              {modo !== "senha" && <button type="button" className="link-btn" onClick={() => trocar("senha")}>Entrar com senha</button>}
              {modo !== "link" && <button type="button" className="link-btn" onClick={() => trocar("link")}>Entrar com link por e-mail</button>}
              {modo === "senha" && <button type="button" className="link-btn" onClick={() => trocar("esqueci")}>Esqueci a senha</button>}
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/** Tela para criar ou trocar a senha (também usada ao abrir o link de "Esqueci a senha"). */
export function DefinirSenha({ aoConcluir, titulo }: { aoConcluir: () => void; titulo?: string }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) return setErro("Use pelo menos 8 caracteres.");
    if (senha !== confirma) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha, data: { tem_senha: true } });
    setEnviando(false);
    if (error) setErro(mensagemErro(error)); else setOk(true);
  }

  return (
    <form className="bloco" onSubmit={salvar} style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }}>
      <h2>{titulo ?? "Definir senha"}</h2>
      {ok ? (
        <>
          <p className="lead">Senha salva. Da próxima vez, entre com o seu e-mail e esta senha.</p>
          <button type="button" className="btn pri" onClick={aoConcluir}>Continuar</button>
        </>
      ) : (
        <>
          <p className="sub" style={{ margin: 0 }}>Mínimo de 8 caracteres. O link por e-mail continua funcionando se você esquecer.</p>
          <label className="campo" htmlFor="nova-senha">Nova senha<input id="nova-senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></label>
          <label className="campo" htmlFor="confirma-senha">Repita a senha<input id="confirma-senha" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} /></label>
          {erro && <div className="erro">{erro}</div>}
          <button className="btn pri" disabled={enviando}>{enviando ? "Salvando…" : "Salvar senha"}</button>
        </>
      )}
    </form>
  );
}
