import { executar, umaLinha } from "../../lib/db.js";
import { exigirUsuario } from "../../lib/auth.js";
import { erro, lerCorpo, metodo, responder } from "../../lib/http.js";
import { apagarBlob, decodificarDataUrl, subirBlob } from "../../lib/fotos.js";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

export default async function handler(req, res) {
  if (!metodo(req, res, ["GET", "POST", "DELETE"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  const { id } = req.query;
  const linha = await umaLinha(
    "SELECT id, foto_url FROM maintenances WHERE id = ? AND user_id = ?",
    [id, user.id]
  );
  if (!linha) return erro(res, 404, "Lançamento não encontrado.");

  if (req.method === "GET") {
    if (!linha.foto_url) return erro(res, 404, "Esse lançamento não tem comprovante.");
    // A URL do Blob fica só no servidor; quem pede a imagem passa antes pela sessão.
    const r = await fetch(linha.foto_url);
    if (!r.ok) return erro(res, 502, "Não foi possível carregar o comprovante agora.");
    const bytes = Buffer.from(await r.arrayBuffer());
    res.status(200);
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    return res.end(bytes);
  }

  if (req.method === "DELETE") {
    await apagarBlob(linha.foto_url);
    await executar("UPDATE maintenances SET foto_url = NULL, atualizado_em = ? WHERE id = ? AND user_id = ?",
      [Date.now(), id, user.id]);
    return responder(res, 200, { ok: true });
  }

  const { imagem } = await lerCorpo(req);
  const arquivo = decodificarDataUrl(imagem);
  if (!arquivo) return erro(res, 400, "Imagem inválida ou grande demais (limite de 3 MB).");

  const antiga = linha.foto_url;
  const url = await subirBlob(user.id, id, arquivo.tipo, arquivo.bytes);
  await executar("UPDATE maintenances SET foto_url = ?, atualizado_em = ? WHERE id = ? AND user_id = ?",
    [url, Date.now(), id, user.id]);
  await apagarBlob(antiga);
  return responder(res, 201, { ok: true });
}
