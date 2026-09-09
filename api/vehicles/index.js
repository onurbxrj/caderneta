import { consultar, executar, umaLinha } from "../../lib/db.js";
import { exigirUsuario, novoId } from "../../lib/auth.js";
import { erro, inteiro, lerCorpo, metodo, responder, texto } from "../../lib/http.js";
import { veiculoParaApp } from "../../lib/mapear.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["GET", "POST"])) return;
  const user = await exigirUsuario(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const linhas = await consultar(
      "SELECT * FROM vehicles WHERE user_id = ? ORDER BY criado_em ASC",
      [user.id]
    );
    return responder(res, 200, { veiculos: linhas.map(veiculoParaApp) });
  }

  const c = await lerCorpo(req);
  const nome = texto(c.nome, 80);
  if (!nome) return erro(res, 400, "Dê um nome ao veículo.");

  const agora = Date.now();
  const campos = [
    nome, texto(c.marca, 60), texto(c.modelo, 80), texto(c.ano, 8),
    texto(c.placa, 10), texto(c.cor, 40), texto(c.combustivel, 20),
    inteiro(c.kmAtual) || 0, inteiro(c.kmInicial)
  ];

  if (c.id) {
    // O WHERE com user_id é o que impede editar o veículo de outra pessoa.
    const dono = await umaLinha("SELECT id FROM vehicles WHERE id = ? AND user_id = ?", [c.id, user.id]);
    if (!dono) return erro(res, 404, "Veículo não encontrado.");
    await executar(
      `UPDATE vehicles SET nome=?, marca=?, modelo=?, ano=?, placa=?, cor=?, combustivel=?,
              km_atual=?, km_inicial=? WHERE id=? AND user_id=?`,
      [...campos, c.id, user.id]
    );
    const linha = await umaLinha("SELECT * FROM vehicles WHERE id = ? AND user_id = ?", [c.id, user.id]);
    return responder(res, 200, { veiculo: veiculoParaApp(linha) });
  }

  const id = novoId();
  await executar(
    `INSERT INTO vehicles (id, user_id, nome, marca, modelo, ano, placa, cor, combustivel,
                           km_atual, km_inicial, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user.id, ...campos, agora]
  );
  const linha = await umaLinha("SELECT * FROM vehicles WHERE id = ? AND user_id = ?", [id, user.id]);
  return responder(res, 201, { veiculo: veiculoParaApp(linha) });
}
