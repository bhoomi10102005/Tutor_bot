# Per-Chat Document Selection

**Date**: 2026-03-03  
**Feature**: Allow users to pin specific documents to a chat session so only those documents are searched by the RAG engine for that chat.

---

## Task Summary

Previously, every chat session searched ALL of the user's documents for RAG context. This feature adds per-chat document scoping:

- A `+ Documents` button appears above the chat input when a session is active.
- Clicking it opens a modal showing all the user's documents with checkboxes.
- The user checks the documents they want the AI to use for that specific chat.
- Leaving all unchecked means "search all documents" (previous default behaviour, preserved).
- The selection is persisted to the backend per chat session.

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/app/db/models/chat_document.py` | SQLAlchemy association table `chat_documents` (junction of chats ↔ documents) |
| `backend/migrations/versions/8d5a35927e58_add_chat_documents_table.py` | Alembic migration — creates the `chat_documents` table |
| `docs/2026-03-03_per_chat_document_selection.md` | This file |

---

## Files Modified

| File | Changes |
|------|---------|
| `backend/app/db/models/chat.py` | Added import of `chat_documents`; added `selected_documents` relationship (many-to-many → Document, secondary=chat_documents, lazy="dynamic") |
| `backend/app/db/models/__init__.py` | Added `chat_documents` import and `__all__` export |
| `backend/app/services/rag/retrieval.py` | `retrieve_chunks()` gained `document_ids: list[str] | None = None`; when provided, adds `Document.id.in_(document_ids)` filter |
| `backend/app/services/rag/answering.py` | `generate_answer()` gained `document_ids: list[str] | None = None`; passed through to `retrieve_chunks()` |
| `backend/app/api/chat.py` | Added `Document` import; `send_message()` now loads `chat.selected_documents`, derives `doc_ids_filter`, and passes it to `generate_answer()`; added `GET /sessions/<id>/documents` and `PUT /sessions/<id>/documents` endpoints |
| `frontend/components/api_client.js` | Added `getChatDocuments(accessToken, chatId)` and `setChatDocuments(accessToken, chatId, documentIds)` |
| `frontend/pages/chat.html` | Added `.docs-context-strip` (label + "+ Documents" button) above the textarea; added doc-picker modal overlay at bottom of body |
| `frontend/assets/js/chat.js` | Added imports for `listDocuments`, `getChatDocuments`, `setChatDocuments`; added `activeDocSelection` state; `switchSession()` now fetches doc selection in parallel with messages; added `updateDocsContextStrip()`, `openDocPicker()`, `closeDocPicker()`, `saveDocSelection()`, event listeners; `enableInput()` also shows/hides the context strip |
| `frontend/assets/css/app.css` | `.chat-input-bar` restructured to column layout; added `.docs-context-strip`, `.docs-select-btn`, `.chat-input-row`; added full `.doc-picker-overlay`, `.doc-picker-modal`, `.doc-picker-head`, `.doc-picker-hint`, `.doc-picker-list`, `.doc-picker-item`, `.doc-picker-foot` styles |

---

## Endpoints Added

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/chat/sessions/<chat_id>/documents` | Returns `{ chat_id, documents: [{id, title, source_type, filename}] }` — the currently pinned documents for this session. Empty list = all docs. |
| `PUT` | `/api/chat/sessions/<chat_id>/documents` | Body: `{ "document_ids": ["uuid", ...] }`. Replaces the selection. Empty array = clear (use all docs). Returns `{ chat_id, document_ids }`. |

---

## DB Schema / Migration Changes

**New table**: `chat_documents`

| Column | Type | Constraints |
|--------|------|-------------|
| `chat_id` | VARCHAR(36) | PK, FK → chats.id ON DELETE CASCADE |
| `document_id` | VARCHAR(36) | PK, FK → documents.id ON DELETE CASCADE |

Migration ID: `8d5a35927e58`  
Chain: `b68382d50595` → `8d5a35927e58`  

**Note**: The auto-generated migration also included a `DROP INDEX ix_chunks_embedding` block — a known false-positive from Alembic not recognising the pgvector `ivfflat` index type. That block was removed from the migration before applying.

---

## Decisions / Tradeoffs

1. **Semantics of empty selection**: Empty `document_ids` list (or no rows in `chat_documents`) means "use all documents". This is the backward-compatible default.

2. **Replace-all PUT semantics**: `PUT /documents` always replaces the full selection. Simpler than add/remove delta operations; no partial state issues.

3. **`lazy="dynamic"` on relationship**: Allows additional filters (e.g., `.filter(Document.is_deleted.is_(False))`) without loading all associated objects.

4. **Frontend saves on "Save" click**: The picker batches changes and calls `setChatDocuments` once when the user clicks Save. This avoids a network call per checkbox tick.

5. **Parallel load on `switchSession()`**: Messages and document selection are fetched in parallel via `Promise.all`. If the doc-selection fetch fails, it silently falls back to empty (all docs), so it doesn't break the chat view.

6. **Context strip visibility**: The strip is hidden until a session is active (`enableInput()` controls it) so new users don't see a confusing floating element on the empty state.
