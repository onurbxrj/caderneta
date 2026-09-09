import { usuarioAtual, existeAlgumUsuario } from "../../lib/auth.js";
import { metodo, responder } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["GET"])) return;
  const user = await usuarioAtual(req);
  // primeiroAcesso indica que ainda não há nenhuma conta: o primeiro cadastro dispensa convite.
  return responder(res, 200, { user, primeiroAcesso: user ? false : !(await existeAlgumUsuario()) });
}
