// script.js
// Envia o numero e o id_token do Google para /api/desenho e exibe o SVG
// devolvido pelo servidor. O e-mail da assinatura vem do token.

const formulario = document.getElementById("formulario");
const campoNumero = document.getElementById("numero");
const area = document.getElementById("desenho");
const mensagem = document.getElementById("mensagem");
const estadoLogin = document.getElementById("estado-login");
const botaoBaixar = document.getElementById("baixar");

let token = "";
let svgAtual = "";

// Chamada pelo Google Identity Services apos o login (data-callback).
window.receberCredencial = (resposta) => {
  token = resposta.credential;
  estadoLogin.textContent = "Login realizado. Escolha um número e clique em Desenhar.";
};

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagem.textContent = "";
  area.innerHTML = "";
  botaoBaixar.hidden = true;

  try {
    const resposta = await fetch("/api/desenho", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ numero: Number(campoNumero.value) }),
    });

    if (resposta.ok) {
      svgAtual = await resposta.text();
      area.innerHTML = svgAtual;
      botaoBaixar.hidden = false;
    } else if (resposta.status === 400) {
      mensagem.textContent = "Erro 400: número inválido. Digite um inteiro entre 1 e 100.";
    } else if (resposta.status === 401) {
      mensagem.textContent = "Erro 401: não autorizado. Faça login com sua conta Google.";
    } else {
      mensagem.textContent = `Erro ${resposta.status}: não foi possível gerar o desenho.`;
    }
  } catch {
    mensagem.textContent = "Erro de rede: não foi possível contatar o servidor.";
  }
});

botaoBaixar.addEventListener("click", () => {
  const arquivo = new Blob([svgAtual], { type: "image/svg+xml" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exemplo.svg";
  link.click();
  URL.revokeObjectURL(url);
});
