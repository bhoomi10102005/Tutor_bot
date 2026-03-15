# Step 11 - Quiz Generation and Validation APIs

## Task Summary

Implemented the Step 11 backend quiz generation flow and authenticated quiz read APIs.

Added:
- request parsing for quiz generation inputs
- retrieval-backed quiz generation via the wrapper chat client
- schema, citation, mark, and correct-option validation with a repair loop
- quiz persistence for quizzes, questions, and question-source citations
- protected quiz routes for create, list, detail, and questions

## Files Created/Edited

Edited:
- `backend/app/__init__.py`
- `backend/app/api/quizzes.py`
- `backend/app/services/quiz/spec_parser.py`
- `backend/app/services/quiz/generator.py`
- `backend/app/services/quiz/validator.py`

Created:
- `docs/2026-03-15_1642_step11_quiz_generation_validation_apis.md`

## Endpoints Added/Changed

Added in `backend/app/api/quizzes.py`:
- `POST /api/quizzes`
- `GET /api/quizzes`
- `GET /api/quizzes/<quiz_id>`
- `GET /api/quizzes/<quiz_id>/questions`

Behavior:
- all quiz routes require JWT auth
- quiz creation is user-scoped and can optionally validate selected `document_ids`
- list/detail/questions routes only return quizzes owned by the authenticated user
- question fetch responses omit the stored answer key and explanation fields

## DB Schema / Migration Changes

None in this step.

Step 11 uses the Step 10 quiz tables as-is:
- `quizzes`
- `quiz_questions`
- `quiz_question_sources`

## Implementation Notes

### `spec_parser.py`
- normalizes quiz request payloads into a `QuizRequestSpec`
- validates `topic`, `question_count`, difficulty, marks, time limit, question types, and optional `document_ids`
- supports `marks` as an alias for `total_marks`

### `generator.py`
- retrieves relevant chunks from the latest document ingestions using the existing retrieval service
- generates structured quiz JSON through the wrapper chat client
- retries on validation failure by sending a repair prompt back through the wrapper
- stores quiz metadata, questions, and per-question chunk citations
- uses gemma as primary generation model and gemini flash as fallback

### `validator.py`
- extracts JSON from raw model output
- validates question count, allowed types, options, correct answer references, and citation chunk IDs
- normalizes `correct_json` into a deterministic `{option_index, option_text}` shape
- preserves valid model-provided marks when totals align, otherwise normalizes marks to the requested total

### `quizzes.py`
- exposes create/list/detail/questions routes
- validates user ownership for optional document filters
- serializes quiz metadata plus question prompts/options/sources
- keeps answer keys off the public quiz-fetch responses

## Decisions / Tradeoffs

1. Supported Step 11 question types are currently `mcq_single` and `true_false` so Step 12 grading can stay deterministic.
2. The API stores full answer keys in the database but does not expose them in quiz fetch responses to avoid leaking answers before attempt flows are built.
3. Validation is strict about citations and correct-option references, but mark totals are normalized when the model drifts slightly so generation is more reliable.
4. Quiz creation reuses the existing retrieval service, so it automatically stays scoped to each user's latest ready document ingestions across upload and text sources.

## Validation Notes

Commands run:
- `cd backend && python -m compileall app`
- `cd backend && python -c "from app import create_app; create_app(); print('app ok')"`
- backend auth + quiz API smoke test via Flask test client against the real DB, with wrapper calls patched to verify:
  - `register`
  - `login`
  - `refresh`
  - `me`
  - `POST /api/quizzes`
  - `GET /api/quizzes`
  - `GET /api/quizzes/<quiz_id>`
  - `GET /api/quizzes/<quiz_id>/questions`
  - user-scoped isolation for quiz reads
- backend start smoke: `cd backend && python -m flask --app run.py run --no-debugger --no-reload`
- frontend start smoke: `cd frontend && python -m http.server 5500`

Results:
- Python compile/import checks passed
- app factory startup passed
- auth regression smoke passed
- quiz API smoke passed, including the validation repair path
- backend and frontend process start checks both reached `Running`
