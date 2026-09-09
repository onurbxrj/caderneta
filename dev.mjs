/**
 * Servidor local para testar sem a Vercel: `node dev.mjs`
 * Serve a pasta public/ e roteia /api/* para as funções em api/,
 * do mesmo jeito que a Vercel faz em produção.
 *
 * Para rodar com um banco local em arquivo, sem Turso:
 *   TURSO_DATABASE_URL="file:./caderneta-local.db" node dev.mjs
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = fileURLToPath(new URL(".", import.meta.url));
const PORTA = Number(process.env.PORT || 3000);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

/** Descobre qual arquivo de api/ atende o caminho, inclusive rotas [id]. */
async function acharRota(partes) {
  const tentativas = [
    join(RAIZ, "api", ...partes) + ".js",
    join(RAIZ, "api", ...partes, "index.js")
  ];
  for (const caminho of tentativas) {
    try { await stat(caminho); return { caminho, query: {} }; } catch {}
  }
  if (partes.length >= 1) {
    const pai = partes.slice(0, -1);
    const dinamico = join(RAIZ, "api", ...pai, "[id].js");
    try {
      await stat(dinamico);
      return { caminho: dinamico, query: { id: partes[partes.length - 1] } };
    } catch {}
  }
  return null;
}

function prepararResposta(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  return res;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  prepararResposta(res);

  if (url.pathname.startsWith("/api/")) {
    const partes = url.pathname.slice(5).split("/").filter(Boolean);
    const rota = await acharRota(partes);
    if (!rota) { res.statusCode = 404; return res.end('{"erro":"Rota não encontrada."}'); }
    const mod = await import(pathToFileURL(rota.caminho).href + "?t=" + Date.now());
    req.query = { ...Object.fromEntries(url.searchParams), ...rota.query };
    try {
      await mod.default(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) { res.statusCode = 500; res.end('{"erro":"Erro interno."}'); }
    }
    return;
  }

  const arquivo = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const conteudo = await readFile(join(RAIZ, "public", arquivo));
    res.setHeader("Content-Type", TIPOS[extname(arquivo)] || "application/octet-stream");
    res.end(conteudo);
  } catch {
    res.statusCode = 404;
    res.end("Não encontrado");
  }
}).listen(PORTA, () => console.log("Caderneta em http://localhost:" + PORTA));
