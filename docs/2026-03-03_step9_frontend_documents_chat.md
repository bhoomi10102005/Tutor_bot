# Step 9 — Frontend Documents and Chat Pages (Phase 3 UI)

**Date:** 2026-03-03  
**Time:** (current session)  
**Task:** Step 9 of master plan — Phase 3 Frontend UI  
**Status:** Complete

---

## Task Summary

Built the full Phase 3 frontend UI: Documents page (upload PDF + add text context + document list) and Chat page (session list + message thread + send form + citations). All HTTP calls go through `components/api_client.js`. No wrapper calls from frontend.

---

## Files Created

| File | Purpose |
|---|---|
| `frontend/pages/documents.html` | Documents page — upload, text context, list with ingestion badges |
| `frontend/pages/chat.html` | Chat page — session sidebar + message thread + send input |
| `frontend/assets/js/documents.js` | Documents page logic (upload, text submit, list, status polling, delete) |
| `frontend/assets/js/chat.js` | Chat page logic (new session, load messages, send, citations, model info) |
| `frontend/assets/css/app.css` | Shared app-shell CSS (cards, drop zone, badges, chat layout, bubbles, citations) |

## Files Edited

| File | Change |
|---|---|
| `frontend/components/api_client.js` | Added 10 new exported functions for Documents and Chat endpoints |
| `frontend/index.html` | Added `[data-authed-action]` nav links to Documents + Chat pages |
| `frontend/assets/js/landing.js` | Updated `applyAuthState()` to show/hide `[data-authed-action]` links |

---

## New api_client.js Exports

### Documents
| Function | Endpoint |
|---|---|
| `uploadDocument(token, formData)` | `POST /api/documents/upload` (multipart, 60s timeout) |
| `addTextDocument(token, title, text)` | `POST /api/documents/text` (60s timeout) |
| `listDocuments(token)` | `GET /api/documents` |
| `getDocument(token, docId)` | `GET /api/documents/<id>` |
| `deleteDocument(token, docId)` | `DELETE /api/documents/<id>` |
| `getIngestionStatus(token, docId, ingestionId)` | `GET /api/documents/<id>/ingestions/<ingestionId>/status` |

### Chat
| Function | Endpoint |
|---|---|
| `createChatSession(token, title)` | `POST /api/chat/sessions` |
| `listChatSessions(token)` | `GET /api/chat/sessions` |
| `getChatMessages(token, chatId)` | `GET /api/chat/sessions/<id>/messages` |
| `sendChatMessage(token, chatId, content)` | `POST /api/chat/sessions/<id>/messages` (120s timeout) |

---

## UI Feature Details

### Documents page (`documents.html` / `documents.js`)
- **Section A — Upload PDF/File**: drag-and-drop zone + file input (hidden), shows filename + size after selection, optional title override, animated progress bar (fake 0→70% on send, 70→100% on success), ingestion status shown as badge (`ready` / `processing` / `failed`), polling every 3s for `processing` documents until settled.
- **Section B — Add Text Context**: title + textarea form, same status badge + polling flow after submit.
- **Section C — Document List**: fetched on page load + after every add/upload/delete, badges per-document, delete with confirm dialog, soft-delete (backend marks `is_deleted=true`).
- Auth guard: redirects to `login.html` if no session.

### Chat page (`chat.html` / `chat.js`)
- **Sidebar**: lists all sessions (newest first), active session highlighted, `+ New` button creates a session and auto-switches.
- **Message thread**: user messages (right, teal gradient), assistant messages (left, white card), each with timestamp + model used in meta line.
- **Citations**: shown below each assistant message; source count label + similarity score + snippet preview (2-line clamp).
- **Input**: auto-growing textarea, Enter to send / Shift+Enter for newline, disabled while sending.
- **Typing indicator**: visible while awaiting backend response.
- Session title auto-updates in sidebar after first message (backend auto-titles from first 80 chars).
- Guards against non-array API responses (`Array.isArray` checks on all endpoints that return arrays).

---

## API Response Shape Notes

- `GET /api/documents` → `{ "documents": [...] }` — handled with `res.documents || []`
- `GET /api/chat/sessions` → bare array `[...]`
- `GET /api/chat/sessions/<id>/messages` → bare array `[...]`
- `POST /api/chat/sessions/<id>/messages` → `{ user_message, assistant_message (with sources), router }`

---

## No DB / Migration Changes

No schema changes. All required tables exist from Steps 5, 6, 8.

---

## Decisions / Tradeoffs

- **Synchronous ingestion + badge polling**: ingestion runs synchronously in the backend request; frontend polls status every 3s and stops when `ready` or `failed`. Simple and correct for current scale.
- **Fake progress bar**: real upload progress needs `XMLHttpRequest` with `upload.onprogress`; using a fake linear animation is simpler and sufficient for typical ≤20 MB uploads.
- **120s send timeout**: LLM calls can take 10–30s; 120s gives generous headroom without hanging indefinitely.
- **`app.css` separate from `auth.css`**: keeps auth styles isolated; app pages don't import auth.css. The `.field` class is redeclared in app.css to avoid import duplication.
- **Chat layout height**: `calc(100vh - 122px)` = topbar (74px) + subnav (48px). Collapses to scrollable stacked layout on mobile (≤900px).
- **No framework**: consistent with existing vanilla JS pattern; no build step required.
