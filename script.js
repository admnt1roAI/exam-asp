const TOTAL_PREGUNTAS = 30;
let preguntas = [];
const cuestionario = document.getElementById("cuestionario");
const listaPreguntas = document.getElementById("questions-list");
const estado = document.getElementById("status");
const resultado = document.getElementById("resultado");
const botonEnviar = document.getElementById("guardar");
const botonNuevo = document.getElementById("reiniciar");
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbwCrLz9VpKlwMgLo1enuQRZhXDrg1hfTWiG_AdtA8DScamLSofI9eeuWUleLaHSdH8JaA/exec";

function apiUrl() {
  const base = window.EXAM_CONFIG?.supabaseUrl?.trim();
  if (!base || base.includes("TU-PROYECTO") || !window.EXAM_CONFIG?.supabaseKey || window.EXAM_CONFIG.supabaseKey.includes("TU_CLAVE")) {
    throw new Error("Configura la URL y la clave publishable de Supabase en config.js.");
  }
  return `${base.replace(/\/$/, "")}/functions/v1/asp-exam`;
}

async function llamarFuncion(options = {}) {
  const response = await fetch(apiUrl(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: window.EXAM_CONFIG.supabaseKey,
      Authorization: `Bearer ${window.EXAM_CONFIG.supabaseKey}`,
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No se pudo contactar con Supabase.");
  return body;
}

function mostrarPreguntas() {
  listaPreguntas.replaceChildren();
  preguntas.forEach((question, index) => {
    const card = document.createElement("article");
    card.className = "q-card";
    const title = document.createElement("h2");
    title.className = "q-title";
    title.textContent = `Pregunta ${index + 1}`;
    const text = document.createElement("p");
    text.className = "question-text";
    text.textContent = question.question;
    const options = document.createElement("div");
    options.className = "options";
    question.options.forEach((option, optionIndex) => {
      const letter = String.fromCharCode(97 + optionIndex);
      const label = document.createElement("label");
      label.className = "opt";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `q${question.id}`;
      radio.value = letter;
      radio.required = true;
      label.append(radio, document.createTextNode(`${letter}) ${option}`));
      options.append(label);
    });
    card.append(title, text, options);
    listaPreguntas.append(card);
  });
  document.getElementById("exam-count").textContent = String(preguntas.length);
}

async function cargarExamen() {
  estado.hidden = false;
  estado.classList.remove("success");
  estado.textContent = "Cargando preguntas…";
  cuestionario.hidden = true;
  resultado.hidden = true;
  botonNuevo.hidden = true;
  try {
    const data = await llamarFuncion({ method: "GET", cache: "no-store" });
    if (data.enabled === false) {
      estado.textContent = data.message || "El examen está apagado temporalmente. Consulta con el administrador.";
      botonNuevo.hidden = true;
      return;
    }
    preguntas = data.questions || [];
    if (!preguntas.length) throw new Error("Supabase no devolvió preguntas. Revisa que el banco se haya importado.");
    mostrarPreguntas();
    estado.hidden = true;
    cuestionario.hidden = false;
    botonEnviar.disabled = false;
  } catch (error) {
    estado.textContent = error.message;
    botonNuevo.hidden = false;
  }
}

function crearDetalle(detail) {
  const card = document.createElement("article");
  card.className = `answer-card ${detail.correct ? "is-correct" : "is-incorrect"}`;
  const heading = document.createElement("h3");
  heading.textContent = `Pregunta ${detail.index}: ${detail.correct ? "Correcta" : "Incorrecta"}`;
  const question = document.createElement("p");
  question.className = "answer-question";
  question.textContent = detail.question;
  const selected = document.createElement("p");
  selected.className = `answer-selected ${detail.correct ? "is-correct" : "is-incorrect"}`;
  selected.textContent = `Tu respuesta: ${detail.selected.toUpperCase()}) ${detail.selectedText}`;
  const correct = document.createElement("p");
  correct.className = "correct-answer";
  correct.textContent = `Respuesta correcta: ${detail.correctAnswer.toUpperCase()}) ${detail.correctText}`;
  const explanation = document.createElement("p");
  explanation.className = "answer-explanation";
  explanation.textContent = `Explicación: ${detail.explanation || "Sin explicación disponible."}`;
  card.append(heading, question, selected, correct, explanation);
  return card;
}

cuestionario.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cuestionario.reportValidity()) return;
  const nombre = document.getElementById("nombre").value.trim().toLocaleUpperCase("es");
  const dni = document.getElementById("dni").value.trim();
  if (!/^\d{8}$/.test(dni)) {
    estado.hidden = false;
    estado.textContent = "Ingresa un DNI de 8 dígitos.";
    return;
  }
  botonEnviar.disabled = true;
  estado.hidden = false;
  estado.classList.remove("success");
  estado.textContent = "Enviando respuestas y calculando puntaje…";
  const answers = preguntas.map((question) => ({
    id: question.id,
    answer: cuestionario.querySelector(`input[name="q${question.id}"]:checked`)?.value || ""
  }));
  try {
    const data = await llamarFuncion({ method: "POST", body: JSON.stringify({ answers }) });
    estado.hidden = true;
    cuestionario.hidden = true;
    resultado.replaceChildren();
    const summary = document.createElement("h2");
    summary.textContent = `Tu puntaje: ${data.score} / ${data.total}`;
    resultado.append(summary, ...data.details.map(crearDetalle));
    resultado.hidden = false;
    botonNuevo.hidden = false;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fecha = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const record = { fecha, nombre, dni, puntaje: data.score, detalles: data.details.map((item) => ({ id: item.id, selected: item.selected || "", correct: item.correct })) };
    estado.hidden = false;
    estado.textContent = "Examen calificado. Enviando el resultado a Google Sheets…";
    try {
      await fetch(GOOGLE_SHEETS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(record) });
      estado.classList.add("success");
      estado.textContent = "Examen calificado y envío solicitado a Google Sheets. Confirma que aparezca una nueva fila.";
    } catch (error) {
      estado.textContent = "El examen se calificó, pero no se pudo enviar el resultado a Google Sheets.";
      console.error("Error al enviar a Google Sheets:", error);
    }
  } catch (error) {
    estado.textContent = error.message;
    botonEnviar.disabled = false;
    if (error.message.includes("apagado temporalmente")) {
      cuestionario.hidden = true;
      botonNuevo.hidden = true;
    }
  }
});

botonNuevo.addEventListener("click", cargarExamen);
cargarExamen();
