import {
  APIError,
  getQuizAttempt,
  getQuizQuestions,
  listQuizzes,
  startQuizAttempt,
  submitQuizAttempt,
} from "../../components/api_client.js";
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

const quizListEl = document.getElementById("quiz-list");
const quizStageEl = document.getElementById("quiz-stage");
const refreshQuizzesBtn = document.getElementById("refresh-quizzes-btn");

const urlParams = new URLSearchParams(window.location.search);

let quizList = [];
let selectedQuiz = null;
let selectedQuestions = [];
let activeAttempt = null;
let submittedResult = null;
let activeAnswers = new Map();
let preferredQuizId = urlParams.get("quiz_id");
let attemptTimerId = null;
let attemptStartedAtMs = 0;
let isWorking = false;

refreshQuizzesBtn.addEventListener("click", () => {
  loadQuizzes();
});

loadQuizzes();

async function loadQuizzes() {
  refreshQuizzesBtn.disabled = true;
  quizListEl.innerHTML = '<p class="empty-state" style="padding:24px 0;">Loading...</p>';

  try {
    const response = await listQuizzes(getToken());
    quizList = Array.isArray(response?.quizzes) ? response.quizzes : [];
    renderQuizList();

    if (!quizList.length) {
      selectedQuiz = null;
      selectedQuestions = [];
      activeAttempt = null;
      submittedResult = null;
      stopAttemptTimer();
      renderEmptyStage(
        "No quizzes yet.",
        'Create your first quiz from <a href="./create-quiz.html">Create Quiz</a>.',
      );
      return;
    }

    const availableIds = new Set(quizList.map((quiz) => quiz.id));
    let targetQuizId = null;

    if (selectedQuiz?.id && availableIds.has(selectedQuiz.id)) {
      targetQuizId = selectedQuiz.id;
    } else if (preferredQuizId && availableIds.has(preferredQuizId)) {
      targetQuizId = preferredQuizId;
    } else {
      targetQuizId = quizList[0].id;
    }

    const shouldReloadSelection =
      !selectedQuiz ||
      selectedQuiz.id !== targetQuizId ||
      (!selectedQuestions.length && !activeAttempt && !submittedResult);

    if (shouldReloadSelection) {
      await selectQuiz(targetQuizId, { skipPrompt: true });
    } else {
      renderStage();
    }
  } catch (error) {
    quizListEl.innerHTML = `<p class="empty-state" style="padding:24px 0;color:#a13716;">${
      error instanceof APIError ? escHtml(error.message) : "Failed to load quizzes."
    }</p>`;
    renderEmptyStage("Unable to load quizzes.", "Refresh and try again.");
  } finally {
    refreshQuizzesBtn.disabled = false;
  }
}

function renderQuizList() {
  if (!quizList.length) {
    quizListEl.innerHTML = '<p class="empty-state" style="padding:24px 0;">No quizzes available.</p>';
    return;
  }

  quizListEl.innerHTML = quizList.map((quiz) => {
    const activeClass = quiz.id === selectedQuiz?.id ? " active" : "";
    return `
      <button class="quiz-list-item${activeClass}" type="button" data-quiz-id="${quiz.id}">
        <div class="quiz-list-title">${escHtml(quiz.title || "Untitled Quiz")}</div>
        <div class="quiz-list-meta">
          ${pluralize(quiz.question_count || 0, "question")} | ${formatMarkValue(quiz.total_marks)} marks<br>
          ${formatDateTime(quiz.created_at)}
        </div>
      </button>
    `;
  }).join("");

  quizListEl.querySelectorAll("[data-quiz-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextQuizId = button.dataset.quizId;
      if (!nextQuizId) return;
      await selectQuiz(nextQuizId);
    });
  });
}

async function selectQuiz(quizId, { skipPrompt = false } = {}) {
  if (!quizId) return;
  if (selectedQuiz?.id === quizId && selectedQuestions.length && !submittedResult && !activeAttempt) {
    renderStage();
    return;
  }
  if (!skipPrompt && hasInProgressAttempt() && selectedQuiz?.id !== quizId) {
    const confirmed = window.confirm(
      "You have an in-progress attempt. Switching quizzes will discard the current answers on this page. Continue?",
    );
    if (!confirmed) {
      return;
    }
  }

  const currentMeta = quizList.find((quiz) => quiz.id === quizId) || null;
  selectedQuiz = currentMeta;
  selectedQuestions = [];
  activeAttempt = null;
  submittedResult = null;
  activeAnswers = new Map();
  stopAttemptTimer();
  preferredQuizId = quizId;
  updateQuizQuery();
  renderQuizList();
  renderLoadingStage("Loading quiz...");

  try {
    const response = await getQuizQuestions(getToken(), quizId);
    selectedQuiz = response.quiz;
    selectedQuestions = Array.isArray(response.questions) ? response.questions : [];
    const latestSubmittedAttemptId = response?.latest_submitted_attempt_id || null;
    if (latestSubmittedAttemptId) {
      try {
        const attemptResponse = await getQuizAttempt(getToken(), latestSubmittedAttemptId);
        selectedQuiz = attemptResponse.quiz || selectedQuiz;
        selectedQuestions = Array.isArray(attemptResponse.questions)
          ? attemptResponse.questions
          : selectedQuestions;
        submittedResult = attemptResponse;
      } catch (_) {
        submittedResult = null;
      }
    }
    renderQuizList();
    renderStage();
  } catch (error) {
    renderEmptyStage(
      "Unable to load that quiz.",
      error instanceof APIError ? escHtml(error.message) : "Please try again.",
    );
  }
}

function renderStage() {
  if (!selectedQuiz) {
    renderEmptyStage("Select a quiz.", "Pick a quiz from the list to begin.");
    return;
  }
  if (submittedResult) {
    renderResultStage();
    return;
  }
  if (activeAttempt) {
    renderAttemptStage();
    return;
  }
  renderPreviewStage();
}

function renderPreviewStage(statusMessage = "") {
  quizStageEl.innerHTML = `
    <div class="quiz-stage-header">
      <div>
        <h2 class="quiz-stage-title">${escHtml(selectedQuiz.title || "Untitled Quiz")}</h2>
        <p class="quiz-stage-subtitle">${escHtml(getQuizIntroText(selectedQuiz))}</p>
      </div>
      <div>
        <button class="button button-solid" id="start-quiz-btn" type="button">Start Quiz</button>
      </div>
    </div>
    ${renderMetaGrid(selectedQuiz, [
      ["Topic", selectedQuiz?.spec?.topic || "-"],
      ["Difficulty", capitalize(selectedQuiz?.spec?.difficulty || "medium")],
      ["Questions", String(selectedQuiz?.question_count || selectedQuestions.length || 0)],
      ["Time Limit", formatDuration(selectedQuiz?.time_limit_sec)],
    ])}
    ${statusMessage ? `<p class="status-line err">${escHtml(statusMessage)}</p>` : ""}
    <div>
      ${selectedQuestions.map((question) => renderQuestionPreview(question)).join("")}
    </div>
  `;

  const startQuizBtn = document.getElementById("start-quiz-btn");
  if (startQuizBtn) {
    startQuizBtn.addEventListener("click", () => {
      beginAttempt();
    });
  }
}

async function beginAttempt() {
  if (!selectedQuiz || isWorking) return;
  isWorking = true;
  renderLoadingStage("Starting your attempt...");

  try {
    const response = await startQuizAttempt(getToken(), selectedQuiz.id);
    selectedQuiz = response.quiz;
    selectedQuestions = Array.isArray(response.questions) ? response.questions : [];
    activeAttempt = response.attempt;
    submittedResult = null;
    activeAnswers = new Map();
    attemptStartedAtMs = parseAttemptStartMs(response.attempt?.started_at);
    startAttemptTimer();
    renderQuizList();
    renderStage();
  } catch (error) {
    renderPreviewStage(
      error instanceof APIError ? error.message : "Failed to start quiz.",
    );
  } finally {
    isWorking = false;
  }
}

function renderAttemptStage() {
  quizStageEl.innerHTML = `
    <div class="quiz-stage-header">
      <div>
        <h2 class="quiz-stage-title">${escHtml(selectedQuiz.title || "Untitled Quiz")}</h2>
        <p class="quiz-stage-subtitle">Answer the questions below, then submit when you are ready.</p>
      </div>
      <div>
        <button class="button button-ghost" id="cancel-attempt-btn" type="button">Back to Preview</button>
      </div>
    </div>
    ${renderMetaGrid(selectedQuiz, [
      ["Topic", selectedQuiz?.spec?.topic || "-"],
      ["Difficulty", capitalize(selectedQuiz?.spec?.difficulty || "medium")],
      ["Questions", String(selectedQuiz?.question_count || selectedQuestions.length || 0)],
      ["Time Limit", formatDuration(selectedQuiz?.time_limit_sec)],
    ])}
    <div class="attempt-toolbar">
      <div class="attempt-timer" id="attempt-timer">${buildAttemptTimerText()}</div>
      <div class="muted">${pluralize(getAnsweredCount(), "question")} answered so far.</div>
    </div>
    <form id="quiz-attempt-form" novalidate>
      ${selectedQuestions.map((question) => renderAttemptQuestion(question)).join("")}
      <div class="submit-row">
        <button class="button button-solid" id="submit-quiz-btn" type="submit">Submit Quiz</button>
        <span class="status-line" id="submit-status"></span>
      </div>
    </form>
  `;

  quizStageEl.querySelectorAll("input[type=radio]").forEach((input) => {
    input.addEventListener("change", () => {
      const questionId = input.dataset.questionId;
      const optionIndex = Number.parseInt(input.value, 10);
      if (!questionId || !Number.isInteger(optionIndex)) return;
      activeAnswers.set(questionId, optionIndex);
      updateAttemptStatusText();
    });
  });

  const quizAttemptForm = document.getElementById("quiz-attempt-form");
  if (quizAttemptForm) {
    quizAttemptForm.addEventListener("submit", submitCurrentAttempt);
  }

  const cancelAttemptBtn = document.getElementById("cancel-attempt-btn");
  if (cancelAttemptBtn) {
    cancelAttemptBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        "Discard this in-progress attempt and go back to the quiz preview?",
      );
      if (!confirmed) return;
      activeAttempt = null;
      activeAnswers = new Map();
      stopAttemptTimer();
      renderStage();
    });
  }
}

async function submitCurrentAttempt(event) {
  event.preventDefault();
  if (!selectedQuiz || !activeAttempt || isWorking) return;

  isWorking = true;
  const submitBtn = document.getElementById("submit-quiz-btn");
  const submitStatus = document.getElementById("submit-status");
  if (submitBtn) submitBtn.disabled = true;
  if (submitStatus) {
    submitStatus.textContent = "Submitting quiz...";
    submitStatus.className = "status-line";
  }

  const answers = selectedQuestions.reduce((items, question) => {
    if (!activeAnswers.has(question.id)) {
      return items;
    }
    items.push({
      question_id: question.id,
      chosen_option_index: activeAnswers.get(question.id),
    });
    return items;
  }, []);

  try {
    const response = await submitQuizAttempt(getToken(), selectedQuiz.id, activeAttempt.id, {
      time_spent_sec: getElapsedSeconds(),
      answers,
    });
    selectedQuiz = response.quiz;
    selectedQuestions = Array.isArray(response.questions) ? response.questions : selectedQuestions;
    activeAttempt = response.attempt;
    submittedResult = response;
    stopAttemptTimer();
    renderStage();
  } catch (error) {
    if (submitStatus) {
      submitStatus.textContent =
        error instanceof APIError ? error.message : "Failed to submit quiz.";
      submitStatus.className = "status-line err";
    }
    if (submitBtn) submitBtn.disabled = false;
  } finally {
    isWorking = false;
  }
}

function renderResultStage() {
  const result = submittedResult;
  const score = Number(result?.score ?? result?.attempt?.score ?? 0);
  const totalMarks = Number(
    result?.total_marks ?? result?.attempt?.total_marks ?? selectedQuiz?.total_marks ?? 0,
  );
  const accuracy = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const summary = result?.summary || result?.attempt?.summary || null;

  quizStageEl.innerHTML = `
    <div class="quiz-stage-header">
      <div>
        <h2 class="quiz-stage-title">${escHtml(selectedQuiz.title || "Quiz Result")}</h2>
        <p class="quiz-stage-subtitle">Your attempt is graded. Review the explanations below.</p>
      </div>
      <div>
        <button class="button button-solid" id="retake-quiz-btn" type="button">Retake Quiz</button>
      </div>
    </div>
    ${renderMetaGrid(selectedQuiz, [
      ["Score", `${formatMarkValue(score)} / ${formatMarkValue(totalMarks)}`],
      ["Accuracy", `${accuracy}%`],
      ["Time Spent", formatDuration(result?.attempt?.time_spent_sec)],
      ["Questions", String(selectedQuiz?.question_count || selectedQuestions.length || 0)],
    ])}
    ${renderSummary(summary)}
    <div style="margin-top:20px;">
      ${(Array.isArray(result?.answers) ? result.answers : []).map((answer) => renderReviewCard(answer)).join("")}
    </div>
  `;

  const retakeQuizBtn = document.getElementById("retake-quiz-btn");
  if (retakeQuizBtn) {
    retakeQuizBtn.addEventListener("click", () => {
      beginAttempt();
    });
  }
}

function renderSummary(summary) {
  if (!summary) {
    return "";
  }

  const blocks = [];
  if (summary.overall) {
    blocks.push(`
      <section class="summary-block">
        <h3>Overall</h3>
        <p>${escHtml(summary.overall)}</p>
      </section>
    `);
  }
  if (Array.isArray(summary.strengths) && summary.strengths.length) {
    blocks.push(`
      <section class="summary-block">
        <h3>Strengths</h3>
        <ul>${summary.strengths.map((item) => `<li>${escHtml(item)}</li>`).join("")}</ul>
      </section>
    `);
  }
  if (Array.isArray(summary.improvements) && summary.improvements.length) {
    blocks.push(`
      <section class="summary-block">
        <h3>Improvements</h3>
        <ul>${summary.improvements.map((item) => `<li>${escHtml(item)}</li>`).join("")}</ul>
      </section>
    `);
  }
  if (summary.recommended_next_step) {
    blocks.push(`
      <section class="summary-block">
        <h3>Recommended Next Step</h3>
        <p>${escHtml(summary.recommended_next_step)}</p>
      </section>
    `);
  }

  if (!blocks.length) {
    return "";
  }

  return `<div class="result-summary">${blocks.join("")}</div>`;
}

function renderReviewCard(answer) {
  const chosenText = answer?.chosen_json
    ? formatChoice(answer.options, answer.chosen_json)
    : "Not answered";
  const correctText = answer?.correct_json
    ? formatChoice(answer.options, answer.correct_json)
    : "-";
  const badge = getReviewBadge(answer?.is_correct);
  const sourceCount = Array.isArray(answer?.sources) ? answer.sources.length : 0;

  return `
    <article class="question-card">
      <div class="question-card-head">
        <p class="question-card-title">Q${Number(answer.question_index) + 1}. ${escHtml(answer.question_text || "")}</p>
        <span class="review-badge ${badge.className}">${badge.label}</span>
      </div>
      <div class="question-card-meta">
        ${formatMarkValue(answer.marks_awarded)} / ${formatMarkValue(answer.marks)} marks | ${pluralize(sourceCount, "source")}
      </div>
      <div class="review-line"><strong>Your answer:</strong> ${escHtml(chosenText)}</div>
      <div class="review-line"><strong>Correct answer:</strong> ${escHtml(correctText)}</div>
      <div class="review-line"><strong>Explanation:</strong> ${escHtml(answer.explanation || "No explanation provided.")}</div>
    </article>
  `;
}

function renderQuestionPreview(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return `
    <article class="question-card">
      <div class="question-card-head">
        <p class="question-card-title">Q${Number(question.question_index) + 1}. ${escHtml(question.question_text || "")}</p>
        <span class="badge badge-ready">${formatMarkValue(question.marks)} marks</span>
      </div>
      <div class="question-card-meta">${pluralize(Array.isArray(question.sources) ? question.sources.length : 0, "source")}</div>
      <div class="option-list">
        ${options.map((option, index) => `
          <div class="option-label" style="cursor:default;">
            <span><strong>${indexToLabel(index)}.</strong> ${escHtml(option)}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderAttemptQuestion(question) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return `
    <article class="question-card">
      <div class="question-card-head">
        <p class="question-card-title">Q${Number(question.question_index) + 1}. ${escHtml(question.question_text || "")}</p>
        <span class="badge badge-ready">${formatMarkValue(question.marks)} marks</span>
      </div>
      <div class="question-card-meta">${pluralize(Array.isArray(question.sources) ? question.sources.length : 0, "source")} available for this question.</div>
      <div class="option-list">
        ${options.map((option, index) => `
          <label class="option-label">
            <input
              type="radio"
              name="question-${question.id}"
              value="${index}"
              data-question-id="${question.id}"
              ${activeAnswers.get(question.id) === index ? "checked" : ""}
            >
            <span><strong>${indexToLabel(index)}.</strong> ${escHtml(option)}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

function renderMetaGrid(quiz, items) {
  return `
    <div class="quiz-meta-grid">
      ${items.map(([label, value]) => `
        <div class="meta-tile">
          <span class="meta-tile-label">${escHtml(label)}</span>
          <span class="meta-tile-value">${escHtml(value)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderLoadingStage(message) {
  quizStageEl.innerHTML = `
    <div class="empty-stage">
      ${escHtml(message)}
    </div>
  `;
}

function renderEmptyStage(title, message) {
  quizStageEl.innerHTML = `
    <div class="empty-stage">
      <h2 style="margin:0 0 8px;font-family:'Sora',sans-serif;font-size:1.2rem;color:var(--ink);">${escHtml(title)}</h2>
      <p style="margin:0;font-size:0.94rem;line-height:1.6;">${message}</p>
    </div>
  `;
}

function hasInProgressAttempt() {
  return Boolean(activeAttempt && !submittedResult);
}

function parseAttemptStartMs(value) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function startAttemptTimer() {
  stopAttemptTimer();
  updateAttemptTimer();
  attemptTimerId = window.setInterval(() => {
    updateAttemptTimer();
  }, 1000);
}

function stopAttemptTimer() {
  if (attemptTimerId) {
    window.clearInterval(attemptTimerId);
    attemptTimerId = null;
  }
}

function updateAttemptTimer() {
  const timerEl = document.getElementById("attempt-timer");
  if (timerEl) {
    timerEl.textContent = buildAttemptTimerText();
  }
}

function updateAttemptStatusText() {
  const toolbarText = quizStageEl.querySelector(".attempt-toolbar .muted");
  if (toolbarText) {
    toolbarText.textContent = `${pluralize(getAnsweredCount(), "question")} answered so far.`;
  }
}

function buildAttemptTimerText() {
  const elapsed = formatClock(getElapsedSeconds());
  const limit = selectedQuiz?.time_limit_sec
    ? ` / ${formatClock(Number(selectedQuiz.time_limit_sec))}`
    : "";
  return `Elapsed ${elapsed}${limit}`;
}

function getElapsedSeconds() {
  if (!attemptStartedAtMs) return 0;
  return Math.max(0, Math.floor((Date.now() - attemptStartedAtMs) / 1000));
}

function getAnsweredCount() {
  return activeAnswers.size;
}

function updateQuizQuery() {
  const nextUrl = preferredQuizId
    ? `./take-quiz.html?quiz_id=${encodeURIComponent(preferredQuizId)}`
    : "./take-quiz.html";
  window.history.replaceState({}, "", nextUrl);
}

function getQuizIntroText(quiz) {
  if (quiz?.instructions) {
    return quiz.instructions;
  }
  const topic = quiz?.spec?.topic;
  return topic ? `Quiz topic: ${topic}` : "Preview the questions before you begin.";
}

function getReviewBadge(isCorrect) {
  if (isCorrect === true) {
    return { className: "correct", label: "Correct" };
  }
  if (isCorrect === false) {
    return { className: "incorrect", label: "Incorrect" };
  }
  return { className: "unanswered", label: "Unanswered" };
}

function formatChoice(options, payload) {
  if (!payload) return "Not answered";
  if (typeof payload.option_text === "string" && payload.option_text.trim()) {
    const prefix = Number.isInteger(payload.option_index)
      ? `${indexToLabel(payload.option_index)}. `
      : "";
    return `${prefix}${payload.option_text}`;
  }
  if (Number.isInteger(payload.option_index) && Array.isArray(options)) {
    const optionText = options[payload.option_index];
    if (optionText !== undefined) {
      return `${indexToLabel(payload.option_index)}. ${optionText}`;
    }
  }
  return "Not answered";
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
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "No limit";
  }
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds % 60 === 0) {
    return `${totalSeconds / 60} min`;
  }
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
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
