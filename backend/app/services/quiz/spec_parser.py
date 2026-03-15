from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


ALLOWED_DIFFICULTIES = {"easy", "medium", "hard"}
ALLOWED_QUESTION_TYPES = {"mcq_single", "true_false"}
MAX_QUESTION_COUNT = 20


class QuizSpecError(ValueError):
    """Raised when the incoming quiz request payload is invalid."""


@dataclass(slots=True)
class QuizRequestSpec:
    title: str
    topic: str
    instructions: str | None
    question_count: int
    difficulty: str
    total_marks: float
    time_limit_sec: int | None
    question_types: list[str]
    document_ids: list[str] | None
    retrieval_query: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def parse_quiz_request(payload: dict[str, Any] | None) -> QuizRequestSpec:
    data = payload or {}

    topic = _clean_text(data.get("topic"))
    if not topic:
        raise QuizSpecError("topic is required")

    question_count = _parse_int(data.get("question_count"), "question_count", minimum=1)
    if question_count > MAX_QUESTION_COUNT:
        raise QuizSpecError(f"question_count must be <= {MAX_QUESTION_COUNT}")

    total_marks_raw = data.get("total_marks", data.get("marks", question_count))
    total_marks = _parse_float(total_marks_raw, "total_marks", minimum=0.01)

    difficulty = _clean_text(data.get("difficulty"), lower=True) or "medium"
    if difficulty not in ALLOWED_DIFFICULTIES:
        allowed = ", ".join(sorted(ALLOWED_DIFFICULTIES))
        raise QuizSpecError(f"difficulty must be one of: {allowed}")

    title = _clean_text(data.get("title")) or _default_title(topic)
    title = title[:255]

    instructions = _clean_text(data.get("instructions"))
    time_limit_sec = None
    if data.get("time_limit_sec") is not None:
        time_limit_sec = _parse_int(
            data.get("time_limit_sec"),
            "time_limit_sec",
            minimum=1,
        )

    question_types = _parse_question_types(data.get("question_types"))
    document_ids = _parse_document_ids(data.get("document_ids"))
    retrieval_query = _build_retrieval_query(topic=topic, instructions=instructions)

    return QuizRequestSpec(
        title=title,
        topic=topic,
        instructions=instructions,
        question_count=question_count,
        difficulty=difficulty,
        total_marks=round(total_marks, 2),
        time_limit_sec=time_limit_sec,
        question_types=question_types,
        document_ids=document_ids,
        retrieval_query=retrieval_query,
    )


def _build_retrieval_query(topic: str, instructions: str | None) -> str:
    if not instructions:
        return topic
    return f"{topic}\n\nQuiz focus: {instructions}"


def _default_title(topic: str) -> str:
    base = topic.strip()
    if len(base) > 180:
        base = base[:177].rstrip() + "..."
    return f"{base} Quiz"


def _parse_question_types(value: Any) -> list[str]:
    if value is None:
        return ["mcq_single"]
    if not isinstance(value, list) or not value:
        raise QuizSpecError("question_types must be a non-empty list when provided")

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise QuizSpecError("question_types entries must be strings")
        question_type = _normalize_question_type(item)
        if question_type not in ALLOWED_QUESTION_TYPES:
            allowed = ", ".join(sorted(ALLOWED_QUESTION_TYPES))
            raise QuizSpecError(f"unsupported question type '{item}'. Allowed: {allowed}")
        if question_type not in normalized:
            normalized.append(question_type)
    return normalized


def _parse_document_ids(value: Any) -> list[str] | None:
    if value in (None, [], ()):
        return None
    if not isinstance(value, list):
        raise QuizSpecError("document_ids must be a list when provided")

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise QuizSpecError("document_ids entries must be non-empty strings")
        doc_id = item.strip()
        if doc_id not in normalized:
            normalized.append(doc_id)
    return normalized or None


def _normalize_question_type(value: str) -> str:
    normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "mcq": "mcq_single",
        "multiple_choice": "mcq_single",
        "multiple_choice_single": "mcq_single",
        "single_choice": "mcq_single",
        "truefalse": "true_false",
        "true_or_false": "true_false",
    }
    return aliases.get(normalized, normalized)


def _parse_int(value: Any, field_name: str, minimum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise QuizSpecError(f"{field_name} must be an integer")
    if minimum is not None and parsed < minimum:
        raise QuizSpecError(f"{field_name} must be >= {minimum}")
    return parsed


def _parse_float(value: Any, field_name: str, minimum: float | None = None) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise QuizSpecError(f"{field_name} must be a number")
    if minimum is not None and parsed < minimum:
        raise QuizSpecError(f"{field_name} must be >= {minimum}")
    return parsed


def _clean_text(value: Any, *, lower: bool = False) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise QuizSpecError("text fields must be strings")
    text = value.strip()
    if not text:
        return None
    return text.lower() if lower else text
