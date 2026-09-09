/** Utilidades de requisição e resposta compartilhadas pelas rotas. */

export function responder(res, status, corpo) {
  res.status(status);
  if (corpo === undefined) return res.end();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(corpo));
}

export function erro(res, status, mensagem) {
  return responder(res, status, { erro: mensagem });
}

export async function lerCorpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const pedacos = [];
  for await (const p of req) pedacos.push(p);
  if (!pedacos.length) return {};
  try {
    return JSON.parse(Buffer.concat(pedacos).toString("utf8"));
  } catch {
    return {};
  }
}

export function lerCookies(req) {
  const bruto = req.headers.cookie || "";
  const saida = {};
  for (const parte of bruto.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    saida[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return saida;
}

/** Aceita só os métodos listados; responde 405 no resto. */
export function metodo(req, res, permitidos) {
  if (permitidos.includes(req.method)) return true;
  res.setHeader("Allow", permitidos.join(", "));
  erro(res, 405, "Método não permitido.");
  return false;
}

export const texto = (v, max = 200) =>
  v == null ? null : String(v).trim().slice(0, max) || null;
export const inteiro = (v) => {
  if (v == null || v === "") return null;
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};
export const decimal = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};
export const dataISO = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
