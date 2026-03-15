# Create Quiz Document Selection

## Task Summary

Added document selection to the existing create quiz page so quizzes can be generated from:
- all ready documents
- only the specific ready documents selected by the user

The earlier chat-to-quiz redirect flow is still supported and now feeds into the same document-selection UI.

## Files Created/Edited

Edited:
- `frontend/pages/create-quiz.html`
- `frontend/assets/js/create-quiz.js`

Created:
- `docs/2026-03-16_0109_quiz_document_selection.md`

## Endpoints Added/Changed

No backend endpoints were changed in this task.

Reused existing endpoints:
- `GET /api/documents`
- `POST /api/quizzes`

Frontend behavior:
- loads the user's ready documents from `GET /api/documents`
- lets the user choose `all ready documents` or `selected documents only`
- submits `document_ids` only when the selected-documents mode is active

## DB Schema / Migration Changes

None.

## Decisions / Tradeoffs

1. Kept document selection on the existing create quiz page instead of adding a separate document picker screen.
2. Limited selection to ready documents only, since the backend quiz API already requires selected documents to have a ready ingestion.
3. Preserved the chat-scoped redirect behavior by mapping any pre-applied chat document IDs into the same document-selection controls.

## Validation Notes

Commands run:
- `node --check frontend\\assets\\js\\create-quiz.js`
- `python test_quizzes.py`
- backend start smoke with `python -m flask --app run.py run --no-debugger --no-reload`
- frontend start smoke with `python -m http.server 5500` plus an HTTP probe

Results:
- frontend JavaScript syntax check passed
- quiz API integration test passed, including auth regression coverage in that test
- backend start smoke passed
- frontend start smoke passed
