import { encerrarSessao } from "../../lib/auth.js";
import { metodo, responder } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["POST"])) return;
  await encerrarSessao(req, res);
  return responder(res, 200, { ok: true });
}
