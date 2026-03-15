# Quiz Endpoint Test Script

## Task Summary

Added a dedicated integration test script for the Step 11 quiz APIs.

The test verifies:
- auth setup for temporary test users
- protected access on quiz routes
- request validation on quiz creation
- `POST /api/quizzes`
- `GET /api/quizzes`
- `GET /api/quizzes/<quiz_id>`
- `GET /api/quizzes/<quiz_id>/questions`
- user-scoped isolation on all quiz read endpoints

The script uses Flask's test client and patches quiz-generation dependencies so quiz endpoint behavior can be tested deterministically without live wrapper calls.

## Files Created/Edited

Created:
- `test_quizzes.py`
- `docs/2026-03-15_1653_quiz_endpoint_test_script.md`

Edited:
- None

## Endpoints Added/Changed

None.

This task only adds a test for existing endpoints:
- `POST /api/quizzes`
- `GET /api/quizzes`
- `GET /api/quizzes/<quiz_id>`
- `GET /api/quizzes/<quiz_id>/questions`

## DB Schema / Migration Changes

None.

## Decisions / Tradeoffs

1. The test uses Flask test client instead of live HTTP so endpoint logic can be verified without depending on the already-running backend process.
2. Wrapper-backed retrieval/generation is patched inside the test because real upstream wrapper calls were timing out during environment verification.
3. The test still uses the real database schema and seeds temporary user/document/chunk data so route ownership and persistence behavior are exercised meaningfully.
4. Temporary users created by the test are deleted in cleanup so repeated runs do not accumulate quiz test data.

## Validation Notes

Command run:
- `python test_quizzes.py`

Result:
- passed successfully

Observed coverage from the passing run:
- register/login/refresh/me setup path worked
- quiz auth enforcement worked
- invalid quiz create requests returned expected errors
- quiz create/list/detail/questions routes passed
- cross-user access returned `404` as expected
