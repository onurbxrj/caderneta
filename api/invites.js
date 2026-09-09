import { randomBytes } from "node:crypto";
import { consultar, executar } from "../lib/db.js";
import { exigirUsuario } from "../lib/auth.js";
import { metodo, responder } from "../lib/http.js";

/** Código curto, sem caracteres que se confundem (0/O, 1/I). */
function gerarCodigo() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let saida = "";
  for (let i = 0; i < 8; i++) saida += alfabeto[bytes[i] % alfabeto.length];
  return saida.slice(0, 4) + "-" + saida.slice(4);
}

export default async function handler(req, res) {
  if (!metodo(req, res, ["GET", "POST"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  if (req.method === "POST") {
    const codigo = gerarCodigo();
    const agora = Date.now();
    await executar(
      "INSERT INTO invites (codigo, criado_por, criado_em, expira_em) VALUES (?, ?, ?, ?)",
      [codigo, user.id, agora, agora + 30 * 86400000]
    );
    return responder(res, 201, { codigo, expiraEm: agora + 30 * 86400000 });
  }

  const linhas = await consultar(
    `SELECT codigo, criado_em, expira_em, usado_por, usado_em
       FROM invites WHERE criado_por = ? ORDER BY criado_em DESC LIMIT 50`,
    [user.id]
  );
  return responder(res, 200, {
    convites: linhas.map((l) => ({
      codigo: l.codigo,
      criadoEm: Number(l.criado_em),
      expiraEm: l.expira_em ? Number(l.expira_em) : null,
      usado: !!l.usado_por
    }))
  });
}
