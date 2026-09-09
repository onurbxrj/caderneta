import { consultar, executar, umaLinha } from "../../lib/db.js";
import { exigirUsuario, novoId } from "../../lib/auth.js";
import { dataISO, decimal, erro, inteiro, lerCorpo, metodo, responder, texto } from "../../lib/http.js";
import { manutencaoParaApp } from "../../lib/mapear.js";

const CATEGORIAS = ["motor", "freios", "suspensao", "eletrica", "pneus", "ar", "funilaria", "outros"];

export default async function handler(req, res) {
  if (!metodo(req, res, ["GET", "POST"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const linhas = await consultar(
      "SELECT * FROM maintenances WHERE user_id = ? ORDER BY data DESC, criado_em DESC",
      [user.id]
    );
    return responder(res, 200, { manutencoes: linhas.map(manutencaoParaApp) });
  }

  const c = await lerCorpo(req);
  const data = dataISO(c.data);
  const km = inteiro(c.km);
  const servico = texto(c.servico, 120);
  const categoria = CATEGORIAS.includes(c.categoria) ? c.categoria : "outros";
  if (!data) return erro(res, 400, "Informe a data da manutenção.");
  if (km == null) return erro(res, 400, "Informe a quilometragem.");
  if (!servico) return erro(res, 400, "Descreva o serviço realizado.");

  const veiculo = await umaLinha(
    "SELECT id, km_atual FROM vehicles WHERE id = ? AND user_id = ?",
    [c.vehicleId, user.id]
  );
  if (!veiculo) return erro(res, 404, "Veículo não encontrado.");

  const vp = decimal(c.valorPeca), vm = decimal(c.valorMaoObra);
  const campos = [
    veiculo.id, data, km, categoria, servico,
    texto(c.peca, 160), texto(c.marcaPeca, 80),
    vp, vm, Math.round((vp + vm) * 100) / 100,
    texto(c.executadoPor, 120), inteiro(c.proximaKm), dataISO(c.proximaData),
    texto(c.comprovante, 500), texto(c.observacoes, 2000)
  ];
  const agora = Date.now();
  let id = c.id;

  if (id) {
    const dono = await umaLinha("SELECT id FROM maintenances WHERE id = ? AND user_id = ?", [id, user.id]);
    if (!dono) return erro(res, 404, "Lançamento não encontrado.");
    await executar(
      `UPDATE maintenances SET vehicle_id=?, data=?, km=?, categoria=?, servico=?, peca=?, marca_peca=?,
              valor_peca=?, valor_mao_obra=?, valor_total=?, executado_por=?, proxima_km=?, proxima_data=?,
              comprovante=?, observacoes=?, atualizado_em=?
        WHERE id=? AND user_id=?`,
      [...campos, agora, id, user.id]
    );
  } else {
    id = novoId();
    await executar(
      `INSERT INTO maintenances (id, user_id, vehicle_id, data, km, categoria, servico, peca, marca_peca,
                                 valor_peca, valor_mao_obra, valor_total, executado_por, proxima_km,
                                 proxima_data, comprovante, observacoes, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, ...campos, agora, agora]
    );
  }

  // Um lançamento com km maior que o odômetro atualiza o veículo.
  if (km > (Number(veiculo.km_atual) || 0))
    await executar("UPDATE vehicles SET km_atual = ? WHERE id = ? AND user_id = ?", [km, veiculo.id, user.id]);

  const linha = await umaLinha("SELECT * FROM maintenances WHERE id = ? AND user_id = ?", [id, user.id]);
  return responder(res, c.id ? 200 : 201, { manutencao: manutencaoParaApp(linha) });
}
