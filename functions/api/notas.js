// functions/api/notas.js
// GET /api/notas?aluno=Nome devolve as notas do aluno em JSON.

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Metodo nao permitido. Use GET.", { status: 405, headers: { Allow: "GET" } });
  }

  const nome = new URL(request.url).searchParams.get("aluno") || "";
  const { results } = await env.DB.prepare("SELECT * FROM notas WHERE aluno = ?").bind(nome).all();

  return Response.json(results);
}
