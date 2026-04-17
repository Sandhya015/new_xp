"""Static completion quizzes (Python fundamentals + Java seed); questions only via API without correct indices."""

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

JAVA_QUIZ_QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "jv1",
        "question": "Which keyword declares a class in Java?",
        "options": ["struct", "class", "def", "object"],
        "correctIndex": 1,
    },
    {
        "id": "jv2",
        "question": "What is the correct signature of the application entry point in Java?",
        "options": [
            "public static void main(String[] args)",
            "public void main(String argv)",
            "static void main()",
            "void main(String[] args)",
        ],
        "correctIndex": 0,
    },
    {
        "id": "jv3",
        "question": "Which type is used to store a key-value mapping in Java?",
        "options": ["ArrayList", "HashMap", "HashSet", "LinkedList"],
        "correctIndex": 1,
    },
    {
        "id": "jv4",
        "question": "Which access modifier makes a member visible only within its own class?",
        "options": ["public", "protected", "private", "package-private (no keyword)"],
        "correctIndex": 2,
    },
    {
        "id": "jv5",
        "question": "What does `final` mean when applied to a method in Java?",
        "options": [
            "The method cannot be overridden in subclasses",
            "The method must return void",
            "The method is synchronized",
            "The method is deprecated",
        ],
        "correctIndex": 0,
    },
]

PASS_PERCENT = 60

JAVA_SEED_SLUG = "demo-java-programming-seed"


def _question_bank(course: dict | None) -> list[dict[str, Any]]:
    slug = (course.get("slug") or "").strip().lower() if course else ""
    if slug == JAVA_SEED_SLUG:
        return JAVA_QUIZ_QUESTIONS
    return PYTHON_QUIZ_QUESTIONS


def quiz_questions_for_client(course: dict | None = None) -> list[dict[str, Any]]:
    bank = _question_bank(course)
    out = []
    for q in bank:
        out.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
        })
    return out


def grade_quiz(answer_indices: list[int], course: dict | None = None) -> tuple[bool, int]:
    """
    answer_indices: selected option index per question, same order as the bank for this course.
    Returns (passed, score_percent).
    """
    bank = _question_bank(course)
    total = len(bank)
    if total == 0:
        return True, 100
    if len(answer_indices) != total:
        return False, 0
    correct = 0
    for i, q in enumerate(bank):
        try:
            sel = int(answer_indices[i])
        except (TypeError, ValueError):
            sel = -1
        if sel == q["correctIndex"]:
            correct += 1
    pct = int(round(100 * correct / total))
    return pct >= PASS_PERCENT, pct
