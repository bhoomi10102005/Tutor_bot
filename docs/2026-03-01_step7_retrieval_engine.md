# Step 7 – Retrieval Engine and Source Tracing

**Date:** 2026-03-01  
**Agent task:** Step 7 of master plan  
**Status:** Complete

---

## Task Summary

Implemented the RAG retrieval engine in `backend/app/services/rag/retrieval.py`.  
The engine embeds a user query via the wrapper, performs vector similarity search over stored chunks, filters results to the requesting user's current (latest) ingestion, and returns a structured citation-ready payload.

---

## Files Created / Edited

| File | Action |
|------|--------|
| `backend/app/services/rag/retrieval.py` | Created (was empty stub) |
| `test_retrieval.py` | Created – integration test (runs in Flask app context, no server needed) |

---

## Endpoints Added / Changed

None. `retrieval.py` is a pure service module — no HTTP routes added in this step. The function `retrieve_chunks()` will be consumed by the chat API in Step 8.

---

## DB Schema / Migration Changes

None. No new migrations. Uses existing `chunks`, `documents`, and `document_ingestions` tables as defined in Step 5/6.

---

## Public API

```python
from app.services.rag.retrieval import retrieve_chunks

results = retrieve_chunks(
    query_text="What is Python?",
    user_id="<uuid>",
    top_k=5,          # optional, default 5
)
```

Each result dict:
```python
{
    "chunk_id":       int,         # Chunk.id primary key
    "document_id":    str,         # Document.id UUID
    "snippet":        str,         # chunk text for display / citation
    "score":          float,       # cosine similarity ∈ [-1, 1]; higher = more relevant
    "document_title": str,         # Document.title
    "source_type":    str,         # "upload" | "text"
    "filename":       str | None,  # original filename; None for text documents
}
```

Results are ordered **descending by similarity** (most relevant first).  
Empty / whitespace-only queries short-circuit and return `[]` immediately.

---

## Implementation Notes

### Embedding
- Model: `gemini/gemini-embedding-001` (same as ingestion pipeline).
- Gemini returns 3072-dim vectors; truncated to 1536 using Matryoshka truncation — identical strategy to `ingestion.py` so stored and query vectors are comparable.
- All embedding calls go through `app.services.wrapper.client.get_client()`.

### Vector similarity
- Uses **pgvector cosine distance** (`<=>` operator via `Chunk.embedding.cosine_distance(query_vector)`).
- `score = 1 - cosine_distance`, keeping it in `[-1, 1]` (practically `[0, 1]` for related text).
- Query ordered by distance ASC → `.limit(top_k)` gives top-k most similar chunks.

### Filtering (user-scope + freshness)
- `Chunk.user_id == user_id` AND `Document.user_id == user_id` — double guard.
- `Document.is_deleted.is_(False)` — excludes soft-deleted documents.
- `Document.current_ingestion_id.isnot(None)` — excludes documents that never finished ingestion.
- `Chunk.ingestion_id == Document.current_ingestion_id` — only chunks from the **current** ingestion; stale chunks from superseded re-ingestion runs are never surfaced.

### Source tracing / citations
- `source_type` field distinguishes `"upload"` vs `"text"` documents.
- `filename` is present for uploads (PDF filename), `None` for text documents.
- `document_title` + `document_id` support linking citations back to the source document.

---

## Test Coverage (test_retrieval.py)

| Check | Result |
|-------|--------|
| Returns `top_k` results for a real query | ✅ |
| All required keys present in each result | ✅ |
| Types correct (chunk_id int, score float, etc.) | ✅ |
| Scores in `[-1, 1]` range | ✅ |
| Upload docs have `filename` set | ✅ |
| Results scoped to requesting user only | ✅ |
| Empty / whitespace query returns `[]` | ✅ |
| Unknown `user_id` returns 0 results | ✅ |

All tests passed with exit code 0.

---

## Decisions / Tradeoffs

- **Cosine distance over L2:** cosine similarity is magnitude-invariant and standard for text embeddings.
- **Matryoshka truncation (3072 → 1536):** matches ingestion; semantic quality is retained per Gemini model docs.
- **No IVFFlat/HNSW index in this step:** exact KNN is fine for current dataset size. An approximate index (`CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)`) can be added as a migration when the dataset scales.
- **Synchronous retrieval:** consistent with the rest of the codebase; no task queue needed until concurrency becomes an issue.
