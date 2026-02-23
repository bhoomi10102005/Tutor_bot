# Tutor-Bot Project Scaffold

**Date:** 2026-02-23  
**Task:** Create empty file structure + Users table setup for the tutor-bot project.

## What Was Done

Created all empty files for the tutor-bot project layout. No code was written — files are placeholders only.

## File Tree Created

```
Tutor_bot/
├── README.md
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── run.py
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── config.py
│       ├── extensions.py
│       ├── api/
│       │   ├── auth.py
│       │   ├── documents.py
│       │   ├── chat.py
│       │   ├── quizzes.py
│       │   └── analytics.py
│       ├── services/
│       │   ├── wrapper/
│       │   │   ├── client.py
│       │   │   └── retry.py
│       │   ├── rag/
│       │   │   ├── ingestion.py
│       │   │   ├── chunking.py
│       │   │   ├── retrieval.py
│       │   │   └── answering.py
│       │   ├── router/
│       │   │   ├── heuristics.py
│       │   │   └── classifier.py
│       │   ├── quiz/
│       │   │   ├── spec_parser.py
│       │   │   ├── generator.py
│       │   │   ├── validator.py
│       │   │   ├── grading.py
│       │   │   └── summarizer.py
│       │   └── analytics/
│       │       ├── metrics.py
│       │       └── events.py
│       └── db/
│           ├── models/          (.gitkeep)
│           └── migrations/      (.gitkeep)
└── frontend/
    ├── Home.py
    ├── pages/
    │   ├── 1_Chat_Tutor.py
    │   ├── 2_Upload_Documents.py
    │   ├── 3_Create_Quiz.py
    │   ├── 4_Take_Quiz.py
    │   └── 5_Analytics.py
    └── components/
        └── api_client.py
```

## Architecture Intent (from spec)

| Layer | Purpose |
|---|---|
| `backend/app/api/` | Flask REST API — only communicates with the wrapper service |
| `backend/app/services/wrapper/` | Calls `/v1/chat/completions` and `/v1/embeddings` on the LLM wrapper |
| `backend/app/services/rag/` | Document ingestion, chunking, pgvector retrieval, and answer generation |
| `backend/app/services/router/` | Heuristic + LLM-based query routing (Gemini 2.5 Flash via wrapper) |
| `backend/app/services/quiz/` | Quiz spec parsing, generation, validation, grading, summarization |
| `backend/app/services/analytics/` | Usage metrics and event tracking |
| `backend/app/db/` | SQLAlchemy models and Alembic migrations |
| `frontend/` | Streamlit multi-page app — calls Flask API only via `components/api_client.py` |

## Database Setup

**Provider:** Neon PostgreSQL (serverless, SSL required)

### Tables Created
| Table | Status |
|---|---|
| `users` | ✅ Created via Flask-Migrate |
| `alembic_version` | ✅ Managed by Flask-Migrate |

### users schema
| Column | Type | Constraints |
|---|---|---|
| `id` | VARCHAR(36) | PK, UUID default |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `username` | VARCHAR(100) | UNIQUE, nullable |
| `password_hash` | TEXT | NOT NULL |
| `created_at` | TIMESTAMP | NOT NULL, default now() |
| `is_active` | BOOLEAN | NOT NULL, default true |

### Migration command flow
```bash
cd backend/
flask db init          # one-time setup
flask db migrate -m "create users table"
flask db upgrade
```

## Key Config Variables (from spec)

- `WRAPPER_BASE_URL` — base URL of the LLM wrapper
- `WRAPPER_KEY` — API key for the wrapper
- `DB_URL` — PostgreSQL connection string (with pgvector)

## Extensions (extensions.py)

- `db` — SQLAlchemy
- `migrate` — Flask-Migrate
- `jwt` — Flask-JWT-Extended
