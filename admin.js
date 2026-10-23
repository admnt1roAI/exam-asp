const config = window.EXAM_CONFIG;
const loginPanel = document.getElementById("login-panel");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const questionForm = document.getElementById("question-form");
const loginMessage = document.getElementById("login-message");
const adminMessage = document.getElementById("admin-message");
const questionList = document.getElementById("question-list");
const saveButton = document.getElementById("save-question");
const cancelEdit = document.getElementById("cancel-edit");
const examState = document.getElementById("exam-state");
const toggleExamButton = document.getElementById("toggle-exam");
const questionLimitForm = document.getElementById("question-limit-form");
const questionLimitInput = document.getElementById("exam-question-limit");
const saveQuestionLimitButton = document.getElementById("save-question-limit");
const questionLimitMessage = document.getElementById("question-limit-message");
let client;
let questions = [];
let examEnabled = false;
let examQuestionCount = 30;

function showMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
  element.hidden = false;
}

function showExamState(enabled, message) {
  examEnabled = enabled;
  examState.textContent = message || (enabled ? "Examen público ENCENDIDO" : "Examen público APAGADO");
  examState.classList.toggle("is-enabled", enabled);
  examState.classList.toggle("is-disabled", !enabled);
  toggleExamButton.textContent = enabled ? "APAGAR EXAMEN" : "ENCENDER EXAMEN";
  toggleExamButton.classList.toggle("is-enabled", enabled);
  toggleExamButton.classList.toggle("is-disabled", !enabled);
  toggleExamButton.disabled = false;
}

function formData() {
  return {
    question: document.getElementById("question-text").value.trim(),
    options: ["a", "b", "c", "d"].map((letter) => document.getElementById(`option-${letter}`).value.trim()),
    answer: document.getElementById("correct-answer").value,
    explanation: document.getElementById("explanation").value.trim()
  };
}

function clearForm() {
  questionForm.reset();
  document.getElementById("question-id").value = "";
  document.getElementById("editor-title").textContent = "Agregar pregunta";
  saveButton.textContent = "Guardar pregunta";
  cancelEdit.hidden = true;
}

async function verifyAdmin() {
  const { data, error } = await client.rpc("is_asp_admin");
  if (error) throw error;
  if (data !== true) throw new Error("Esta cuenta no está autorizada como administradora ASP.");
}

async function loadExamSetting() {
  examState.textContent = "Consultando estado…";
  toggleExamButton.disabled = true;
  const { data, error } = await client.from("asp_exam_settings").select("enabled,question_count").eq("id", 1).single();
  if (error) {
    examState.textContent = `No se pudo consultar el estado: ${error.message}`;
    throw error;
  }
  examQuestionCount = Number(data.question_count);
  questionLimitInput.value = String(examQuestionCount);
  showExamState(data.enabled);
  updateQuestionLimitMessage();
}

function updateQuestionLimitMessage(message) {
  questionLimitMessage.classList.remove("error");
  if (message) {
    questionLimitMessage.textContent = message;
    return;
  }
  const actualCount = Math.min(examQuestionCount, questions.length);
  questionLimitMessage.textContent = `Configurado: ${examQuestionCount} preguntas. Banco actual: ${questions.length}. En cada examen se mostrarán ${actualCount}.`;
}

async function enterAdmin(session) {
  try {
    await verifyAdmin();
    loginPanel.hidden = true;
    adminPanel.hidden = false;
    document.getElementById("admin-email").textContent = session.user.email || "Cuenta autorizada";
    await loadExamSetting();
    await loadQuestions();
  } catch (error) {
    if (!adminPanel.hidden) showMessage(adminMessage, "No se pudo cargar el control del examen. Ejecuta la migración nueva en Supabase y vuelve a ingresar.");
    else {
      await client.auth.signOut();
      showMessage(loginMessage, error.message || "No se pudo validar el acceso.");
    }
  }
}

async function loadQuestions() {
  showMessage(adminMessage, "Cargando preguntas…");
  const { data, error } = await client.from("asp_questions").select("id,question,options,answer,explanation").order("id");
  if (error) {
    showMessage(adminMessage, `No se pudo cargar el banco: ${error.message}`);
    return;
  }
  questions = data || [];
  document.getElementById("question-count").textContent = String(questions.length);
  updateQuestionLimitMessage();
  renderQuestions();
  adminMessage.hidden = true;
}

function renderQuestions() {
  const query = document.getElementById("search-questions").value.trim().toLocaleLowerCase("es");
  const filtered = questions.filter((item) => `${item.id} ${item.question}`.toLocaleLowerCase("es").includes(query));
  questionList.replaceChildren();
  if (!filtered.length) {
    const p = document.createElement("p");
    p.textContent = query ? "No hay coincidencias." : "Todavía no hay preguntas.";
    questionList.append(p);
    return;
  }
  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "question-item";
    const heading = document.createElement("h3");
    heading.textContent = `ID ${item.id}: ${item.question}`;
    const list = document.createElement("ol");
    list.type = "a";
    item.options.forEach((text, index) => {
      const option = document.createElement("li");
      option.textContent = text;
      if (String.fromCharCode(97 + index) === item.answer) option.className = "correct-option";
      list.append(option);
    });
    const explanation = document.createElement("p");
    explanation.textContent = `Explicación: ${item.explanation || "Sin explicación"}`;
    const actions = document.createElement("div");
    actions.className = "item-actions";
    for (const [action, label] of [["edit", "Editar"], ["delete", "Eliminar"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.action = action;
      button.dataset.id = String(item.id);
      if (action === "delete") button.className = "delete-button";
      actions.append(button);
    }
    card.append(heading, list, explanation, actions);
    questionList.append(card);
  }
}

function beginEdit(id) {
  const item = questions.find((question) => question.id === id);
  if (!item) return;
  document.getElementById("question-id").value = String(item.id);
  document.getElementById("question-text").value = item.question;
  ["a", "b", "c", "d"].forEach((letter, index) => {
    document.getElementById(`option-${letter}`).value = item.options[index] || "";
  });
  document.getElementById("correct-answer").value = item.answer;
  document.getElementById("explanation").value = item.explanation || "";
  document.getElementById("editor-title").textContent = `Editar pregunta ID ${item.id}`;
  saveButton.textContent = "Guardar cambios";
  cancelEdit.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (!config?.supabaseUrl || !config?.supabaseKey || !window.supabase?.createClient) {
  showMessage(loginMessage, "Configura Supabase en config.js y verifica que cargue su biblioteca.");
} else {
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("login-button");
    button.disabled = true;
    loginMessage.hidden = true;
    const { data, error } = await client.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    });
    button.disabled = false;
    if (error) {
      showMessage(loginMessage, "No se pudo iniciar sesión. Revisa los datos.");
      return;
    }
    await enterAdmin(data.session);
  });

  toggleExamButton.addEventListener("click", async () => {
    toggleExamButton.disabled = true;
    examState.textContent = "Guardando cambio…";
    const { data, error } = await client.from("asp_exam_settings")
      .update({ enabled: !examEnabled }).eq("id", 1).select("enabled").single();
    if (error) {
      showExamState(examEnabled, "No se pudo cambiar el estado. Revisa la migración y los permisos.");
      return;
    }
    showExamState(data.enabled, data.enabled ? "Examen público ENCENDIDO" : "Examen público APAGADO");
  });

  questionLimitForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const requestedCount = Number(questionLimitInput.value);
    if (!Number.isSafeInteger(requestedCount) || requestedCount < 1 || requestedCount > 2147483647) {
      questionLimitInput.setCustomValidity("Ingresa una cantidad entera mayor que cero.");
      questionLimitInput.reportValidity();
      questionLimitInput.setCustomValidity("");
      return;
    }
    saveQuestionLimitButton.disabled = true;
    questionLimitMessage.textContent = "Guardando cantidad…";
    const { data, error } = await client.from("asp_exam_settings")
      .update({ question_count: requestedCount }).eq("id", 1).select("question_count").single();
    saveQuestionLimitButton.disabled = false;
    if (error) {
      questionLimitMessage.classList.add("error");
      questionLimitMessage.textContent = `No se pudo guardar la cantidad: ${error.message}`;
      return;
    }
    examQuestionCount = Number(data.question_count);
    questionLimitInput.value = String(examQuestionCount);
    updateQuestionLimitMessage("Cantidad guardada. La próxima carga del examen usará este número.");
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    await client.auth.signOut();
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    loginForm.reset();
  });

  questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = formData();
    if (payload.options.some((option) => !option)) {
      showMessage(adminMessage, "Completa las cuatro alternativas.");
      return;
    }
    saveButton.disabled = true;
    const id = document.getElementById("question-id").value;
    const query = id
      ? client.from("asp_questions").update(payload).eq("id", Number(id))
      : client.from("asp_questions").insert(payload);
    const { error } = await query;
    saveButton.disabled = false;
    if (error) {
      showMessage(adminMessage, `No se pudo guardar: ${error.message}`);
      return;
    }
    clearForm();
    await loadQuestions();
    showMessage(adminMessage, id ? "Pregunta actualizada." : "Pregunta agregada.", true);
  });

  cancelEdit.addEventListener("click", clearForm);
  document.getElementById("search-questions").addEventListener("input", renderQuestions);
  questionList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "edit") return beginEdit(id);
    if (!window.confirm(`¿Eliminar la pregunta ID ${id}?`)) return;
    button.disabled = true;
    const { error } = await client.from("asp_questions").delete().eq("id", id);
    if (error) {
      button.disabled = false;
      showMessage(adminMessage, `No se pudo eliminar: ${error.message}`);
      return;
    }
    await loadQuestions();
    showMessage(adminMessage, `Pregunta ID ${id} eliminada.`, true);
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) showMessage(loginMessage, "No se pudo recuperar la sesión.");
    else if (data.session) enterAdmin(data.session);
  });
}
