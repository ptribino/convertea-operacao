import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEu } from "../lib/api";
import { DefinirSenha } from "./Login";

export default function Conta() {
  const eu = useEu();
  const nav = useNavigate();
  const qc = useQueryClient();
  return (
    <>
      <div className="eyebrow">Minha conta</div>
      <h1 style={{ marginTop: 4 }}>{eu.data?.nome}</h1>
      <p className="lead">{eu.data?.email}</p>
      <div style={{ marginTop: 20 }}>
        <DefinirSenha titulo={eu.data?.temSenha ? "Trocar senha" : "Criar senha"} aoConcluir={() => { qc.invalidateQueries({ queryKey: ["eu"] }); nav("/"); }} />
      </div>
    </>
  );
}
