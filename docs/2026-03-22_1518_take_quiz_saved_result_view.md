# Take Quiz Saved Result View

## Task Summary

Updated the Take Quiz flow so revisiting a quiz with an already submitted attempt shows the stored graded result instead of the default preview/start state.

Added:
- latest submitted attempt lookup on the quiz questions API
- frontend auto-loading of the stored submitted attempt result when a quiz has already been completed
- regression coverage for the new revisit behavior

## Files Created/Edited

Edited:
- `backend/app/api/quizzes.py`
- `frontend/assets/js/take-quiz.js`
- `tests/test_quiz_attempts.py`

Created:
- `docs/2026-03-22_1518_take_quiz_saved_result_view.md`

## Endpoints Added/Changed

Changed:
- `GET /api/quizzes/<quiz_id>/questions`
  - now also returns `latest_submitted_attempt_id` for the authenticated user when a submitted attempt exists for that quiz

Reused existing endpoint:
- `GET /api/quizzes/attempts/<attempt_id>`
  - the frontend now uses this to open the saved graded result view when `latest_submitted_attempt_id` is present

## DB Schema / Migration Changes

None.

## Decisions / Tradeoffs

1. Reused the existing attempt result endpoint instead of adding a new result-specific API, which kept the change small and avoided duplicate response logic.
2. Added only the latest submitted attempt ID to the quiz questions response so the frontend can decide whether to show preview or stored result without changing unrelated quiz list behavior.
3. Kept the original preview/start state for quizzes that are new or not yet submitted, matching the requested behavior exactly.

## Validation Notes

Commands run:
- `node --check frontend/assets/js/take-quiz.js`
- `python -m py_compile backend/app/api/quizzes.py`
- `$env:PYTHONPATH='backend'; python tests/test_quiz_attempts.py`
- backend start smoke with `python -m flask --app run.py run --no-debugger --no-reload` plus an HTTP probe
- frontend start smoke with `python -m http.server 5500` plus an HTTP probe

Results:
- frontend JavaScript syntax check passed
- backend Python syntax check passed
- quiz attempt integration test passed
- auth regression checks passed through the integration test (`register`, `login`, `refresh`, `me`)
- user-scoped attempt access checks passed
- backend start smoke passed
- frontend start smoke passed
