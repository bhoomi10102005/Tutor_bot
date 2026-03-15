# Chat To Quiz Scope Flow

## Task Summary

Implemented a chat-to-quiz redirect flow that reuses the existing create quiz page.

Added:
- a `Quiz This Chat` action in the chat document-context area
- redirect from chat to create quiz with the active chat document scope in query params
- scoped create-quiz UI messaging and payload handling for chat-selected `document_ids`

## Files Created/Edited

Edited:
- `frontend/pages/chat.html`
- `frontend/assets/css/app.css`
- `frontend/assets/js/chat.js`
- `frontend/pages/create-quiz.html`
- `frontend/assets/js/create-quiz.js`

Created:
- `docs/2026-03-16_0054_chat_quiz_scope_flow.md`

## Endpoints Added/Changed

No backend endpoints were changed in this task.

Reused existing endpoints:
- `GET /api/chat/sessions/<id>/documents`
- `PUT /api/chat/sessions/<id>/documents`
- `POST /api/quizzes`

Frontend behavior:
- if a chat has specific documents selected, the create quiz page submits those `document_ids`
- if a chat has no specific document selection, the create quiz page submits no `document_ids`, which preserves the existing backend behavior of using all ready documents

## DB Schema / Migration Changes

None.

## Decisions / Tradeoffs

1. Reused the existing create quiz page instead of adding a second quiz UI from chat, so the quiz form still captures topic, difficulty, question count, marks, and time limit.
2. Passed chat scope through query params rather than changing backend APIs, because the quiz API already supports scoped `document_ids`.
3. Showed a scoped note on the create quiz page so users can tell whether they are using specific chat documents or all ready documents.

## Validation Notes

Commands run:
- `node --check frontend\\assets\\js\\chat.js`
- `node --check frontend\\assets\\js\\create-quiz.js`
- `python test_quizzes.py`
- backend start smoke with `python -m flask --app run.py run --no-debugger --no-reload`
- frontend start smoke with `python -m http.server 5500` plus an HTTP probe

Results:
- frontend JavaScript syntax checks passed
- quiz API integration test passed, including auth regression coverage in that test
- backend start smoke passed
- frontend start smoke passed
