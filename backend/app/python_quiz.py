"""Static completion quizzes (Python fundamentals + Java seed); curriculum-driven completion when completionQuizTitle is set."""

from __future__ import annotations

from typing import Any, Optional

from app.services.curriculum import normalize_quiz_question

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


def _modules_iter(course: dict | None) -> list:
    cur = (course or {}).get("curriculum")
    if not isinstance(cur, list):
        return []
    return [m for m in cur if isinstance(m, dict)]


def find_quiz_topic_by_title(course: dict | None, title: str) -> Optional[dict]:
    want = (title or "").strip().lower()
    if not want:
        return None
    for mod in _modules_iter(course):
        topics = mod.get("topics")
        if not isinstance(topics, list):
            continue
        for raw in topics:
            if not isinstance(raw, dict):
                continue
            ttype = str(raw.get("type") or "").strip().lower()
            if ttype != "quiz":
                continue
            if str(raw.get("title") or "").strip().lower() == want:
                return raw
    return None


def _static_bank_from_curriculum_questions(raw_list: list) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for idx, raw in enumerate(raw_list or []):
        nq = normalize_quiz_question(raw, idx)
        if not nq:
            continue
        qid = nq.get("id") or f"q_{idx}"
        if nq.get("questionType") == "mcq":
            opts = nq.get("options") or []
            if not isinstance(opts, list):
                continue
            ci = int(nq.get("correctOptionIndex") or 0)
            out.append(
                {
                    "id": qid,
                    "question": nq.get("title") or "",
                    "options": [str(x) for x in opts],
                    "correctIndex": max(0, min(ci, len(opts) - 1)) if len(opts) else 0,
                }
            )
        elif nq.get("questionType") == "true_false":
            out.append(
                {
                    "id": qid,
                    "question": nq.get("title") or "",
                    "options": ["True", "False"],
                    "correctIndex": 0 if nq.get("tfCorrect") is True else 1,
                }
            )
    return out


def completion_quiz_pass_percent(course: dict | None) -> int:
    """Default PASS_PERCENT; override from curriculum when completionQuizTitle targets a topic with quizSettings."""
    if course and (course.get("completionQuizTitle") or "").strip():
        t = find_quiz_topic_by_title(course, (course.get("completionQuizTitle") or "").strip())
        if t and isinstance(t, dict):
            st = t.get("quizSettings") or {}
            if isinstance(st, dict):
                p = (st.get("passingGradePercent") or st.get("passingGrade") or "")
                s = str(p).strip() if p is not None else ""
                if s:
                    try:
                        n = int(float(s))
                        if 0 <= n <= 100:
                            return n
                    except (TypeError, ValueError):
                        pass
    return PASS_PERCENT


def _question_bank(course: dict | None) -> list[dict[str, Any]]:
    c = course
    ct = (c.get("completionQuizTitle") or "").strip() if c else ""
    if c and ct:
        topic = find_quiz_topic_by_title(c, ct)
        if topic:
            qs = topic.get("quizQuestions")
            if isinstance(qs, list):
                bank = _static_bank_from_curriculum_questions(qs)
                if bank:
                    return bank
        return []
    slug = (c.get("slug") or "").strip().lower() if c else ""
    if slug == JAVA_SEED_SLUG:
        return JAVA_QUIZ_QUESTIONS
    return PYTHON_QUIZ_QUESTIONS


def quiz_has_questions(course: dict | None) -> bool:
    return bool(_question_bank(course))


def quiz_questions_for_client(course: dict | None = None) -> list[dict[str, Any]]:
    bank = _question_bank(course)
    out = []
    for q in bank:
        out.append(
            {
                "id": q["id"],
                "question": q["question"],
                "options": q["options"],
            }
        )
    return out


def grade_quiz(answer_indices: list[int], course: dict | None = None) -> tuple[bool, int, int]:
    """
    answer_indices: selected option index per question, same order as the bank for this course.
    Returns (passed, score_percent, pass_percent).
    """
    bank = _question_bank(course)
    ppass = completion_quiz_pass_percent(course)
    total = len(bank)
    if total == 0:
        return False, 0, ppass
    if len(answer_indices) != total:
        return False, 0, ppass
    correct = 0
    for i, q in enumerate(bank):
        try:
            sel = int(answer_indices[i])
        except (TypeError, ValueError):
            sel = -1
        if sel == q["correctIndex"]:
            correct += 1
    pct = int(round(100 * correct / total))
    return (pct >= ppass), pct, ppass
