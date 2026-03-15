from __future__ import annotations

from typing import Any

from app.db.models.quiz_question import QuizQuestion


class QuizGradingError(ValueError):
    """Raised when a quiz submission payload is invalid."""


def grade_quiz_submission(
    questions: list[QuizQuestion],
    submitted_answers: Any,
) -> dict[str, Any]:
    if submitted_answers is None:
        submitted_answers = []
    if not isinstance(submitted_answers, list):
        raise QuizGradingError("answers must be a list")

    question_map = {question.id: question for question in questions}
    normalized_answers: dict[str, dict[str, Any] | None] = {}

    for index, answer_payload in enumerate(submitted_answers):
        label = f"answers[{index}]"
        if not isinstance(answer_payload, dict):
            raise QuizGradingError(f"{label} must be an object")

        question_id = answer_payload.get("question_id")
        if not isinstance(question_id, str) or not question_id.strip():
            raise QuizGradingError(f"{label}.question_id is required")
        question_id = question_id.strip()

        question = question_map.get(question_id)
        if question is None:
            raise QuizGradingError(f"{label}.question_id does not belong to this quiz")
        if question_id in normalized_answers:
            raise QuizGradingError(f"duplicate answer submitted for question_id {question_id}")

        normalized_answers[question_id] = _normalize_chosen_answer(
            question=question,
            answer_payload=answer_payload,
            label=label,
        )

    results: list[dict[str, Any]] = []
    score = 0.0
    answered_count = 0
    correct_count = 0
    incorrect_count = 0
    unanswered_count = 0

    total_marks = round(sum(float(question.marks) for question in questions), 2)

    for question in questions:
        chosen_json = normalized_answers.get(question.id)
        if chosen_json is None:
            unanswered_count += 1
            is_correct = None
            marks_awarded = 0.0
        else:
            answered_count += 1
            is_correct = _is_correct_answer(question.correct_json, chosen_json)
            if is_correct:
                correct_count += 1
                marks_awarded = round(float(question.marks), 2)
            else:
                incorrect_count += 1
                marks_awarded = 0.0

        score = round(score + marks_awarded, 2)
        results.append(
            {
                "question": question,
                "chosen_json": chosen_json,
                "is_correct": is_correct,
                "marks_awarded": marks_awarded,
            }
        )

    accuracy_pct = round((score / total_marks) * 100, 2) if total_marks > 0 else 0.0

    return {
        "results": results,
        "score": score,
        "total_marks": total_marks,
        "answered_count": answered_count,
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "unanswered_count": unanswered_count,
        "accuracy_pct": accuracy_pct,
    }


def _normalize_chosen_answer(
    question: QuizQuestion,
    answer_payload: dict[str, Any],
    label: str,
) -> dict[str, Any] | None:
    if "chosen_json" in answer_payload:
        return _normalize_raw_choice(question, answer_payload.get("chosen_json"), label)

    for key in ("chosen_option_index", "option_index", "selected_option_index"):
        if key in answer_payload:
            return _choice_from_index(question, answer_payload.get(key), f"{label}.{key}")

    for key in ("option_text", "selected_option", "answer_text"):
        if key in answer_payload:
            return _choice_from_text(question, answer_payload.get(key), f"{label}.{key}")

    if "answer" in answer_payload:
        return _normalize_raw_choice(question, answer_payload.get("answer"), f"{label}.answer")

    return None


def _normalize_raw_choice(
    question: QuizQuestion,
    raw_choice: Any,
    label: str,
) -> dict[str, Any] | None:
    if raw_choice is None:
        return None

    if isinstance(raw_choice, dict):
        if "option_index" in raw_choice:
            return _choice_from_index(question, raw_choice.get("option_index"), f"{label}.option_index")
        if "option_text" in raw_choice:
            return _choice_from_text(question, raw_choice.get("option_text"), f"{label}.option_text")
        if "answer" in raw_choice:
            return _normalize_raw_choice(question, raw_choice.get("answer"), f"{label}.answer")
        raise QuizGradingError(f"{label} must include option_index, option_text, or answer")

    if isinstance(raw_choice, bool):
        if question.type != "true_false":
            raise QuizGradingError(f"{label} boolean answers are only valid for true_false questions")
        return _choice_from_text(question, "True" if raw_choice else "False", label)

    if isinstance(raw_choice, int):
        return _choice_from_index(question, raw_choice, label)

    if isinstance(raw_choice, str):
        cleaned = raw_choice.strip()
        if not cleaned:
            return None
        if cleaned.isdigit():
            return _choice_from_index(question, int(cleaned), label)
        return _choice_from_text(question, cleaned, label)

    raise QuizGradingError(f"{label} contains an unsupported answer type")


def _choice_from_index(
    question: QuizQuestion,
    raw_index: Any,
    label: str,
) -> dict[str, Any]:
    try:
        option_index = int(raw_index)
    except (TypeError, ValueError):
        raise QuizGradingError(f"{label} must be an integer option index")

    options = _question_options(question)
    if option_index < 0 or option_index >= len(options):
        raise QuizGradingError(f"{label} is out of range for the available options")

    return {
        "option_index": option_index,
        "option_text": options[option_index],
    }


def _choice_from_text(
    question: QuizQuestion,
    raw_text: Any,
    label: str,
) -> dict[str, Any]:
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise QuizGradingError(f"{label} must be a non-empty string")

    text = raw_text.strip()
    options = _question_options(question)
    normalized_text = text.lower()

    if len(normalized_text) == 1 and normalized_text in "abcdefghijklmnopqrstuvwxyz":
        alpha_index = ord(normalized_text) - ord("a")
        if 0 <= alpha_index < len(options):
            return {
                "option_index": alpha_index,
                "option_text": options[alpha_index],
            }

    for option_index, option_text in enumerate(options):
        if option_text.strip().lower() == normalized_text:
            return {
                "option_index": option_index,
                "option_text": option_text,
            }

    raise QuizGradingError(f"{label} does not match any available option")


def _question_options(question: QuizQuestion) -> list[str]:
    options = question.options_json or []
    if not isinstance(options, list) or not options:
        raise QuizGradingError(f"question {question.id} has no options to grade against")
    return [str(option) for option in options]


def _is_correct_answer(correct_json: Any, chosen_json: dict[str, Any]) -> bool:
    if not isinstance(correct_json, dict):
        return False

    correct_index = correct_json.get("option_index")
    chosen_index = chosen_json.get("option_index")
    if correct_index is not None and chosen_index is not None:
        return int(correct_index) == int(chosen_index)

    correct_text = _normalize_text(correct_json.get("option_text"))
    chosen_text = _normalize_text(chosen_json.get("option_text"))
    if correct_text and chosen_text:
        return correct_text == chosen_text

    return correct_json == chosen_json


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None
