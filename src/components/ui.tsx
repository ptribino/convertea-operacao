import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Cliente } from "../lib/types";

export const hoje = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD no fuso local
export const dataCurta = (s?: string | null) => (s ? s.slice(8, 10) + "/" + s.slice(5, 7) : "");
export const dataHora = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function PrazoChip({ c }: { c: Pick<Cliente, "proxima_data" | "etapa"> }) {
  if (!c.proxima_data || c.etapa === "perdido") return null;
  const h = hoje();
  if (c.proxima_data < h) return <span className="chip atraso">Atrasado · {dataCurta(c.proxima_data)}</span>;
  if (c.proxima_data === h) return <span className="chip hoje">Hoje</span>;
  return <span className="chip">{dataCurta(c.proxima_data)}</span>;
}

type Toast = { texto: string; erro?: boolean } | null;
const ToastCtx = createContext<(texto: string, erro?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<Toast>(null);
  const mostrar = useCallback((texto: string, erro?: boolean) => {
    setT({ texto, erro });
    window.setTimeout(() => setT(null), erro ? 5000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      {t && <div role="status" className={"toast" + (t.erro ? " erro" : "")}>{t.texto}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
