import { consultar, executar, umaLinha } from "../../lib/db.js";
import { exigirUsuario } from "../../lib/auth.js";
import { erro, metodo, responder } from "../../lib/http.js";
import { apagarBlob } from "../../lib/fotos.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["DELETE"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  const { id } = req.query;
  const veiculo = await umaLinha("SELECT id FROM vehicles WHERE id = ? AND user_id = ?", [id, user.id]);
  if (!veiculo) return erro(res, 404, "Veículo não encontrado.");

  // Apaga também as fotos das manutenções desse veículo, para não deixar lixo no Blob.
  const comFoto = await consultar(
    "SELECT foto_url FROM maintenances WHERE user_id = ? AND vehicle_id = ? AND foto_url IS NOT NULL",
    [user.id, id]
  );
  for (const l of comFoto) await apagarBlob(l.foto_url);

  await executar("DELETE FROM maintenances WHERE user_id = ? AND vehicle_id = ?", [user.id, id]);
  await executar("DELETE FROM vehicles WHERE id = ? AND user_id = ?", [id, user.id]);
  return responder(res, 200, { ok: true });
}
