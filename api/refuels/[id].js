import { executar, umaLinha } from "../../lib/db.js";
import { exigirUsuario } from "../../lib/auth.js";
import { erro, metodo, responder } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["DELETE"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  const { id } = req.query;
  const linha = await umaLinha("SELECT id FROM refuels WHERE id = ? AND user_id = ?", [id, user.id]);
  if (!linha) return erro(res, 404, "Abastecimento não encontrado.");

  await executar("DELETE FROM refuels WHERE id = ? AND user_id = ?", [id, user.id]);
  return responder(res, 200, { ok: true });
}
