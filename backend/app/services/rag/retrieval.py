"""
RAG retrieval engine.

Public API
----------
    retrieve_chunks(query_text, user_id, top_k=5) -> list[dict]

Each returned dict has the following keys:
    chunk_id        : int   – primary key of the Chunk row
    document_id     : str   – UUID of the parent Document
    snippet         : str   – raw chunk text (for display / citation)
    score           : float – cosine similarity (higher = more relevant)
    document_title  : str   – human-readable document title
    source_type     : str   – "upload" | "text"
    filename        : str | None  – original filename (upload only, else None)

Architecture rules enforced here:
  - LLM/embedding calls only via WrapperClient (get_client).
  - DB access only via SQLAlchemy models.
  - All results scoped to the requesting user_id.
  - Only chunks belonging to the document's *current* ingestion are surfaced,
    so stale chunks from superseded ingestion runs are never returned.
"""

from __future__ import annotations

import logging
from typing import List

from app.db.models.chunk import Chunk
from app.db.models.document import Document
from app.extensions import db
from app.services.wrapper.client import WrapperError, get_client

log = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini/gemini-embedding-001"
_EMBED_DIM = 1536  # Must match the Vector(1536) column on Chunk.embedding


# ── Embedding helper ──────────────────────────────────────────────────────────

def _embed_query(query_text: str) -> List[float]:
    """
    Embed a single query string via the wrapper and return a 1536-dim vector.

    Gemini embedding-001 returns 3072 dims; we truncate to 1536 using
    Matryoshka truncation (same strategy as ingestion) so the vectors are
    comparable to stored chunk embeddings.

    Raises WrapperError on any embedding failure.
    """
    client = get_client()
    response = client.embeddings(model=EMBEDDING_MODEL, input=query_text)

    data = response.get("data", [])
    if not data:
        raise WrapperError("Embeddings response contained no data items")

    embedding = data[0].get("embedding")
    if embedding is None:
        raise WrapperError("Embedding response missing 'embedding' field")

    return embedding[:_EMBED_DIM]


# ── Retrieval ─────────────────────────────────────────────────────────────────

def retrieve_chunks(
    query_text: str,
    user_id: str,
    top_k: int = 5,
) -> List[dict]:
    """
    Embed *query_text* and return the *top_k* most similar chunks belonging
    to *user_id* whose parent document is not deleted and has a completed
    (current) ingestion.

    Parameters
    ----------
    query_text : str
        The user's raw query or passage to match against.
    user_id : str
        UUID of the requesting user. Results are strictly scoped to this user.
    top_k : int
        Maximum number of chunks to return (default 5).

    Returns
    -------
    list[dict]
        Ordered by descending similarity (most relevant first).
        Each dict contains:
            chunk_id, document_id, snippet, score,
            document_title, source_type, filename
    """
    if not query_text or not query_text.strip():
        return []

    query_vector = _embed_query(query_text.strip())

    # pgvector cosine distance operator (<=>).
    # Lower distance  →  more similar  →  we ORDER BY distance ASC.
    # Cosine distance is in [0, 2] for unit vectors.  Similarity = 1 - distance
    # which stays in [-1, 1] but is practically [0, 1] for semantically related
    # text, where 1.0 = identical and 0.0 = orthogonal.
    distance_expr = Chunk.embedding.cosine_distance(query_vector)

    rows = (
        db.session.query(
            Chunk,
            Document,
            distance_expr.label("distance"),
        )
        .join(Document, Document.id == Chunk.document_id)
        .filter(
            # User-scope guard on both sides of the join
            Chunk.user_id == user_id,
            Document.user_id == user_id,
            # Only non-deleted documents with a completed ingestion
            Document.is_deleted.is_(False),
            Document.current_ingestion_id.isnot(None),
            # Only chunks from the document's current (latest) ingestion
            Chunk.ingestion_id == Document.current_ingestion_id,
        )
        .order_by(distance_expr)
        .limit(top_k)
        .all()
    )

    results: List[dict] = []
    for chunk, doc, distance in rows:
        score = round(1.0 - float(distance), 6)
        results.append(
            {
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "snippet": chunk.content,
                "score": score,
                "document_title": doc.title,
                "source_type": doc.source_type,   # "upload" | "text"
                "filename": doc.filename,          # None for source_type="text"
            }
        )

    log.debug(
        "retrieve_chunks user_id=%s top_k=%d query_len=%d results=%d",
        user_id,
        top_k,
        len(query_text),
        len(results),
    )

    return results
