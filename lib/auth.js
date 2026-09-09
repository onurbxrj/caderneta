import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { consultar, executar, umaLinha } from "./db.js";
import { lerCookies, erro } from "./http.js";

const scryptAsync = promisify(scrypt);
const COOKIE = "caderneta_sessao";
const DIAS = 60; // duração da sessão
const N = 16384, r = 8, p = 1, TAM = 64;

export const novoId = () => randomUUID();

/** Guarda a senha como scrypt$N$r$p$salt$hash — nunca em texto puro. */
export async function hashSenha(senha) {
  const salt = randomBytes(16);
  const derivada = await scryptAsync(senha, salt, TAM, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("hex"), derivada.toString("hex")].join("$");
}

export async function conferirSenha(senha, guardado) {
  try {
    const [tipo, n, rr, pp, saltHex, hashHex] = String(guardado).split("$");
    if (tipo !== "scrypt") return false;
    const derivada = await scryptAsync(senha, Buffer.from(saltHex, "hex"), TAM, {
      N: Number(n), r: Number(rr), p: Number(pp)
    });
    const esperado = Buffer.from(hashHex, "hex");
    return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
  } catch {
    return false;
  }
}

export async function criarSessao(res, userId) {
  const token = randomBytes(32).toString("hex");
  const agora = Date.now();
  const expira = agora + DIAS * 86400000;
  await executar(
    "INSERT INTO sessions (token, user_id, criado_em, expira_em) VALUES (?, ?, ?, ?)",
    [token, userId, agora, expira]
  );
  const seguro = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=${DIAS * 86400}`
  );
  return token;
}

export async function encerrarSessao(req, res) {
  const token = lerCookies(req)[COOKIE];
  if (token) await executar("DELETE FROM sessions WHERE token = ?", [token]);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Devolve o usuário da sessão, ou null. */
export async function usuarioAtual(req) {
  const token = lerCookies(req)[COOKIE];
  if (!token) return null;
  const linha = await umaLinha(
    `SELECT u.id, u.email, u.nome, s.expira_em
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    [token]
  );
  if (!linha) return null;
  if (Number(linha.expira_em) < Date.now()) {
    await executar("DELETE FROM sessions WHERE token = ?", [token]);
    return null;
  }
  return { id: linha.id, email: linha.email, nome: linha.nome };
}

/**
 * Porta de entrada de toda rota protegida. Devolve o usuário ou responde 401.
 * Todas as consultas de dados filtram por user.id — nunca por id vindo do cliente.
 */
export async function exigirUsuario(req, res) {
  const user = await usuarioAtual(req);
  if (!user) {
    erro(res, 401, "Faça login para continuar.");
    return null;
  }
  return user;
}

export async function existeAlgumUsuario() {
  const linhas = await consultar("SELECT id FROM users LIMIT 1");
  return linhas.length > 0;
}

export const normalizarEmail = (e) => String(e || "").trim().toLowerCase();
