# Step 13 - Frontend Quiz Pages (Create + Take)

## Task Summary

Implemented the Step 13 frontend quiz flow for quiz creation and quiz taking.

Added:
- quiz API helpers in the shared frontend client
- a protected create quiz page with quiz generation form and question preview
- a protected take quiz page with quiz list, attempt start, answer submission, and result review

## Files Created/Edited

Edited:
- `frontend/components/api_client.js`

Created:
- `frontend/pages/create-quiz.html`
- `frontend/pages/take-quiz.html`
- `frontend/assets/js/create-quiz.js`
- `frontend/assets/js/take-quiz.js`
- `docs/2026-03-16_0017_step13_frontend_quiz_pages.md`

## Endpoints Added/Changed

No backend endpoints were changed in this step.

Frontend now uses the existing protected quiz endpoints via `frontend/components/api_client.js`:
- `POST /api/quizzes`
- `GET /api/quizzes`
- `GET /api/quizzes/<quiz_id>`
- `GET /api/quizzes/<quiz_id>/questions`
- `POST /api/quizzes/<quiz_id>/attempts/start`
- `POST /api/quizzes/<quiz_id>/attempts/<attempt_id>/submit`
- `GET /api/quizzes/attempts/<attempt_id>`

## DB Schema / Migration Changes

None.

## Implementation Notes

### `frontend/components/api_client.js`
- added quiz helpers for create, list, detail, questions, attempt start, submit, and attempt fetch
- kept all frontend quiz HTTP calls centralized in the shared API client

### `frontend/pages/create-quiz.html` + `frontend/assets/js/create-quiz.js`
- added a protected create page with topic, question count, marks, difficulty, and time limit inputs
- submits quiz generation requests to the Step 11 API
- renders the generated quiz metadata and question preview
- links directly into the take quiz page for the generated quiz

### `frontend/pages/take-quiz.html` + `frontend/assets/js/take-quiz.js`
- added a protected take page with a quiz library sidebar
- loads quiz questions for preview before starting an attempt
- starts attempts through the Step 12 API and tracks elapsed time client-side
- submits selected answers and renders score, feedback summary, correctness, and explanations
- supports re-taking the same quiz from the result view

## Decisions / Tradeoffs

1. Kept quiz-specific styling inside the new HTML pages so Step 13 stayed limited to the requested frontend files.
2. Used query-parameter quiz selection (`take-quiz.html?quiz_id=...`) so the create page can hand off directly into the take flow without touching unrelated navigation files.
3. Did not add extra frontend persistence for in-progress attempts; the page keeps the active attempt in memory for the current session and relies on the existing backend APIs for grading and stored results.

## Validation Notes

Commands run:
- `node --check frontend\\assets\\js\\create-quiz.js`
- `node --check frontend\\assets\\js\\take-quiz.js`
- `node --check frontend\\components\\api_client.js`
- `python test_quizzes.py`
- `python test_quiz_attempts.py`
- backend start smoke with `python -m flask --app run.py run --no-debugger --no-reload`
- frontend start smoke with `python -m http.server 5500` plus an HTTP probe to confirm it served `/`

Results:
- frontend JavaScript syntax checks passed
- Step 11 quiz API integration test passed
- Step 12 quiz attempt integration test passed
- auth regression checks passed through the existing integration tests
- backend start smoke passed
- frontend start smoke passed
