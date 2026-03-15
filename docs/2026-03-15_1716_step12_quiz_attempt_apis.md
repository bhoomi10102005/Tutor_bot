# Step 12 - Quiz Taking, Grading, and Attempt Summary APIs

## Task Summary

Implemented the Step 12 backend quiz attempt flow and result APIs.

Added:
- attempt start endpoint
- deterministic grading from stored `correct_json`
- attempt submission endpoint with per-question answer persistence
- wrapper-backed performance summary generation with stored `summary_json`
- attempt result fetch endpoint

## Files Created/Edited

Edited:
- `backend/app/api/quizzes.py`
- `backend/app/services/quiz/grading.py`
- `backend/app/services/quiz/summarizer.py`

Created:
- `test_quiz_attempts.py`
- `docs/2026-03-15_1716_step12_quiz_attempt_apis.md`

## Endpoints Added/Changed

Added in `backend/app/api/quizzes.py`:
- `POST /api/quizzes/<quiz_id>/attempts/start`
- `POST /api/quizzes/<quiz_id>/attempts/<attempt_id>/submit`
- `GET /api/quizzes/attempts/<attempt_id>`

Behavior:
- all attempt routes require JWT auth
- attempts are user-scoped and only accessible by the authenticated quiz owner
- start creates a `quiz_attempts` row and returns takeable questions
- submit grades answers deterministically, stores `quiz_attempt_answers`, stores summary JSON, and returns score plus summary
- get attempt returns the stored attempt state and graded answers
- correct answers and explanations are returned only after submission

## DB Schema / Migration Changes

None in this step.

Step 12 uses the existing Step 10 quiz tables:
- `quiz_attempts`
- `quiz_attempt_answers`

## Implementation Notes

### `grading.py`
- validates submission payloads
- normalizes submitted choices from index/text/JSON answer forms
- scores against stored `correct_json`
- computes score, counts, accuracy, and per-question grading results
- treats unanswered questions as `is_correct = null` with `marks_awarded = 0`

### `summarizer.py`
- calls the wrapper chat completion API with `gemini/gemini-2.5-flash`
- asks for a compact JSON performance summary
- normalizes summary output into a stable stored structure
- falls back to a deterministic local summary if wrapper output is unavailable or invalid

### `quizzes.py`
- serializes attempts and graded answers
- creates attempt rows on start
- saves one answer row per quiz question on submit
- blocks resubmission after an attempt has been submitted
- hides `correct_json` and explanations until the attempt is submitted

## Decisions / Tradeoffs

1. Submission grading is fully deterministic and only depends on stored quiz question data, so scores are stable even if the summary model changes.
2. The summary step still calls the wrapper as required, but a local fallback summary is stored if the wrapper fails so attempt submission remains usable.
3. Attempt submission stores rows for all quiz questions, including unanswered ones, so result retrieval has a complete per-question record.
4. Correct answers remain hidden on quiz-fetch endpoints and only appear on submitted attempt results to avoid leaking answer keys before taking the quiz.

## Validation Notes

Commands run:
- `cd backend && python -m compileall app`
- `cd backend && python -c "from app import create_app; create_app(); print('app ok')"`
- `python test_quizzes.py`
- `python test_quiz_attempts.py`
- backend start smoke: `cd backend && python -m flask --app run.py run --no-debugger --no-reload`
- frontend start smoke: `cd frontend && python -m http.server 5500`

Results:
- Python compile/import checks passed
- app factory startup passed
- Step 11 quiz API regression test passed
- Step 12 attempt API integration test passed
- auth regression checks passed through the integration tests
- backend and frontend process start checks both reached `Running`
