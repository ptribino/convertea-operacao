import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const configurado = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost", key ?? "sem-chave", {
  auth: { persistSession: true, detectSessionInUrl: true },
});

/** Mensagem de erro do Supabase/Postgres em português simples. */
export function mensagemErro(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (m.includes("permission denied") || m.includes("row-level security")) return "Sem permissão. Confira se o seu e-mail está na equipe.";
  return m;
}
