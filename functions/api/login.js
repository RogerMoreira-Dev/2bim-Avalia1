// functions/api/login.js
// Recebe o login do Google no modo de redirecionamento (usado no Brave,
// que bloqueia a janela de login). O Google envia o id_token por POST;
// a função confere o token anti-CSRF e devolve o token à página inicial
// pelo fragmento da URL, que não é enviado a nenhum servidor.

function erro(status, texto, extras = {}) {
  return new Response(texto, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...extras },
  });
}

export async function onRequest({ request }) {
  if (request.method !== "POST") {
    return erro(405, "Metodo nao permitido. Use POST.", { Allow: "POST" });
  }

  let formulario;
  try {
    formulario = await request.formData();
  } catch {
    return erro(400, "Formulario invalido.");
  }

  const credencial = formulario.get("credential");
  const csrfCorpo = formulario.get("g_csrf_token");
  const csrfCookie = /(?:^|;\s*)g_csrf_token=([^;]+)/.exec(request.headers.get("Cookie") || "");
  if (typeof credencial !== "string" || credencial === "" || !csrfCorpo || !csrfCookie || csrfCookie[1] !== csrfCorpo) {
    return erro(400, "Login invalido.");
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/#credencial=" + encodeURIComponent(credencial),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
