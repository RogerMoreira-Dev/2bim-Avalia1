// fundo.js
// Fundo animado de metal líquido: um shader de raymarching desenhado num
// canvas WebGL que ocupa a tela inteira. Gotas de mercúrio se fundem e
// seguem o ponteiro. A resolução se ajusta sozinha ao desempenho do
// aparelho, a animação para quando a aba fica oculta e fica mais lenta
// quando o sistema pede menos movimento.

const VERTICES = `
attribute vec2 aPosicao;
void main() {
  gl_Position = vec4(aPosicao, 0.0, 1.0);
}
`;

const FRAGMENTOS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float uTempo;
uniform vec2 uResolucao;
uniform vec2 uPonteiro;
uniform float uEspalhamento;

#define PASSOS 80
#define DISTANCIA_MAX 40.0
#define SUPERFICIE 0.0015

// União suave: faz duas gotas se fundirem como líquido.
float uniaoSuave(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float cena(vec3 p) {
  float t = uTempo * 0.3;
  vec2 alvo = (uPonteiro - 0.5) * vec2(6.5 * uEspalhamento, 4.2);

  // Gota que segue o ponteiro.
  float d = length(p - vec3(alvo, 1.2)) - 0.9;

  // Corpos grandes, que pulsam e se esticam.
  for (int i = 0; i < 8; i++) {
    float f = float(i);
    vec3 centro = vec3(
      sin(t * 0.7 + f * 1.5) * 3.8 * uEspalhamento,
      cos(t * 0.5 + f * 2.2) * 2.2,
      sin(t * 0.9 + f * 0.8)
    );
    vec3 q = p - centro;
    q.y *= 0.8 + 0.3 * sin(t + f);
    float raio = 0.5 + 0.3 * sin(t * 0.8 + f);
    d = uniaoSuave(d, length(q) - raio, 1.1);
  }

  // Contas pequenas, que dão densidade à mistura.
  for (int j = 0; j < 14; j++) {
    float f = float(j);
    vec3 centro = vec3(
      sin(t * 1.3 + f * 4.1) * 5.2 * uEspalhamento,
      cos(t * 1.0 + f * 2.8) * 3.6,
      sin(t * 1.6 + f * 0.7) * 0.8
    );
    float raio = 0.08 + 0.2 * abs(cos(t * 1.8 + f * 1.2));
    d = uniaoSuave(d, length(p - centro) - raio, 0.45);
  }

  // Ondulação leve na superfície.
  d += sin(p.x * 2.5 + t) * sin(p.y * 2.5 + t) * 0.06;
  return d;
}

// Normal pelo método do tetraedro (4 amostras em vez de 6).
vec3 normal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0015;
  return normalize(
    e.xyy * cena(p + e.xyy) +
    e.yyx * cena(p + e.yyx) +
    e.yxy * cena(p + e.yxy) +
    e.xxx * cena(p + e.xxx)
  );
}

// Estúdio fotográfico refletido no cromo: softbox, barras de luz e painéis pretos.
vec3 ambiente(vec3 r) {
  float alto = smoothstep(-0.5, 0.5, r.y);
  vec3 cor = mix(vec3(0.85, 0.9, 0.96), vec3(1.0), alto);

  float barra1 = pow(max(0.0, dot(r, normalize(vec3(1.5, 0.2, -0.8)))), 24.0);
  float barra2 = pow(max(0.0, dot(r, normalize(vec3(-1.2, 0.1, -0.4)))), 32.0);
  cor += vec3(1.8) * barra1 * alto;
  cor += vec3(1.2) * barra2 * (1.0 - alto);

  float painelA = smoothstep(0.4, 0.9, abs(r.x));
  float painelB = smoothstep(0.2, 0.7, abs(r.z));
  cor = mix(cor, vec3(0.0), painelA * 0.85 * (1.0 - alto));
  cor = mix(cor, vec3(0.01), painelB * 0.65);

  float faixas = pow(abs(cos(r.x * 2.5 + r.z * 1.5 + uTempo * 0.05)), 60.0);
  cor = mix(cor, vec3(1.5), faixas * 0.4 * alto);
  return cor;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolucao) / uResolucao.y;
  vec3 origem = vec3(0.0, 0.0, -8.2);
  vec3 direcao = normalize(vec3(uv, 3.2));

  float percorrido = 0.0;
  bool acertou = false;
  for (int i = 0; i < PASSOS; i++) {
    float d = cena(origem + direcao * percorrido);
    if (abs(d) < SUPERFICIE) { acertou = true; break; }
    percorrido += d;
    if (percorrido > DISTANCIA_MAX) break;
  }

  vec3 cor = vec3(1.0);

  if (acertou) {
    vec3 p = origem + direcao * percorrido;
    vec3 n = normal(p);
    vec3 v = -direcao;

    cor = ambiente(reflect(direcao, n)) * vec3(0.98, 0.99, 1.0);

    vec3 luz = normalize(vec3((uPonteiro.x - 0.5) * 15.0, (uPonteiro.y - 0.5) * 15.0 + 5.0, -3.5));
    float especular = max(0.0, dot(reflect(-luz, n), v));
    cor += vec3(3.5) * pow(especular, 4000.0);

    float fresnel = pow(1.0 - max(0.0, dot(n, v)), 6.0);
    cor = mix(cor, vec3(1.0), fresnel * 0.75);
    cor += fresnel * vec3(0.6, 0.8, 1.2) * 0.6;
    cor += vec3(0.4, 0.6, 1.0) * pow(especular, 64.0) * 0.35;

    float curva = 1.0 - abs(n.z);
    cor *= mix(1.0, 0.7, pow(curva, 3.5));
  }

  cor = clamp(pow(cor, vec3(0.85)), 0.0, 1.0);
  gl_FragColor = vec4(cor, 1.0);
}
`;

const raiz = document.documentElement;
const canvas = document.getElementById("fundo");
const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");

// Escala da resolução interna em relação aos pixels CSS.
const ESCALA_MIN = 0.22;
const ESCALA_MAX = Math.min(window.devicePixelRatio || 1, 1.25);
let escala = Math.min(0.75, ESCALA_MAX);
let aumentosRestantes = 3;

let gl = null;
let programa = null;
let uniformes = {};
let quadro = 0;

// Tempo da animação em segundos. Avança mais devagar quando o sistema
// pede menos movimento, em vez de congelar o fundo.
let tempo = 20;
let anterior = 0;

const ponteiro = { x: 0.5, y: 0.5 };
const alvo = { x: 0.5, y: 0.5 };
let ultimoMovimento = -Infinity;

// Medição de desempenho para a resolução adaptativa.
let somaIntervalos = 0;
let quadrosMedidos = 0;

function falhar() {
  raiz.classList.remove("webgl-pronto");
  raiz.classList.add("sem-webgl");
}

function compilar(tipo, fonte) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    console.warn("Shader não compilou:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function preparar() {
  const vertices = compilar(gl.VERTEX_SHADER, VERTICES);
  const fragmentos = compilar(gl.FRAGMENT_SHADER, FRAGMENTOS);
  if (!vertices || !fragmentos) return false;

  programa = gl.createProgram();
  gl.attachShader(programa, vertices);
  gl.attachShader(programa, fragmentos);
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS) && !gl.isContextLost()) {
    console.warn("Programa não ligou:", gl.getProgramInfoLog(programa));
    return false;
  }
  gl.useProgram(programa);

  // Um triângulo que cobre a tela inteira.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const local = gl.getAttribLocation(programa, "aPosicao");
  gl.enableVertexAttribArray(local);
  gl.vertexAttribPointer(local, 2, gl.FLOAT, false, 0, 0);

  uniformes = {
    tempo: gl.getUniformLocation(programa, "uTempo"),
    resolucao: gl.getUniformLocation(programa, "uResolucao"),
    ponteiro: gl.getUniformLocation(programa, "uPonteiro"),
    espalhamento: gl.getUniformLocation(programa, "uEspalhamento"),
  };
  return true;
}

function redimensionar() {
  const largura = Math.max(1, Math.round(canvas.clientWidth * escala));
  const altura = Math.max(1, Math.round(canvas.clientHeight * escala));
  if (canvas.width !== largura || canvas.height !== altura) {
    canvas.width = largura;
    canvas.height = altura;
  }
}

// Ajusta a resolução interna conforme o tempo médio entre quadros.
function adaptar(intervalo) {
  if (intervalo <= 0 || intervalo > 250) return;
  somaIntervalos += intervalo;
  quadrosMedidos++;
  if (quadrosMedidos < 30) return;

  const media = somaIntervalos / quadrosMedidos;
  somaIntervalos = 0;
  quadrosMedidos = 0;

  if (media > 24 && escala > ESCALA_MIN) {
    escala = Math.max(ESCALA_MIN, escala * 0.8);
  } else if (media < 17.5 && escala < ESCALA_MAX && aumentosRestantes > 0) {
    escala = Math.min(ESCALA_MAX, escala * 1.12);
    aumentosRestantes--;
  }
}

function desenhar(agora) {
  if (!gl || gl.isContextLost()) return;

  const intervalo = anterior ? agora - anterior : 0;
  anterior = agora;
  adaptar(intervalo);

  const calmo = menosMovimento.matches;
  tempo += (Math.min(intervalo, 250) / 1000) * (calmo ? 0.6 : 1);

  // Sem ponteiro recente (ou com menos movimento), a gota principal passeia sozinha.
  if (calmo || agora - ultimoMovimento > 4000) {
    alvo.x = 0.5 + Math.sin(tempo * 0.45) * 0.28;
    alvo.y = 0.5 + Math.cos(tempo * 0.33) * 0.22;
  }
  ponteiro.x += (alvo.x - ponteiro.x) * 0.06;
  ponteiro.y += (alvo.y - ponteiro.y) * 0.06;

  redimensionar();
  const aspecto = canvas.width / canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(uniformes.tempo, tempo);
  gl.uniform2f(uniformes.resolucao, canvas.width, canvas.height);
  gl.uniform2f(uniformes.ponteiro, ponteiro.x, ponteiro.y);
  gl.uniform1f(uniformes.espalhamento, Math.min(1, Math.max(0.35, aspecto / 1.6)));
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  if (!raiz.classList.contains("webgl-pronto")) raiz.classList.add("webgl-pronto");
}

function laco(agora) {
  quadro = requestAnimationFrame(laco);
  desenhar(agora);
}

function parar() {
  cancelAnimationFrame(quadro);
  quadro = 0;
  anterior = 0;
  somaIntervalos = 0;
  quadrosMedidos = 0;
}

function retomar() {
  parar();
  if (!gl || gl.isContextLost() || document.hidden) return;
  quadro = requestAnimationFrame(laco);
}

function iniciar() {
  if (!canvas) return;
  const opcoes = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" };
  try {
    gl = canvas.getContext("webgl", opcoes) || canvas.getContext("experimental-webgl", opcoes);
  } catch {
    gl = null;
  }
  if (!gl || !preparar()) {
    gl = null;
    falhar();
    return;
  }

  window.addEventListener("pointermove", (evento) => {
    alvo.x = evento.clientX / window.innerWidth;
    alvo.y = 1 - evento.clientY / window.innerHeight;
    ultimoMovimento = performance.now();
  }, { passive: true });

  document.addEventListener("visibilitychange", retomar);

  canvas.addEventListener("webglcontextlost", (evento) => {
    evento.preventDefault();
    parar();
  });

  canvas.addEventListener("webglcontextrestored", () => {
    if (preparar()) {
      raiz.classList.remove("sem-webgl");
      retomar();
    } else {
      falhar();
    }
  });

  retomar();
}

iniciar();
