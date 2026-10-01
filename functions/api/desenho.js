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

// Devolve o e-mail do token se ele for valido, ou null caso contrario.
async function verificarToken(token, clientId) {
  if (!token || !clientId) return null;
  try {
    const resposta = await fetch(
      "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token)
    );
    if (resposta.status !== 200) return null;
    const dados = await resposta.json();
    if (dados.aud !== clientId) return null;
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
