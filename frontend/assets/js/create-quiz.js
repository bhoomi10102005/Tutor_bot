import { APIError, createQuiz, listDocuments } from "../../components/api_client.js";
import { clearSession, getSession } from "../../components/session.js";

const session = getSession();
if (!session?.accessToken) {
  window.location.replace("./login.html");
  throw new Error("unauthenticated");
}

const { user } = session;

function getToken() {
  return getSession()?.accessToken || null;
}

const displayName = user?.username || user?.email || "";
const avatarEl = document.querySelector("[data-user-slot]");
if (avatarEl) {
  avatarEl.textContent = displayName.charAt(0).toUpperCase();
  avatarEl.title = displayName;
}

document.querySelector("[data-signout]").addEventListener("click", () => {
  clearSession();
  window.location.replace("./login.html");
});

const form = document.getElementById("create-quiz-form");
const createQuizBtn = document.getElementById("create-quiz-btn");
const createStatus = document.getElementById("create-status");
const topicInput = document.getElementById("topic-input");
const questionCountInput = document.getElementById("question-count-input");
const marksInput = document.getElementById("marks-input");
const difficultyInput = document.getElementById("difficulty-input");
const timeLimitInput = document.getElementById("time-limit-input");
const resultEmpty = document.getElementById("result-empty");
const resultContent = document.getElementById("result-content");
const resultTitle = document.getElementById("result-title");
const resultSubtitle = document.getElementById("result-subtitle");
const resultMeta = document.getElementById("result-meta");
const questionPreviewList = document.getElementById("question-preview-list");
const takeQuizLink = document.getElementById("take-quiz-link");
const chatScopeNote = document.getElementById("chat-scope-note");
const chatScopeTitle = document.getElementById("chat-scope-title");
const chatScopeBody = document.getElementById("chat-scope-body");
const quizSetupDesc = document.getElementById("quiz-setup-desc");
const scopeAllDocsInput = document.getElementById("scope-all-docs");
const scopeSelectedDocsInput = document.getElementById("scope-selected-docs");
const documentPicker = document.getElementById("document-picker");
const documentPickerList = document.getElementById("document-picker-list");
const documentPickerSummary = document.getElementById("document-picker-summary");

const urlParams = new URLSearchParams(window.location.search);
const fromChat = urlParams.get("from_chat") === "1";
const initialScopedDocumentIds = Array.from(
  new Set(
    urlParams
      .getAll("document_id")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);
const chatScopeMode = urlParams.get("chat_scope");

let readyDocuments = [];
let selectedDocumentIds = new Set(initialScopedDocumentIds);

initializeScopeNote();
initializeDocumentScope();
loadReadyDocuments();

form.addEventListener("submit", handleCreateQuiz);
scopeAllDocsInput?.addEventListener("change", handleScopeChange);
scopeSelectedDocsInput?.addEventListener("change", handleScopeChange);

async function handleCreateQuiz(event) {
  event.preventDefault();

  const topic = topicInput.value.trim();
  const questionCount = parseInt(questionCountInput.value, 10);
  const marks = parseFloat(marksInput.value);
  const timeLimitRaw = timeLimitInput.value.trim();
  const difficulty = difficultyInput.value;

  if (!topic) {
    setStatus("Topic is required.", "err");
    topicInput.focus();
    return;
  }
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
    setStatus("Question count must be between 1 and 20.", "err");
    questionCountInput.focus();
    return;
  }
  if (!Number.isFinite(marks) || marks <= 0) {
    setStatus("Total marks must be greater than 0.", "err");
    marksInput.focus();
    return;
  }

  let timeLimitSec;
  if (timeLimitRaw) {
    timeLimitSec = parseInt(timeLimitRaw, 10);
    if (!Number.isInteger(timeLimitSec) || timeLimitSec < 1) {
      setStatus("Time limit must be a positive number of seconds.", "err");
      timeLimitInput.focus();
      return;
    }
  }

  const payload = {
    topic,
    question_count: questionCount,
    marks,
    difficulty,
  };
  if (scopeSelectedDocsInput?.checked) {
    if (!readyDocuments.length) {
      setStatus("No ready documents are available to select yet.", "err");
      return;
    }
    if (!selectedDocumentIds.size) {
      setStatus("Select at least one document or switch to all ready documents.", "err");
      return;
    }
    payload.document_ids = [...selectedDocumentIds];
  }
  if (timeLimitSec) {
    payload.time_limit_sec = timeLimitSec;
  }

  createQuizBtn.disabled = true;
  setStatus("Generating quiz...");

  try {
    const response = await createQuiz(getToken(), payload);
    renderQuizResult(response.quiz, response.questions || []);
    setStatus("Quiz generated successfully.", "ok");
  } catch (error) {
    setStatus(
      error instanceof APIError ? error.message : "Failed to generate quiz.",
      "err",
    );
  } finally {
    createQuizBtn.disabled = false;
  }
}

function renderQuizResult(quiz, questions) {
  resultEmpty.hidden = true;
  resultContent.hidden = false;

  resultTitle.textContent = quiz?.title || "Quiz Ready";
  resultSubtitle.textContent = buildResultSubtitle(quiz);
  takeQuizLink.href = `./take-quiz.html?quiz_id=${encodeURIComponent(quiz.id)}`;

  resultMeta.innerHTML = [
    renderMetaTile("Topic", quiz?.spec?.topic || "-"),
    renderMetaTile("Difficulty", capitalize(quiz?.spec?.difficulty || "medium")),
    renderMetaTile("Questions", String(quiz?.question_count || questions.length || 0)),
    renderMetaTile("Total Marks", formatMarkValue(quiz?.total_marks)),
    renderMetaTile("Time Limit", formatDuration(quiz?.time_limit_sec)),
    renderMetaTile("Created", formatDateTime(quiz?.created_at)),
  ].join("");

  questionPreviewList.innerHTML = questions.map((question) => renderQuestionPreview(question)).join("");
  resultContent.scrollIntoView({ behavior: "smooth", block: "start" });
}

function initializeScopeNote() {
  if (!fromChat || !chatScopeNote || !chatScopeTitle || !chatScopeBody) {
    return;
  }

  chatScopeNote.hidden = false;
  chatScopeTitle.textContent = "Using this chat's study scope";

  if (initialScopedDocumentIds.length > 0) {
    chatScopeBody.textContent = `Using ${pluralize(initialScopedDocumentIds.length, "document")} from this chat for quiz generation.`;
    return;
  }

  if (chatScopeMode === "all") {
    chatScopeBody.textContent = "This chat is searching all ready documents, so this quiz will use all ready documents too.";
    return;
  }

  chatScopeBody.textContent = "This quiz will follow the document scope from the chat that sent you here.";
}

function initializeDocumentScope() {
  if (initialScopedDocumentIds.length > 0) {
    if (scopeSelectedDocsInput) scopeSelectedDocsInput.checked = true;
    if (scopeAllDocsInput) scopeAllDocsInput.checked = false;
  } else if (chatScopeMode === "all") {
    if (scopeAllDocsInput) scopeAllDocsInput.checked = true;
    if (scopeSelectedDocsInput) scopeSelectedDocsInput.checked = false;
  }

  syncDocumentPickerVisibility();
  updateScopeDescription();
}

async function loadReadyDocuments() {
  if (!documentPickerList || !documentPickerSummary) {
    return;
  }

  documentPickerList.innerHTML = '<p class="empty-state" style="padding:12px 0;">Loading documents...</p>';
  documentPickerSummary.textContent = "Loading documents...";

  try {
    const response = await listDocuments(getToken());
    const docs = Array.isArray(response?.documents)
      ? response.documents
      : Array.isArray(response)
      ? response
      : [];

    readyDocuments = docs.filter((doc) => Boolean(doc.current_ingestion_id));
    const readyIds = new Set(readyDocuments.map((doc) => doc.id));
    selectedDocumentIds = new Set(
      [...selectedDocumentIds].filter((docId) => readyIds.has(docId)),
    );

    renderDocumentPicker();
  } catch (error) {
    readyDocuments = [];
    documentPickerList.innerHTML = `<p class="empty-state" style="padding:12px 0;color:#a13716;">${
      error instanceof APIError ? escHtml(error.message) : "Failed to load documents."
    }</p>`;
    documentPickerSummary.textContent = "Unable to load documents";
  }
}

function renderDocumentPicker() {
  if (!documentPickerList || !documentPickerSummary) {
    return;
  }

  if (!readyDocuments.length) {
    documentPickerList.innerHTML = '<p class="empty-state" style="padding:12px 0;">No ready documents found yet.</p>';
    documentPickerSummary.textContent = "0 selected";
    return;
  }

  documentPickerList.innerHTML = readyDocuments.map((doc) => renderDocumentOption(doc)).join("");
  documentPickerSummary.textContent = buildDocumentSelectionSummary();

  documentPickerList.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      const docId = input.value;
      if (!docId) return;
      if (input.checked) {
        selectedDocumentIds.add(docId);
      } else {
        selectedDocumentIds.delete(docId);
      }
      documentPickerSummary.textContent = buildDocumentSelectionSummary();
    });
  });
}

function renderDocumentOption(doc) {
  const sourceLabel = doc.source_type === "upload" ? "PDF / File" : "Text";
  const isChecked = selectedDocumentIds.has(doc.id);
  return `
    <label class="document-picker-item" for="quiz-doc-${doc.id}">
      <input
        type="checkbox"
        id="quiz-doc-${doc.id}"
        value="${doc.id}"
        ${isChecked ? "checked" : ""}
      >
      <span>
        <span class="document-picker-title">${escHtml(doc.title || "Untitled")}</span>
        <span class="document-picker-meta">${escHtml(sourceLabel)}</span>
      </span>
    </label>
  `;
}

function handleScopeChange() {
  syncDocumentPickerVisibility();
  updateScopeDescription();
  if (documentPickerSummary) {
    documentPickerSummary.textContent = buildDocumentSelectionSummary();
  }
}

function syncDocumentPickerVisibility() {
  if (!documentPicker) {
    return;
  }
  documentPicker.hidden = !scopeSelectedDocsInput?.checked;
}

function buildDocumentSelectionSummary() {
  if (!scopeSelectedDocsInput?.checked) {
    return `${pluralize(readyDocuments.length, "ready document")} available`;
  }
  return `${pluralize(selectedDocumentIds.size, "document")} selected`;
}

function updateScopeDescription() {
  if (!quizSetupDesc) {
    return;
  }

  if (scopeSelectedDocsInput?.checked) {
    quizSetupDesc.textContent = "This quiz will only use the ready documents selected below.";
    return;
  }

  quizSetupDesc.textContent = "Use all ready documents in your workspace. Keep the prompt specific for better questions.";
}

function renderQuestionPreview(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return `
    <article class="question-preview">
      <div class="question-preview-head">
        <p class="question-preview-title">Q${Number(question.question_index) + 1}. ${escHtml(question.question_text || "")}</p>
        <span class="badge badge-ready">${formatMarkValue(question.marks)} marks</span>
      </div>
      <ul class="question-option-list">
        ${options.map((option, index) => `
          <li class="question-option">
            <strong>${indexToLabel(index)}.</strong> ${escHtml(option)}
          </li>
        `).join("")}
      </ul>
      <div class="question-source-count">
        ${pluralize(Array.isArray(question.sources) ? question.sources.length : 0, "source")} attached to this question.
      </div>
    </article>
  `;
}

function buildResultSubtitle(quiz) {
  const parts = [];
  if (quiz?.question_count != null) {
    parts.push(pluralize(quiz.question_count, "question"));
  }
  if (quiz?.total_marks != null) {
    parts.push(`${formatMarkValue(quiz.total_marks)} total marks`);
  }
  if (quiz?.spec?.difficulty) {
    parts.push(`${capitalize(quiz.spec.difficulty)} difficulty`);
  }
  return parts.join(" | ");
}

function renderMetaTile(label, value) {
  return `
    <div class="meta-tile">
      <span class="meta-tile-label">${escHtml(label)}</span>
      <span class="meta-tile-value">${escHtml(value)}</span>
    </div>
  `;
}

function setStatus(message, type = "") {
  createStatus.textContent = message;
  createStatus.className = "status-line" + (type ? ` ${type}` : "");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) {
    return "No limit";
  }

  const totalSeconds = Number(seconds);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds % 60 === 0) {
    return `${totalSeconds / 60} min`;
  }
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

function formatMarkValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(2).replace(/\.?0+$/, "");
}

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function indexToLabel(index) {
  return String.fromCharCode(65 + index);
}

function escHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
