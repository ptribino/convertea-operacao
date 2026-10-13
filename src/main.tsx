import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { configurado, supabase } from "./lib/supabase";
import { ToastProvider } from "./components/ui";
import Layout from "./components/Layout";
import Login, { DefinirSenha } from "./pages/Login";
import Conta from "./pages/Conta";
import Funil from "./pages/Funil";
import Ficha from "./pages/Ficha";
import NovoCliente from "./pages/NovoCliente";
import Questionarios from "./pages/Questionarios";
import Painel from "./pages/Painel";
import Relatorio from "./pages/Relatorio";
import "./styles.css";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });

function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [recuperando, setRecuperando] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true); // abriu o link de "Esqueci a senha"
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configurado)
    return (
      <div className="login"><div className="bloco"><h2>Falta configurar o Supabase</h2>
        <p className="sub">Crie o arquivo .env.local a partir do .env.example (ou as variáveis no Netlify) com a URL e a chave pública do projeto convertea.</p></div></div>
    );
  if (sessao === undefined) return null;
  if (!sessao) return <Login />;
  if (recuperando) return <div className="login"><DefinirSenha titulo="Criar nova senha" aoConcluir={() => setRecuperando(false)} /></div>;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Funil />} />
        <Route path="clientes/novo" element={<NovoCliente />} />
        <Route path="clientes/:id" element={<Ficha />} />
        <Route path="questionarios" element={<Questionarios />} />
        <Route path="painel" element={<Painel />} />
        <Route path="relatorio/:id" element={<Relatorio />} />
        <Route path="conta" element={<Conta />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
