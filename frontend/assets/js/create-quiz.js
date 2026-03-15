import { APIError, createQuiz } from "../../components/api_client.js";
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

const urlParams = new URLSearchParams(window.location.search);
const fromChat = urlParams.get("from_chat") === "1";
const scopedDocumentIds = Array.from(
  new Set(
    urlParams
      .getAll("document_id")
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);
const chatScopeMode = urlParams.get("chat_scope");

initializeScopeNote();

form.addEventListener("submit", handleCreateQuiz);

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
  if (scopedDocumentIds.length > 0) {
    payload.document_ids = scopedDocumentIds;
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

  if (scopedDocumentIds.length > 0) {
    if (quizSetupDesc) {
      quizSetupDesc.textContent = "This quiz will use the specific documents selected for the chat that sent you here.";
    }
    chatScopeBody.textContent = `Using ${pluralize(scopedDocumentIds.length, "document")} from this chat for quiz generation.`;
    return;
  }

  if (chatScopeMode === "all") {
    if (quizSetupDesc) {
      quizSetupDesc.textContent = "This quiz will use all ready documents, matching the current chat scope.";
    }
    chatScopeBody.textContent = "This chat is searching all ready documents, so this quiz will use all ready documents too.";
    return;
  }

  chatScopeBody.textContent = "This quiz will follow the document scope from the chat that sent you here.";
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
