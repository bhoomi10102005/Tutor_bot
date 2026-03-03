import {
  APIError,
  createChatSession,
  listChatSessions,
  getChatMessages,
  sendChatMessage,
} from "../../components/api_client.js";
import { clearSession, getSession } from "../../components/session.js";

// ── Auth guard ────────────────────────────────────────────────────────────────
const session = getSession();
if (!session?.accessToken) {
  window.location.replace("./login.html");
  throw new Error("unauthenticated");
}

const { user } = session;

// ── Token accessor — always reads current value (may be refreshed in background) ──
function getToken() {
  const s = getSession();
  return s?.accessToken || null;
}

// ── Topbar ────────────────────────────────────────────────────────────────────
document.querySelector("[data-user-slot]").textContent =
  user?.username || user?.email || "";
document.querySelector("[data-signout]").addEventListener("click", () => {
  clearSession();
  window.location.replace("./login.html");
});

// ── DOM refs ──────────────────────────────────────────────────────────────────
const newChatBtn       = document.getElementById("new-chat-btn");
const sessionListEl    = document.getElementById("session-list");
const chatMessagesEl   = document.getElementById("chat-messages");
const chatPlaceholder  = document.getElementById("chat-placeholder");
const typingIndicator  = document.getElementById("typing-indicator");
const chatInput        = document.getElementById("chat-input");
const sendBtn          = document.getElementById("send-btn");

// ── State ─────────────────────────────────────────────────────────────────────
let activeChatId = null;
let isSending    = false;

// ── Session list ──────────────────────────────────────────────────────────────
async function loadSessions() {
  sessionListEl.innerHTML =
    '<p style="padding:10px 12px;color:var(--muted);font-size:0.88rem;">Loading…</p>';
  try {
    const resp = await listChatSessions(getToken());
    const sessions = Array.isArray(resp) ? resp : [];
    renderSessionList(sessions);
  } catch (err) {
    sessionListEl.innerHTML =
      `<p style="padding:10px 12px;color:#a13716;font-size:0.86rem;">${
        err instanceof APIError ? err.message : "Failed to load sessions."
      }</p>`;
  }
}

function renderSessionList(sessions) {
  sessionListEl.innerHTML = "";
  if (!sessions.length) {
    sessionListEl.innerHTML =
      '<p style="padding:10px 12px;color:var(--muted);font-size:0.86rem;">No chats yet. Click + New to start.</p>';
    return;
  }
  sessions.forEach((s) => {
    const btn = buildSessionButton(s);
    sessionListEl.appendChild(btn);
  });
}

function buildSessionButton(session) {
  const btn = document.createElement("button");
  btn.className = "session-item";
  btn.dataset.chatId = session.id;
  if (session.id === activeChatId) btn.classList.add("active");

  const date = new Date(session.updated_at).toLocaleDateString();
  btn.innerHTML = `
    ${escHtml(session.title)}
    <span class="session-item-meta">${date}</span>
  `.trim();

  btn.addEventListener("click", () => switchSession(session.id));
  return btn;
}

function prependSessionToList(session) {
  // Remove existing button if present (update)
  const existing = sessionListEl.querySelector(`[data-chat-id="${session.id}"]`);
  if (existing) existing.remove();

  // Remove placeholder message if present
  const placeholder = sessionListEl.querySelector("p");
  if (placeholder) placeholder.remove();

  const btn = buildSessionButton(session);
  sessionListEl.prepend(btn);
}

function setActiveSessionButton(chatId) {
  sessionListEl.querySelectorAll(".session-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.chatId === chatId);
  });
}

// ── Switch session ────────────────────────────────────────────────────────────
async function switchSession(chatId) {
  if (isSending) return;
  activeChatId = chatId;
  setActiveSessionButton(chatId);
  enableInput(false);
  clearMessages();
  showPlaceholder(false);

  appendLoadingBubble("Loading messages…");

  try {
    const resp = await getChatMessages(getToken(), chatId);
    const messages = Array.isArray(resp) ? resp : [];
    clearMessages();
    if (!messages.length) {
      showPlaceholder(true, "New chat", "Ask your first question below.");
    } else {
      messages.forEach((m) => appendMessage(m));
      scrollToBottom();
    }
  } catch (err) {
    clearMessages();
    appendError(err instanceof APIError ? err.message : "Failed to load messages.");
  } finally {
    enableInput(true);
  }
}

// ── New chat ──────────────────────────────────────────────────────────────────
newChatBtn.addEventListener("click", async () => {
  newChatBtn.disabled = true;
  try {
    const chat = await createChatSession(getToken(), "New Chat");
    prependSessionToList(chat);
    await switchSession(chat.id);
  } catch (err) {
    window.alert(err instanceof APIError ? err.message : "Failed to create chat.");
  } finally {
    newChatBtn.disabled = false;
  }
});

// ── Send message ──────────────────────────────────────────────────────────────
async function submitMessage() {
  if (!activeChatId || isSending) return;
  const content = chatInput.value.trim();
  if (!content) return;

  isSending = true;
  enableInput(false);
  chatInput.value = "";

  // Optimistically render user bubble
  appendMessage({ role: "user", content, created_at: new Date().toISOString() });
  scrollToBottom();

  typingIndicator.hidden = false;
  scrollToBottom();

  try {
    const result = await sendChatMessage(getToken(), activeChatId, content);
    typingIndicator.hidden = true;

    // Render assistant message
    appendMessage(result.assistant_message, result.router);

    // Update session title in sidebar (auto-titled after first message)
    const sessResp = await listChatSessions(getToken());
    const sessions = Array.isArray(sessResp) ? sessResp : [];
    const updated = sessions.find((s) => s.id === activeChatId);
    if (updated) prependSessionToList(updated);
    setActiveSessionButton(activeChatId);
  } catch (err) {
    typingIndicator.hidden = true;
    appendError(err instanceof APIError ? err.message : "Failed to send message.");
  } finally {
    isSending = false;
    enableInput(true);
    chatInput.focus();
    scrollToBottom();
  }
}

sendBtn.addEventListener("click", submitMessage);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submitMessage();
  }
});

// Auto-grow textarea
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
});

// ── Markdown renderer (marked.js loaded via CDN in chat.html) ────────────────
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    return marked.parse(text, { breaks: true, gfm: true });
  }
  // Fallback: escape HTML and preserve newlines
  return escHtml(text).replace(/\n/g, "<br>");
}

// ── Render helpers ────────────────────────────────────────────────────────────
function appendMessage(msg, router = null) {
  chatPlaceholder.hidden = true;

  const wrap = document.createElement("div");
  wrap.className = `message-bubble ${msg.role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble-content";
  if (msg.role === "assistant") {
    bubble.innerHTML = renderMarkdown(msg.content);
  } else {
    bubble.textContent = msg.content;
  }
  wrap.appendChild(bubble);

  // Meta line
  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let metaText = timeStr;
  if (msg.role === "assistant" && msg.model_used) {
    metaText += ` · ${msg.model_used}`;
  }
  if (router && msg.role === "assistant") {
    metaText += ` · via ${router.category || "general"}`;
  }
  meta.textContent = metaText;
  wrap.appendChild(meta);

  // Citations
  if (msg.role === "assistant" && msg.sources && msg.sources.length > 0) {
    const citBlock = buildCitations(msg.sources);
    wrap.appendChild(citBlock);
  }

  chatMessagesEl.appendChild(wrap);
}

function buildCitations(sources) {
  const wrap = document.createElement("div");
  wrap.className = "citations";

  // Toggle button (collapsed by default)
  const toggle = document.createElement("button");
  toggle.className = "citations-toggle";
  toggle.type = "button";
  toggle.innerHTML = `<span class="citations-arrow">&#9654;</span> Sources (${sources.length})`;

  // Items container — hidden by default
  const body = document.createElement("div");
  body.className = "citations-body";
  body.hidden = true;

  toggle.addEventListener("click", () => {
    const open = !body.hidden;
    body.hidden = open;
    toggle.querySelector(".citations-arrow").style.transform = open ? "" : "rotate(90deg)";
  });

  wrap.appendChild(toggle);

  sources.forEach((src, i) => {
    const item = document.createElement("div");
    item.className = "citation-item";
    const score = src.similarity_score ? ` · ${(src.similarity_score * 100).toFixed(0)}% match` : "";
    item.innerHTML = `
      <strong>Source ${i + 1}${score}</strong>
      ${src.snippet ? `<div class="citation-snippet">${escHtml(src.snippet)}</div>` : ""}
    `.trim();
    body.appendChild(item);
  });

  wrap.appendChild(body);
  return wrap;
}

function appendLoadingBubble(text) {
  chatPlaceholder.hidden = true;
  const p = document.createElement("p");
  p.id = "loading-bubble";
  p.style.cssText = "color:var(--muted);font-size:0.9rem;padding:8px 0;";
  p.textContent = text;
  chatMessagesEl.appendChild(p);
}

function appendError(message) {
  const p = document.createElement("p");
  p.style.cssText = "color:#a13716;font-size:0.9rem;padding:6px 0;";
  p.textContent = `Error: ${message}`;
  chatMessagesEl.appendChild(p);
}

function clearMessages() {
  chatMessagesEl.innerHTML = "";
  chatMessagesEl.appendChild(chatPlaceholder);
  chatPlaceholder.hidden = true;
}

function showPlaceholder(show, heading = "Select or start a chat", body = "Pick a session from the sidebar, or click + New to begin.") {
  chatPlaceholder.hidden = !show;
  if (show) {
    chatPlaceholder.querySelector("h3").textContent = heading;
    chatPlaceholder.querySelector("p").textContent = body;
  }
}

function enableInput(enabled) {
  chatInput.disabled = !enabled || !activeChatId;
  sendBtn.disabled   = !enabled || !activeChatId;
}

function scrollToBottom() {
  window.requestAnimationFrame(() => {
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Initialise ────────────────────────────────────────────────────────────────
loadSessions();
