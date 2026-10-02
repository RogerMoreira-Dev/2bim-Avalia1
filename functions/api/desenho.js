// functions/api/desenho.js
// Pages Function: POST /api/desenho
// Corpo: {"numero": 42}. Cabecalho: Authorization: Bearer <id_token>.
// Ordem das verificacoes: metodo (405), corpo (400), token (401).

import { gerarDesenho, numeroValido } from "../../lib/desenho.js";

function erro(status, texto, extras = {}) {
  return new Response(texto, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...extras },
  });
}

const CERTIFICADOS = "https://www.googleapis.com/oauth2/v3/certs";
const EMISSORES = ["accounts.google.com", "https://accounts.google.com"];
const ALGORITMO = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

// Chaves públicas do Google, guardadas pelo tempo indicado em Cache-Control.
let cacheChaves = { chaves: [], expira: 0 };

async function chavesGoogle(forcar = false) {
  if (!forcar && Date.now() < cacheChaves.expira) return cacheChaves.chaves;
  const resposta = await fetch(CERTIFICADOS);
  if (!resposta.ok) throw new Error("Falha ao obter as chaves do Google.");
  const { keys } = await resposta.json();
  const maxAge = /max-age=(\d+)/.exec(resposta.headers.get("Cache-Control") || "");
  cacheChaves = {
    chaves: Array.isArray(keys) ? keys : [],
    expira: Date.now() + (maxAge ? Number(maxAge[1]) : 3600) * 1000,
  };
  return cacheChaves.chaves;
}

function bytesBase64Url(texto) {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
}

function jsonBase64Url(texto) {
  return JSON.parse(new TextDecoder().decode(bytesBase64Url(texto)));
}

// Verifica localmente o id_token (assinatura RS256, iss, aud, exp e
// email_verified) e devolve o e-mail se ele for válido, ou null.
async function verificarToken(token, clientId) {
  if (!token || !clientId) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  try {
    const cabecalho = jsonBase64Url(partes[0]);
    const dados = jsonBase64Url(partes[1]);
    if (cabecalho.alg !== "RS256" || typeof cabecalho.kid !== "string") return null;

    // Se a chave não estiver no cache, o Google pode ter feito rotação: busca de novo.
    let jwk = (await chavesGoogle()).find((k) => k.kid === cabecalho.kid);
    if (!jwk) jwk = (await chavesGoogle(true)).find((k) => k.kid === cabecalho.kid);
    if (!jwk) return null;

    const chave = await crypto.subtle.importKey("jwk", jwk, ALGORITMO, false, ["verify"]);
    const assinaturaValida = await crypto.subtle.verify(
      ALGORITMO.name,
      chave,
      bytesBase64Url(partes[2]),
      new TextEncoder().encode(`${partes[0]}.${partes[1]}`)
    );
    if (!assinaturaValida) return null;

    if (!EMISSORES.includes(dados.iss)) return null;
    if (dados.aud !== clientId) return null;
    if (typeof dados.exp !== "number" || dados.exp * 1000 <= Date.now()) return null;
    if (String(dados.email_verified) !== "true") return null;
    if (typeof dados.email !== "string" || dados.email === "") return null;
    return dados.email;
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return erro(405, "Metodo nao permitido. Use POST.", { Allow: "POST" });
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return erro(400, "Corpo ausente ou JSON invalido.");
  }
  if (corpo === null || typeof corpo !== "object" || !numeroValido(corpo.numero)) {
    return erro(400, "O numero deve ser um inteiro entre 1 e 100.");
  }

  const cabecalho = request.headers.get("Authorization") || "";
  const encontrado = /^Bearer\s+(\S+)$/i.exec(cabecalho.trim());
  const email = await verificarToken(encontrado && encontrado[1], env.GOOGLE_CLIENT_ID);
  if (!email) {
    return erro(401, "Token ausente, invalido ou expirado.");
  }

  return new Response(gerarDesenho(corpo.numero, email), {
    status: 200,
    headers: { "Content-Type": "image/svg+xml" },
  });
}
