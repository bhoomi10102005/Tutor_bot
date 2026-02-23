# Tutor Bot — Implementation Summary

**Last updated:** 2026-02-23  
**Phase completed:** Phase 2 — Auth + User Scoping

---

## Project Overview

Tutor Bot is a personal AI study workspace with:
- A **Flask REST API** backend (with JWT auth + PostgreSQL via Neon)
- A **Streamlit** multi-page frontend
- Future phases: RAG (document chat), quizzes, analytics

---

## Current File Structure

```
Tutor_bot/
├── .env                         ← live secrets (DB URL, JWT key, etc.)
├── .env.example                 ← template for new devs
├── docker-compose.yml           ← (empty, Phase 6)
├── README.md
├── docs/
│   ├── structure_scaffold.md    ← Phase 1 scaffold notes
│   └── implementation_summary.md ← this file
│
├── backend/
│   ├── run.py                   ← Flask entry point
│   ├── requirements.txt
│   ├── migrations/              ← Alembic (Flask-Migrate) auto-generated
│   │   └── versions/
│   │       └── b0536757bfa6_create_users_table.py
│   └── app/
│       ├── __init__.py          ← create_app() factory
│       ├── config.py            ← Config / DevelopmentConfig / ProductionConfig
│       ├── extensions.py        ← db, migrate, jwt singletons
│       ├── api/
│       │   ├── __init__.py
│       │   ├── auth.py          ← /api/auth/* endpoints  ✅ IMPLEMENTED
│       │   ├── chat.py          ← (Phase 3)
│       │   ├── documents.py     ← (Phase 3)
│       │   ├── quizzes.py       ← (Phase 4)
│       │   └── analytics.py    ← (Phase 5)
│       ├── services/
│       │   ├── wrapper/         ← LLM wrapper client (Phase 3)
│       │   ├── rag/             ← RAG pipeline (Phase 3)
│       │   ├── router/          ← query router (Phase 3)
│       │   ├── quiz/            ← quiz engine (Phase 4)
│       │   └── analytics/       ← events + metrics (Phase 5)
│       └── db/
│           ├── models/
│           │   ├── __init__.py
│           │   └── user.py      ← User model  ✅ LIVE IN DB
│           └── migrations/      ← (placeholder, actual in backend/migrations/)
│
└── frontend/
    ├── requirements.txt
    ├── Home.py                  ← auth-gated dashboard  ✅ IMPLEMENTED
    ├── components/
    │   ├── __init__.py
    │   └── api_client.py        ← all HTTP calls to Flask  ✅ IMPLEMENTED
    └── pages/
        ├── 0_Login.py           ← Login + Register UI     ✅ IMPLEMENTED
        ├── 1_Chat_Tutor.py      ← auth guard stub (Phase 3)
        ├── 2_Upload_Documents.py← auth guard stub (Phase 3)
        ├── 3_Create_Quiz.py     ← auth guard stub (Phase 4)
        ├── 4_Take_Quiz.py       ← auth guard stub (Phase 4)
        └── 5_Analytics.py       ← auth guard stub (Phase 5)
```

---

## Phase 1 — Scaffold (Done)

- Created all empty files matching the project spec
- No code, just folder + file structure

---

## Phase 2 — Auth + User Scoping (Done)

### Database (`users` table — live on Neon PostgreSQL)

| Column          | Type         | Constraints              |
|-----------------|--------------|--------------------------|
| `id`            | VARCHAR(36)  | PK, UUID default         |
| `email`         | VARCHAR(255) | UNIQUE, NOT NULL         |
| `username`      | VARCHAR(100) | UNIQUE, nullable         |
| `password_hash` | TEXT         | NOT NULL                 |
| `created_at`    | TIMESTAMP    | NOT NULL, default now()  |
| `is_active`     | BOOLEAN      | NOT NULL, default true   |

Migration file: `backend/migrations/versions/b0536757bfa6_create_users_table.py`

---

### Backend API Endpoints

Base path: `http://localhost:5000/api/auth`

| Method | Path       | Auth required | Description                          |
|--------|------------|---------------|--------------------------------------|
| POST   | /register  | No            | Create account, returns JWT pair     |
| POST   | /login     | No            | Verify credentials, returns JWT pair |
| POST   | /refresh   | Refresh token | Issue new access token               |
| GET    | /me        | Access token  | Return current user profile          |

**Response shape** (register / login):
```json
{
  "access_token":  "<JWT>",
  "refresh_token": "<JWT>",
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "username": "study_hero",
    "created_at": "2026-02-23T...",
    "is_active": true
  }
}
```

**JWT identity:** `user.id` (UUID string) — every protected route calls `get_jwt_identity()` to scope queries to that user.

**Password hashing:** `werkzeug.security.generate_password_hash` / `check_password_hash`

---

### Backend Stack

| Package             | Purpose                          |
|---------------------|----------------------------------|
| Flask               | Web framework                    |
| Flask-SQLAlchemy    | ORM                              |
| Flask-Migrate       | Alembic migrations wrapper       |
| Flask-JWT-Extended  | JWT issue / verify               |
| psycopg2-binary     | PostgreSQL driver                |
| Werkzeug            | Password hashing                 |
| python-dotenv       | Load `.env`                      |
| pgvector            | Vector column type (Phase 3)     |

---

### Frontend

| File                         | Role                                                      |
|------------------------------|-----------------------------------------------------------|
| `components/api_client.py`   | Single HTTP client; attaches `Authorization: Bearer` header to every authed call |
| `pages/0_Login.py`           | Sign In + Create Account tabs; stores tokens in `st.session_state` |
| `Home.py`                    | Auth guard → redirects to 0_Login if no token; shows dashboard cards |
| All other pages              | Auth guard → same redirect; placeholder content           |

**Token storage:** `st.session_state["access_token"]`, `st.session_state["refresh_token"]`, `st.session_state["user"]`

**UI theme (Calm Tutor):**

| Token          | Value     |
|----------------|-----------|
| Background     | `#0B1220` |
| Surface / cards| `#111B2E` |
| Primary        | `#6D5EF7` |
| Success        | `#22C55E` |
| Text           | `#E6EAF2` |
| Muted text     | `#A7B0C0` |
| Border         | `#22304A` |

---

### Environment Variables

| Variable        | Used by       | Description                        |
|-----------------|---------------|------------------------------------|
| `DATABASE_URL`  | Backend       | Neon PostgreSQL connection string  |
| `SECRET_KEY`    | Backend       | Flask secret                       |
| `JWT_SECRET_KEY`| Backend       | JWT signing key                    |
| `WRAPPER_BASE_URL` | Backend    | LLM wrapper base URL (Phase 3)     |
| `WRAPPER_KEY`   | Backend       | LLM wrapper API key (Phase 3)      |
| `API_BASE_URL`  | Frontend      | `http://localhost:5000` by default |

---

### How to Run

```bash
# Backend
cd backend
flask run              # starts on :5000

# Frontend (separate terminal)
cd frontend
streamlit run Home.py  # starts on :8501
```

---

## Verification Results (Phase 2)

All checks executed against live Neon DB + local Flask server:

| Check                        | Status | HTTP code |
|------------------------------|--------|-----------|
| POST /register               | PASS   | 201       |
| POST /login (correct creds)  | PASS   | 200       |
| GET  /me (valid token)       | PASS   | 200       |
| GET  /me (bad token)         | PASS   | 422       |
| POST /refresh                | PASS   | 200       |
| POST /login (wrong password) | PASS   | 401       |

---

## Next Phases

| Phase | Goal                                               |
|-------|----------------------------------------------------|
| 3     | Documents + RAG chat (upload, chunk, vector search, answer) |
| 4     | Quiz generation, taking, grading                   |
| 5     | Analytics — usage metrics and learning progress    |
| 6     | Docker Compose, production config, HTTPS           |
