"""Static Python fundamentals quiz (questions only revealed via API without correct indices)."""

from __future__ import annotations

from typing import Any

# correct_index: 0-based index into options
PYTHON_QUIZ_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "py1",
        "question": "What is the output of `print(type([]))` in Python 3?",
        "options": ["<class 'list'>", "<class 'array'>", "<type 'list'>", "<class 'tuple'>"],
        "correctIndex": 0,
    },
    {
        "id": "py2",
        "question": "Which keyword defines a function in Python?",
        "options": ["function", "def", "fn", "lambda"],
        "correctIndex": 1,
    },
    {
        "id": "py3",
        "question": "What does `//` perform in Python?",
        "options": ["Exponentiation", "Floor division", "Bitwise OR", "String concat"],
        "correctIndex": 1,
    },
    {
        "id": "py4",
        "question": "How do you create a virtual environment using the standard library (Python 3)?",
        "options": ["pip env create", "python -m venv .venv", "python --virtualenv", "venv init"],
        "correctIndex": 1,
    },
    {
        "id": "py5",
        "question": "Which collection type preserves insertion order in Python 3.7+?",
        "options": ["set", "dict", "Both dict and list", "Only set"],
        "correctIndex": 2,
    },
]

PASS_PERCENT = 60


def quiz_questions_for_client() -> list[dict[str, Any]]:
    out = []
    for q in PYTHON_QUIZ_QUESTIONS:
        out.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
        })
    return out


def grade_quiz(answer_indices: list[int]) -> tuple[bool, int]:
    """
    answer_indices: selected option index per question, same order as PYTHON_QUIZ_QUESTIONS.
    Returns (passed, score_percent).
    """
    total = len(PYTHON_QUIZ_QUESTIONS)
    if total == 0:
        return True, 100
    if len(answer_indices) != total:
        return False, 0
    correct = 0
    for i, q in enumerate(PYTHON_QUIZ_QUESTIONS):
        try:
            sel = int(answer_indices[i])
        except (TypeError, ValueError):
            sel = -1
        if sel == q["correctIndex"]:
            correct += 1
    pct = int(round(100 * correct / total))
    return pct >= PASS_PERCENT, pct
