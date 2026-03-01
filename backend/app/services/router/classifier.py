"""
LLM-based message classifier.

Called when heuristics returns confidence="low" (uncertain).
Uses gemini/gemini-2.5-flash for fast, cheap classification.

Return value
------------
dict with keys:
    category  : str  – "coding" | "reasoning" | "general"
    model     : str  – selected model slug
    confidence: str  – "high" (LLM decided) | "fallback" (LLM failed)
    method    : str  – "classifier" | "classifier_fallback"
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from app.services.wrapper.client import WrapperError, get_client
from app.services.router.heuristics import (
    MODEL_CODING,
    MODEL_DEFAULT,
    MODEL_REASONING,
    MODEL_CLASSIFY,
)

log = logging.getLogger(__name__)

_CATEGORY_TO_MODEL = {
    "coding":    MODEL_CODING,
    "reasoning": MODEL_REASONING,
    "general":   MODEL_DEFAULT,
}

_SYSTEM_PROMPT = (
    "You are a query classifier for an AI tutoring system. "
    "Classify the user's message into exactly one of these categories:\n"
    "  coding    – the message is primarily about programming or code\n"
    "  reasoning – the message requires multi-step mathematical, logical, "
    "or scientific reasoning\n"
    "  general   – everything else (factual question, concept explanation, etc.)\n\n"
    "Respond ONLY with a JSON object on a single line, no markdown:\n"
    '{"category": "<coding|reasoning|general>"}'
)


def classify(message: str) -> dict:
    """
    Call the LLM classifier to categorise *message*.

    Falls back to "general" / MODEL_DEFAULT when the LLM call fails or
    returns an unrecognised category.

    Returns
    -------
    dict
        category   : str
        model      : str
        confidence : "high" | "fallback"
        method     : "classifier" | "classifier_fallback"
    """
    try:
        client = get_client()
        resp = client.chat_completions(
            model=MODEL_CLASSIFY,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": message},
            ],
            temperature=0.0,
            max_tokens=32,
        )
        raw = resp["choices"][0]["message"]["content"].strip()
        # Strip markdown code fences if the LLM wrapped the JSON
        if raw.startswith("```"):
            raw = raw.split("```")[-2] if raw.count("```") >= 2 else raw
            raw = raw.lstrip("json").strip()
        data = json.loads(raw)
        category = data.get("category", "general").lower()
        if category not in _CATEGORY_TO_MODEL:
            category = "general"
        return {
            "category":   category,
            "model":      _CATEGORY_TO_MODEL[category],
            "confidence": "high",
            "method":     "classifier",
        }

    except (WrapperError, KeyError, json.JSONDecodeError, Exception) as exc:
        log.warning("classifier failed, falling back to general: %s", exc)
        return {
            "category":   "general",
            "model":      MODEL_DEFAULT,
            "confidence": "fallback",
            "method":     "classifier_fallback",
        }
