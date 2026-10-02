// script.js
// Envia o numero e o id_token do Google para /api/desenho e exibe o SVG
// devolvido pelo servidor. O e-mail da assinatura vem do token.

const formulario = document.getElementById("formulario");
const campoNumero = document.getElementById("numero");
const botaoDesenhar = document.getElementById("desenhar");
const resultado = document.getElementById("resultado");
const area = document.getElementById("desenho");
const mensagem = document.getElementById("mensagem");
const estadoLogin = document.getElementById("estado-login");
const botaoBaixar = document.getElementById("baixar");
const botaoOutro = document.getElementById("outro");

const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

let token = "";
let svgAtual = "";

// Le o e-mail do token apenas para mostrar na tela.
// Quem confere o token de verdade e o servidor.
function emailDoToken(credencial) {
  try {
    const base64 = credencial.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).email || "";
  } catch {
    return "";
  }
}

const botaoGoogle = document.getElementById("botao-google");

// Recebe o id_token do Google, seja pela janela de login ou pelo redirecionamento.
function receberCredencial(resposta) {
  token = resposta.credential;
  const email = emailDoToken(token);
  estadoLogin.textContent = email ? `Conectado como ${email}` : "Login realizado.";
  estadoLogin.classList.add("conectado");
  mensagem.textContent = "";
  campoNumero.focus();
}

// O Brave bloqueia a janela de login do Google; nele o login usa
// redirecionamento e volta pela rota /api/login.
function iniciarGoogle() {
  if (iniciarGoogle.pronto || !window.google?.accounts?.id) return;
  iniciarGoogle.pronto = true;
  google.accounts.id.initialize({
    client_id: botaoGoogle.dataset.clientId,
    callback: receberCredencial,
    ux_mode: "brave" in navigator ? "redirect" : "popup",
    login_uri: new URL("/api/login", location.origin).href,
  });
  google.accounts.id.renderButton(botaoGoogle, {
    type: "standard",
    shape: "pill",
    theme: "filled_black",
    size: "large",
    text: "signin_with",
    logo_alignment: "left",
    locale: "pt-BR",
  });
}

window.iniciarGoogle = iniciarGoogle;
iniciarGoogle();

// Volta do login por redirecionamento: o token chega no fragmento da URL.
const credencialRedirecionada = new URLSearchParams(location.hash.slice(1)).get("credencial");
if (credencialRedirecionada) {
  history.replaceState(null, "", location.pathname + location.search);
  receberCredencial({ credential: credencialRedirecionada });
}

function rolarPara(elemento) {
  elemento.scrollIntoView({ behavior: menosMovimento.matches ? "auto" : "smooth", block: "start" });
}

function carregando(ativo) {
  botaoDesenhar.disabled = ativo;
  botaoDesenhar.setAttribute("aria-busy", String(ativo));
  botaoDesenhar.textContent = ativo ? "Desenhando…" : "Desenhar";
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (botaoDesenhar.disabled) return;

  mensagem.textContent = "";
  area.innerHTML = "";
  resultado.hidden = true;
  botaoBaixar.hidden = true;
  carregando(true);

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
      const svg = area.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `Desenho gerado para o número ${svg.dataset.numero}`);
      }
      resultado.hidden = false;
      botaoBaixar.hidden = false;
      rolarPara(resultado);
    } else if (resposta.status === 400) {
      mensagem.textContent = "Erro 400: número inválido. Digite um inteiro entre 1 e 100.";
    } else if (resposta.status === 401) {
      mensagem.textContent = "Erro 401: não autorizado. Faça login com sua conta Google.";
    } else {
      mensagem.textContent = `Erro ${resposta.status}: não foi possível gerar o desenho.`;
    }
  } catch {
    mensagem.textContent = "Erro de rede: não foi possível contatar o servidor.";
  } finally {
    carregando(false);
  }
});

botaoBaixar.addEventListener("click", () => {
  const arquivo = new Blob([svgAtual], { type: "image/svg+xml" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exemplo.svg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

botaoOutro.addEventListener("click", () => {
  rolarPara(document.body);
  campoNumero.focus({ preventScroll: true });
  campoNumero.select();
});

// Modo escuro: inverte as cores da página e lembra a escolha.
const botaoTema = document.getElementById("tema");

function aplicarTema(escuro) {
  if (escuro) document.documentElement.dataset.tema = "escuro";
  else delete document.documentElement.dataset.tema;
  botaoTema.setAttribute("aria-pressed", String(escuro));
  botaoTema.setAttribute("aria-label", escuro ? "Desativar modo escuro" : "Ativar modo escuro");
  botaoTema.title = escuro ? "Modo claro" : "Modo escuro";
}

aplicarTema(document.documentElement.dataset.tema === "escuro");

botaoTema.addEventListener("click", () => {
  const escuro = document.documentElement.dataset.tema !== "escuro";
  aplicarTema(escuro);
  try {
    localStorage.setItem("tema", escuro ? "escuro" : "claro");
  } catch {}
});
