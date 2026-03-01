# Step 8 – Chat API with Router + RAG Answering

**Date:** 2026-03-02 00:15  
**Agent task:** Step 8 of master plan  
**Status:** Complete

---

## Task Summary

Implemented the full Chat API with intelligent model routing and RAG-augmented answer generation. Authenticated users can create chat sessions, list them, view message history, and send messages that are answered using vector-retrieved document context.

---

## Files Created / Edited

| File | Action |
|------|--------|
| `backend/app/db/models/chat.py` | Created – Chat session model |
| `backend/app/db/models/chat_message.py` | Created – ChatMessage model (user + assistant) |
| `backend/app/db/models/chat_message_source.py` | Created – Source citation traceability model |
| `backend/app/db/models/__init__.py` | Edited – added Chat, ChatMessage, ChatMessageSource imports |
| `backend/app/__init__.py` | Edited – imported new models + registered `chat_bp` |
| `backend/app/api/chat.py` | Implemented (was empty stub) – all 4 HTTP routes |
| `backend/app/services/router/heuristics.py` | Implemented (was empty stub) – keyword-based model routing |
| `backend/app/services/router/classifier.py` | Implemented (was empty stub) – LLM-based category classification |
| `backend/app/services/rag/answering.py` | Implemented (was empty stub) – RAG answer generation with fallback chain |
| `backend/migrations/versions/b68382d50595_create_chats_chat_messages_chat_message_.py` | Created – Alembic migration for new tables |

---

## Endpoints Added / Changed

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| `POST` | `/api/chat/sessions` | JWT required | Create a new chat session |
| `GET` | `/api/chat/sessions` | JWT required | List all sessions for authenticated user (newest first) |
| `GET` | `/api/chat/sessions/<chat_id>/messages` | JWT required | Get all messages for a session (with sources) |
| `POST` | `/api/chat/sessions/<chat_id>/messages` | JWT required | Send user message; returns user + assistant message + router metadata |

All other existing endpoints (auth, documents) are unchanged.

---

## DB Schema / Migration Changes

**Migration:** `b68382d50595` – "create chats chat_messages chat_message_sources tables"  
**Revises:** `f3a9c1d2e4b7` (documents/ingestions/chunks)

### `chats`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) PK | UUID |
| `user_id` | String(36) FK → users | CASCADE delete; indexed |
| `title` | String(255) | auto-set to first 80 chars of first message |
| `created_at` | DateTime(tz) | |
| `updated_at` | DateTime(tz) | updated on each new message |

### `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) PK | UUID |
| `chat_id` | String(36) FK → chats | CASCADE delete; indexed |
| `user_id` | String(36) FK → users | CASCADE delete; indexed |
| `role` | String(20) | `"user"` or `"assistant"` |
| `content` | Text | message body |
| `model_used` | String(100) nullable | populated for assistant only |
| `router_json` | Text nullable | JSON blob with routing decision |
| `created_at` | DateTime(tz) | |

### `chat_message_sources`
| Column | Type | Notes |
|--------|------|-------|
| `id` | BigInteger PK | autoincrement |
| `message_id` | String(36) FK → chat_messages | CASCADE delete; indexed |
| `chunk_id` | BigInteger FK → chunks | CASCADE delete |
| `document_id` | String(36) FK → documents | CASCADE delete |
| `similarity_score` | Float | cosine similarity from retrieval |
| `snippet` | Text nullable | chunk text used in answer |
| UNIQUE | `(message_id, chunk_id)` | prevents duplicate source entries |

---

## Flow per User Message (POST `/messages`)

1. **Validate** session ownership (`chat.user_id == requesting user`).
2. **Save** user message to `chat_messages`.
3. **Route**: `heuristics.route()` → if `confidence=="low"` → `classifier.classify()`.
   - Heuristics: keyword pattern matching → "coding" / "reasoning" / "general" / "uncertain".
   - Classifier: calls `gemini/gemini-2.5-flash` with strict JSON-only prompt.
4. **Retrieve** relevant chunks via `retrieval.retrieve_chunks()` (top_k=5, user-scoped, current ingestion only).
5. **Generate** answer via `answering.generate_answer()` with conversation history (last 10 turns).
6. **Save** assistant message with `model_used` and `router_json`.
7. **Save** `ChatMessageSource` rows for each unique retrieved chunk.
8. **Auto-title** session with first 80 chars of first user message.
9. Return `{ user_message, assistant_message (with sources), router }`.

---

## Router Model Policy

| Category | Model |
|----------|-------|
| default / general | `routeway/glm-4.5-air:free` |
| hard reasoning | `routeway/gpt-oss-120b:free` |
| coding | `routeway/devstral-2512:free` |
| classification | `gemini/gemini-2.5-flash` |

**Fallback chain** (in `answering.py`): primary model → `routeway/glm-4.5-air:free` → `gemini/gemini-2.5-flash`.  
If all models fail, returns 503.

---

## Decisions / Tradeoffs

1. **Auto-title sessions**: First 80 chars of the first user message replaces "New Chat" automatically. Simple and avoids an extra LLM call.

2. **Classifier fallback on JSON parse error**: If the classifier LLM returns malformed JSON (e.g., markdown-wrapped), the code falls back to `general`/`MODEL_DEFAULT`. A markdown-stripping step was added to reduce parse failures.

3. **History window**: Only the last 10 turns (20 messages total) are included in the LLM prompt to avoid token limit issues. Older context is stored in the DB but not sent.

4. **Deduplication of sources**: `seen_chunk_ids` set prevents inserting the same chunk twice if the retrieval returns it multiple times.

5. **Session auto-ownership**: All routes filter `chat.user_id == requesting_user_id`, ensuring strict user-scoping. No cross-user leakage.

6. **No streaming yet**: Responses are returned as a single JSON payload. Streaming can be added in a later step when the frontend chat page is built (Step 9).

7. **Sources in GET /messages**: Full source objects (chunk_id, document_id, score, snippet) are included in every GET request to support citation display in the frontend.

---

## Test Results

| Check | Result |
|-------|--------|
| `POST /api/chat/sessions` | ✅ 201 |
| `GET /api/chat/sessions` | ✅ 200, returns session list |
| `GET /api/chat/sessions/<id>/messages` (empty) | ✅ 200, `[]` |
| `POST /api/chat/sessions/<id>/messages` | ✅ 200, answer returned with model/router metadata |
| `GET /api/chat/sessions/<id>/messages` (after send) | ✅ 200, both user+assistant messages returned |
| Unauthenticated request | ✅ 401 `Missing Authorization Header` |
| Auth regression (`/api/auth/me`) | ✅ 200 |
| Flask app creates cleanly | ✅ |
| Migration applied cleanly | ✅ |
