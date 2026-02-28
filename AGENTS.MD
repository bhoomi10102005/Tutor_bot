# AGENTS.MD - Tutor Bot Agent Operating Guide

Every agent working in this repository must read this file before starting any task.

After completing any implementation task, create a new file in `docs/`:

`YYYY-MM-DD_<short_description>.md`

Example: `2026-02-24_phase3_documents_api.md`

This file is persistent project memory for future agents.


## 1) Environment Variables

Required backend vars:
- `DATABASE_URL`
- `SECRET_KEY`
- `JWT_SECRET_KEY`
- `WRAPPER_BASE_URL`
- `WRAPPER_KEY`
- `CORS_ALLOWED_ORIGINS` (for browser frontend API calls)

Required frontend var:
- `API_BASE_URL` (default `http://localhost:5000`)

Rules:
- Never commit real secrets.
- Keep `.env.example` aligned with required vars.
- Wrapper key stays in backend env only.

## 2) Definition Of Done For Any Agent Task

A task is not complete until all are true:

1. Requested implementation is finished.
2. Existing auth flow still works.
3. New/changed endpoints run correctly.
4. New migrations apply cleanly (if schema changed).
5. Frontend still uses only `components/api_client.js` for HTTP.
6. A new docs memory file is added in `docs/`.
7. Docs memory file includes:
   - task summary
   - files created/edited
   - endpoints added/changed
   - DB schema/migration changes
   - decisions/tradeoffs

---

## 3) Testing Expectations

Minimum checks after changes:

1. Backend starts:
```bash
cd backend
flask run
```

2. Frontend starts:
```bash
cd frontend
python -m http.server 5500
```

3. Auth regression checks:
- register
- login
- refresh
- me

4. Validate only user-scoped data is returned on protected endpoints.

---

## 4) Wrapper Usage Policy

Tutor app talks only to wrapper endpoints:
- `POST /v1/chat/completions`
- `POST /v1/embeddings`

Operational expectations:
- retries for 429/502/503/504
- timeout handling
- normalized error handling in service layer

Model routing policy (target):
- default tutor: `routeway/glm-4.5-air:free`
- hard reasoning: `routeway/deepseek-r1:free`
- coding tasks: `routeway/devstral-2512:free`
- classification/fast tasks: `gemini/gemini-2.5-flash`
- embeddings: `gemini/gemini-embedding-001`

## 5) Handoff Template (Copy/Paste)

Use this when assigning one step to another agent:

```text
Read AGENTS.MD, docs/* (newest first), and plan.md.
Implement only Step <N>.
Constraints:
- preserve auth behavior
- use SQLAlchemy models and Flask-Migrate for schema changes
- frontend HTTP only via frontend/components/api_client.js
- backend LLM calls only via backend/app/services/wrapper/client.py
After completion:
- run relevant checks
- create docs/YYYY-MM-DD_step<N>_<short_desc>.md
- list changed files, migrations, and endpoints
```
