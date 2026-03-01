"""
RAG answer generation.

Public API
----------
    generate_answer(
        question: str,
        user_id:  str,
        model:    str,
        history:  list[dict],   # prior {"role": ..., "content": ...} turns
        top_k:    int = 5,
    ) -> dict

Return value
------------
{
    "answer":   str,            – assistant's reply
    "model":    str,            – model slug actually used
    "sources":  list[dict],     – chunk citations (chunk_id, document_id,
                                   snippet, score, document_title,
                                   source_type, filename)
}

Architecture rules:
  - Uses retrieve_chunks() from retrieval.py for vector search.
  - Calls wrapper via get_client().chat_completions().
  - Falls back to routeway/glm-4.5-air:free when the primary model fails.
"""

from __future__ import annotations

import logging
from typing import List

from app.services.rag.retrieval import retrieve_chunks
from app.services.wrapper.client import WrapperError, get_client

log = logging.getLogger(__name__)

_FALLBACK_MODEL = "routeway/glm-4.5-air:free"
_FALLBACK_GEMINI = "gemini/gemini-2.5-flash"

_SYSTEM_TEMPLATE = """\
You are a knowledgeable and helpful AI tutor. Answer the student's question \
accurately and clearly.

When relevant context is provided below, base your answer on it and cite \
sources using [Source N] notation where N is the source number. If the \
context does not contain enough information to answer fully, supplement with \
your general knowledge and say so.

Context from the student's uploaded documents:
{context_block}
"""

_NO_CONTEXT_SYSTEM = """\
You are a knowledgeable and helpful AI tutor. Answer the student's question \
accurately and clearly. No document context is available for this question.
"""


def _build_context_block(sources: List[dict]) -> str:
    if not sources:
        return "(no relevant document context found)"
    lines = []
    for i, s in enumerate(sources, start=1):
        title = s.get("document_title", "Unknown")
        snippet = s.get("snippet", "").strip()
        source_type = s.get("source_type", "")
        fname = s.get("filename")
        label = fname if fname else title
        lines.append(f"[Source {i}] {label} ({source_type}):\n{snippet}")
    return "\n\n".join(lines)


def _chat_with_fallback(model: str, messages: list, max_tokens: int = 1024) -> tuple[str, str]:
    """
    Attempt chat completion with *model*. On failure, try fallback chains.

    Returns
    -------
    (answer_text, model_used)
    """
    fallback_chain = [model]

    # Add fallback models that aren't already in the chain
    for fb in [_FALLBACK_MODEL, _FALLBACK_GEMINI]:
        if fb != model:
            fallback_chain.append(fb)

    client = get_client()
    last_exc = None

    for attempt_model in fallback_chain:
        try:
            resp = client.chat_completions(
                model=attempt_model,
                messages=messages,
                temperature=0.7,
                max_tokens=max_tokens,
            )
            text = resp["choices"][0]["message"]["content"]
            if attempt_model != model:
                log.info(
                    "answering: primary model %s failed, used fallback %s",
                    model, attempt_model,
                )
            return text, attempt_model
        except (WrapperError, KeyError, IndexError) as exc:
            log.warning("answering: model %s failed: %s", attempt_model, exc)
            last_exc = exc

    raise WrapperError(
        f"All models failed for answer generation. Last error: {last_exc}"
    )


def generate_answer(
    question: str,
    user_id: str,
    model: str,
    history: List[dict] | None = None,
    top_k: int = 5,
) -> dict:
    """
    Generate a RAG-augmented answer for *question*.

    Parameters
    ----------
    question : str
        The user's current message.
    user_id  : str
        UUID of the requesting user (for chunk scoping).
    model    : str
        Primary model slug selected by the router.
    history  : list[dict] | None
        Prior conversation turns as {"role": ..., "content": ...} dicts.
        Do not include the current question; it is appended automatically.
    top_k    : int
        Number of chunks to retrieve (default 5).

    Returns
    -------
    dict
        answer  : str
        model   : str (model actually used)
        sources : list[dict] (retrieval results, possibly empty)
    """
    history = history or []

    # ── 1. Retrieve relevant chunks ──────────────────────────────────────────
    try:
        sources = retrieve_chunks(query_text=question, user_id=user_id, top_k=top_k)
    except WrapperError as exc:
        log.warning("answering: retrieval failed, proceeding without context: %s", exc)
        sources = []

    # ── 2. Build prompt ──────────────────────────────────────────────────────
    if sources:
        context_block = _build_context_block(sources)
        system_content = _SYSTEM_TEMPLATE.format(context_block=context_block)
    else:
        system_content = _NO_CONTEXT_SYSTEM

    messages = [{"role": "system", "content": system_content}]

    # Include conversation history (user/assistant turns, no system)
    for turn in history:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})

    # Append the current question
    messages.append({"role": "user", "content": question})

    # ── 3. Generate answer ───────────────────────────────────────────────────
    answer_text, model_used = _chat_with_fallback(model=model, messages=messages)

    return {
        "answer":  answer_text,
        "model":   model_used,
        "sources": sources,
    }
