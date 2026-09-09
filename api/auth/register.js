import { umaLinha, executar } from "../../lib/db.js";
import { criarSessao, existeAlgumUsuario, hashSenha, normalizarEmail, novoId } from "../../lib/auth.js";
import { erro, lerCorpo, metodo, responder, texto } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["POST"])) return;
  const corpo = await lerCorpo(req);
  const email = normalizarEmail(corpo.email);
  const senha = String(corpo.senha || "");
  const nome = texto(corpo.nome, 80);
  const convite = String(corpo.convite || "").trim().toUpperCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro(res, 400, "E-mail inválido.");
  if (senha.length < 8) return erro(res, 400, "A senha precisa ter pelo menos 8 caracteres.");

  const jaTemGente = await existeAlgumUsuario();

  // A primeira conta criada é a sua e dispensa convite. Depois disso, ninguém entra sem código.
  if (jaTemGente) {
    if (!convite) return erro(res, 400, "É preciso um código de convite para criar conta.");
    const linha = await umaLinha("SELECT codigo, usado_por, expira_em FROM invites WHERE codigo = ?", [convite]);
    if (!linha) return erro(res, 400, "Convite não encontrado.");
    if (linha.usado_por) return erro(res, 400, "Esse convite já foi usado.");
    if (linha.expira_em && Number(linha.expira_em) < Date.now()) return erro(res, 400, "Esse convite expirou.");
  }

  if (await umaLinha("SELECT id FROM users WHERE email = ?", [email]))
    return erro(res, 409, "Já existe uma conta com esse e-mail.");

  const id = novoId();

  // O UPDATE condicional é quem realmente decide a corrida: se duas requisições
  // chegarem com o mesmo código ao mesmo tempo, só uma altera uma linha aqui.
  // Por isso ele roda ANTES de criar o usuário — a segunda chamada é barrada
  // sem nunca chegar a criar conta com um convite que não conseguiu consumir.
  if (jaTemGente) {
    const resultado = await executar(
      "UPDATE invites SET usado_por = ?, usado_em = ? WHERE codigo = ? AND usado_por IS NULL",
      [id, Date.now(), convite]
    );
    if (Number(resultado.rowsAffected) !== 1)
      return erro(res, 400, "Esse convite já foi usado.");
  }

  await executar(
    "INSERT INTO users (id, email, nome, senha_hash, criado_em) VALUES (?, ?, ?, ?, ?)",
    [id, email, nome, await hashSenha(senha), Date.now()]
  );

  await criarSessao(res, id);
  return responder(res, 201, { id, email, nome });
}
