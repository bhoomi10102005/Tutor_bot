# Live Backend PDF Chat Quiz Test

## Task Summary

Added a second integration test script that talks to the running backend server over HTTP and verifies a live end-to-end flow using a real PDF from the repository.

The script covers:
- create a new account
- refresh and `me`
- upload a PDF from `PDF/`
- poll ingestion status until ready
- create a chat session
- ask one question and verify the assistant answer response
- create a quiz from the uploaded document
- verify quiz list, detail, and questions endpoints

## Files Created/Edited

Created:
- `test_live_backend_quiz_flow.py`
- `docs/2026-03-15_1659_live_backend_pdf_chat_quiz_test.md`

Edited:
- None

## Endpoints Added/Changed

None.

This task only adds a live integration test for existing endpoints:
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/documents/upload`
- `GET /api/documents/<id>/ingestions/<ingestion_id>/status`
- `POST /api/documents/<id>/reingest`
- `POST /api/chat/sessions`
- `POST /api/chat/sessions/<chat_id>/messages`
- `POST /api/quizzes`
- `GET /api/quizzes`
- `GET /api/quizzes/<quiz_id>`
- `GET /api/quizzes/<quiz_id>/questions`

## DB Schema / Migration Changes

None.

## Decisions / Tradeoffs

1. The test uses the already running backend server and real HTTP requests because the user explicitly asked for a backend-server-based flow test.
2. `PDF/Python5.pdf` is used by default because it exists in the repo and is relatively small, which helps ingestion complete faster.
3. Small retries were added for ingestion reprocessing and AI-backed chat/quiz endpoints because upstream wrapper responses can be temporarily flaky even when the backend itself is working.
4. The current backend does not expose quiz attempt/submit endpoints yet, so the script verifies the chat answer plus quiz creation/fetch endpoints only.

## Validation Notes

Command run:
- `python test_live_backend_quiz_flow.py`

Result:
- passed successfully against the running backend server

Observed successful flow:
- fresh account created
- auth refresh and `me` passed
- PDF upload succeeded
- ingestion reached `ready`
- one chat question returned an assistant answer with sources
- quiz creation succeeded
- quiz list/detail/questions endpoints returned the created quiz
