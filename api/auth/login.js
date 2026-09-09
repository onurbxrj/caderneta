import { umaLinha } from "../../lib/db.js";
import { conferirSenha, criarSessao, normalizarEmail } from "../../lib/auth.js";
import { erro, lerCorpo, metodo, responder } from "../../lib/http.js";

export default async function handler(req, res) {
  if (!metodo(req, res, ["POST"])) return;
  const { email, senha } = await lerCorpo(req);
  const conta = normalizarEmail(email);
  if (!conta || !senha) return erro(res, 400, "Informe e-mail e senha.");

  const user = await umaLinha("SELECT id, email, nome, senha_hash FROM users WHERE email = ?", [conta]);
  // Mesma mensagem para e-mail inexistente e senha errada: não entrega quem tem conta.
  if (!user || !(await conferirSenha(String(senha), user.senha_hash)))
    return erro(res, 401, "E-mail ou senha incorretos.");

  await criarSessao(res, user.id);
  return responder(res, 200, { id: user.id, email: user.email, nome: user.nome });
}
