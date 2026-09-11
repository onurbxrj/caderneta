import { consultar, executar, umaLinha } from "../../lib/db.js";
import { exigirUsuario, novoId } from "../../lib/auth.js";
import { dataISO, decimal, erro, inteiro, lerCorpo, metodo, responder, texto } from "../../lib/http.js";
import { abastecimentoParaApp } from "../../lib/mapear.js";

const COMBUSTIVEIS = ["gasolina", "aditivada", "etanol", "diesel", "gnv"];

export default async function handler(req, res) {
  if (!metodo(req, res, ["GET", "POST"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const linhas = await consultar(
      "SELECT * FROM refuels WHERE user_id = ? ORDER BY data DESC, km DESC",
      [user.id]
    );
    return responder(res, 200, { abastecimentos: linhas.map(abastecimentoParaApp) });
  }

  const c = await lerCorpo(req);
  const data = dataISO(c.data);
  const km = inteiro(c.km);
  const litros = decimal(c.litros);
  const combustivel = COMBUSTIVEIS.includes(c.combustivel) ? c.combustivel : "gasolina";
  if (!data) return erro(res, 400, "Informe a data do abastecimento.");
  if (km == null) return erro(res, 400, "Informe a quilometragem.");
  if (!litros) return erro(res, 400, "Informe quantos litros foram abastecidos.");

  const veiculo = await umaLinha(
    "SELECT id, km_atual FROM vehicles WHERE id = ? AND user_id = ?",
    [c.vehicleId, user.id]
  );
  if (!veiculo) return erro(res, 404, "Veículo não encontrado.");

  let total = decimal(c.valorTotal);
  let preco = decimal(c.precoLitro, 3);
  if (!preco && total) preco = Math.round((total / litros) * 1000) / 1000;
  if (!total && preco) total = Math.round(preco * litros * 100) / 100;

  const campos = [
    veiculo.id, data, km, combustivel, litros, preco || null, total,
    c.tanqueCheio === false ? 0 : 1,
    texto(c.posto, 120), texto(c.observacoes, 2000)
  ];
  const agora = Date.now();
  let id = c.id;

  if (id) {
    const dono = await umaLinha("SELECT id FROM refuels WHERE id = ? AND user_id = ?", [id, user.id]);
    if (!dono) return erro(res, 404, "Abastecimento não encontrado.");
    await executar(
      `UPDATE refuels SET vehicle_id=?, data=?, km=?, combustivel=?, litros=?, preco_litro=?, valor_total=?,
              tanque_cheio=?, posto=?, observacoes=?, atualizado_em=?
        WHERE id=? AND user_id=?`,
      [...campos, agora, id, user.id]
    );
  } else {
    id = novoId();
    await executar(
      `INSERT INTO refuels (id, user_id, vehicle_id, data, km, combustivel, litros, preco_litro, valor_total,
                            tanque_cheio, posto, observacoes, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, ...campos, agora, agora]
    );
  }

  if (km > (Number(veiculo.km_atual) || 0))
    await executar("UPDATE vehicles SET km_atual = ? WHERE id = ? AND user_id = ?", [km, veiculo.id, user.id]);

  const linha = await umaLinha("SELECT * FROM refuels WHERE id = ? AND user_id = ?", [id, user.id]);
  return responder(res, c.id ? 200 : 201, { abastecimento: abastecimentoParaApp(linha) });
}
