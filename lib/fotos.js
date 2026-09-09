import { del, put } from "@vercel/blob";

/**
 * As fotos ficam no Vercel Blob com nome aleatório, e a URL nunca chega ao navegador:
 * o app pede /api/photos/<id> e a função confere a sessão antes de devolver a imagem.
 */
export const LIMITE_BYTES = 3 * 1024 * 1024;

export function decodificarDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length || bytes.length > LIMITE_BYTES) return null;
  return { tipo: m[1], bytes };
}

export async function subirBlob(userId, maintId, tipo, bytes) {
  const ext = tipo === "image/png" ? "png" : tipo === "image/webp" ? "webp" : "jpg";
  const r = await put(`comprovantes/${userId}/${maintId}.${ext}`, bytes, {
    access: "public",          // a proteção vem da rota autenticada, não da URL
    addRandomSuffix: true,     // e a URL é impossível de adivinhar
    contentType: tipo
  });
  return r.url;
}

export async function apagarBlob(url) {
  if (!url) return;
  try {
    await del(url);
  } catch {
    /* foto já removida ou token ausente: seguir sem quebrar a operação principal */
  }
}
