"""
Normalize and validate admin course curriculum JSON (modules → topics).

Matches the Add Training / Tutor-style frontend shape: topic types, quiz questions
+ settings, lecture media metadata. Unknown keys on topics are dropped for a stable
stored shape (defense in depth).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

TOPIC_TYPES = frozenset(
    {"Lecture", "Quiz", "Reading", "Recording", "Lab", "Assignment", "Interview"}
)

MAX_MODULES = 200
MAX_TOPICS_PER_MODULE = 500
MAX_QUIZ_QUESTIONS = 200
MAX_OPTIONS_PER_QUESTION = 24
MAX_LESSON_CONTENT_CHARS = 600_000
MAX_TOPIC_TITLE_LEN = 500
MAX_TOPIC_DETAILS_CHARS = 50_000


QUIZ_SETTINGS_DEFAULTS: Dict[str, Any] = {
    "timeLimitValue": "0",
    "timeLimitUnit": "Minutes",
    "hideQuizTime": False,
    "feedbackMode": "retry",
    "attemptsAllowed": "10",
    "passingGradePercent": "80",
    "maxQuestionsToAnswer": "10",
    "quizAutoStart": False,
    "questionLayout": "single_question",
    "questionOrder": "random",
    "hideQuestionNumber": False,
    "shortAnswerCharLimit": "200",
    "essayCharLimit": "500",
}

ALLOWED_TIME_UNITS = frozenset({"Minutes", "Hours", "Seconds"})
ALLOWED_FEEDBACK = frozenset({"retry", "reveal", "default"})
ALLOWED_LAYOUT = frozenset({"single_question", "multiple"})
ALLOWED_ORDER = frozenset({"sort", "random"})


def _str(val: Any, default: str = "", max_len: Optional[int] = None) -> str:
    if val is None:
        s = default
    elif isinstance(val, str):
        s = val
    else:
        s = str(val)
    s = s.strip() if isinstance(s, str) else str(s)
    if max_len is not None and len(s) > max_len:
        s = s[:max_len]
    return s


def _optional_str(val: Any, max_len: Optional[int] = None) -> str:
    return _str(val, "", max_len)


def _bool(val: Any, default: bool = False) -> bool:
    if isinstance(val, bool):
        return val
    if val in (1, "1", "true", "True", "yes", "Yes"):
        return True
    if val in (0, "0", "false", "False", "no", "No", ""):
        return False
    return default


def _sanitize_html_len(html: str) -> str:
    if len(html) > MAX_LESSON_CONTENT_CHARS:
        return html[:MAX_LESSON_CONTENT_CHARS]
    return html


def normalize_quiz_settings(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return dict(QUIZ_SETTINGS_DEFAULTS)
    out = dict(QUIZ_SETTINGS_DEFAULTS)
    out["timeLimitValue"] = _optional_str(raw.get("timeLimitValue"), 12) or out["timeLimitValue"]
    u = _optional_str(raw.get("timeLimitUnit"), 16) or out["timeLimitUnit"]
    out["timeLimitUnit"] = u if u in ALLOWED_TIME_UNITS else out["timeLimitUnit"]
    out["hideQuizTime"] = _bool(raw.get("hideQuizTime"), out["hideQuizTime"])
    fm = _optional_str(raw.get("feedbackMode"), 32) or out["feedbackMode"]
    out["feedbackMode"] = fm if fm in ALLOWED_FEEDBACK else out["feedbackMode"]
    out["attemptsAllowed"] = _optional_str(raw.get("attemptsAllowed"), 8) or out["attemptsAllowed"]
    out["passingGradePercent"] = _optional_str(raw.get("passingGradePercent"), 8) or out["passingGradePercent"]
    out["maxQuestionsToAnswer"] = _optional_str(raw.get("maxQuestionsToAnswer"), 8) or out["maxQuestionsToAnswer"]
    out["quizAutoStart"] = _bool(raw.get("quizAutoStart"), out["quizAutoStart"])
    ql = _optional_str(raw.get("questionLayout"), 32) or out["questionLayout"]
    out["questionLayout"] = ql if ql in ALLOWED_LAYOUT else out["questionLayout"]
    qo = _optional_str(raw.get("questionOrder"), 32) or out["questionOrder"]
    out["questionOrder"] = qo if qo in ALLOWED_ORDER else out["questionOrder"]
    out["hideQuestionNumber"] = _bool(raw.get("hideQuestionNumber"), out["hideQuestionNumber"])
    out["shortAnswerCharLimit"] = _optional_str(raw.get("shortAnswerCharLimit"), 8) or out["shortAnswerCharLimit"]
    out["essayCharLimit"] = _optional_str(raw.get("essayCharLimit"), 8) or out["essayCharLimit"]
    return out


def normalize_quiz_question(raw: Any, idx: int) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    qid = _optional_str(raw.get("id"), 80)
    if not qid:
        qid = f"q_{idx}"
    title = _optional_str(raw.get("title"), 10_000)
    opts = raw.get("options")
    if not isinstance(opts, list):
        opts = ["", ""]
    options: List[str] = []
    for o in opts[:MAX_OPTIONS_PER_QUESTION]:
        options.append(_optional_str(o, 5_000))
    while len(options) < 2:
        options.append("")
    ci = raw.get("correctOptionIndex", 0)
    try:
        ci = int(ci)
    except (TypeError, ValueError):
        ci = 0
    ci = max(0, min(ci, len(options) - 1))
    return {"id": qid, "title": title, "options": options, "correctOptionIndex": ci}


def normalize_topic(raw: Any, topic_index: int) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {
            "id": f"topic_{topic_index}",
            "title": "",
            "type": "Lecture",
            "details": "",
            "duration": "",
            "recordingFileName": None,
            "recordingNote": "",
        }
    tid = _optional_str(raw.get("id"), 120) or f"topic_{topic_index}"
    title = _optional_str(raw.get("title"), MAX_TOPIC_TITLE_LEN)
    ttype = _optional_str(raw.get("type"), 32) or "Lecture"
    if ttype not in TOPIC_TYPES:
        ttype = "Lecture"
    details = _optional_str(raw.get("details"), MAX_TOPIC_DETAILS_CHARS)
    duration = _optional_str(raw.get("duration"), 120)
    rfn = raw.get("recordingFileName")
    recording_file_name = None if rfn is None else _optional_str(rfn, 512) or None
    recording_note = _optional_str(raw.get("recordingNote"), 10_000)

    base: Dict[str, Any] = {
        "id": tid,
        "title": title,
        "type": ttype,
        "details": details,
        "duration": duration,
        "recordingFileName": recording_file_name,
        "recordingNote": recording_note,
    }

    if ttype == "Lecture":
        lc = raw.get("lessonContent")
        if lc is not None and not isinstance(lc, str):
            lc = str(lc)
        lesson_content = _sanitize_html_len((lc or "") if isinstance(lc, str) else "")
        base.update(
            {
                "lessonContent": lesson_content,
                "lessonVideoAttachMode": _optional_str(raw.get("lessonVideoAttachMode"), 32) or "none",
                "lessonVideoUrl": _optional_str(raw.get("lessonVideoUrl"), 2000),
                "lessonVideoRecordingRef": (
                    None
                    if raw.get("lessonVideoRecordingRef") in (None, "")
                    else _optional_str(raw.get("lessonVideoRecordingRef"), 120)
                ),
                "lessonVideoHours": _optional_str(raw.get("lessonVideoHours"), 8) or "0",
                "lessonVideoMinutes": _optional_str(raw.get("lessonVideoMinutes"), 8) or "0",
                "lessonVideoSeconds": _optional_str(raw.get("lessonVideoSeconds"), 8) or "0",
                "lessonPreviewEnabled": _bool(raw.get("lessonPreviewEnabled"), False),
                "lessonFeaturedImageName": (
                    None
                    if raw.get("lessonFeaturedImageName") in (None, "")
                    else _optional_str(raw.get("lessonFeaturedImageName"), 512)
                ),
                "lessonVideoFileName": (
                    None
                    if raw.get("lessonVideoFileName") in (None, "")
                    else _optional_str(raw.get("lessonVideoFileName"), 512)
                ),
                "lessonExerciseFileName": (
                    None
                    if raw.get("lessonExerciseFileName") in (None, "")
                    else _optional_str(raw.get("lessonExerciseFileName"), 512)
                ),
            }
        )

    if ttype == "Quiz":
        qq = raw.get("quizQuestions")
        questions: List[Dict[str, Any]] = []
        if isinstance(qq, list):
            for j, q in enumerate(qq[:MAX_QUIZ_QUESTIONS]):
                nq = normalize_quiz_question(q, j)
                if nq:
                    questions.append(nq)
        if questions:
            base["quizQuestions"] = questions
        qs = raw.get("quizSettings")
        base["quizSettings"] = normalize_quiz_settings(qs)

    # Optional: gate some topics until payment is recorded (orderId on enrollment). Student UI can read this.
    if "lockedUntilPayment" in raw:
        base["lockedUntilPayment"] = bool(raw.get("lockedUntilPayment"))

    return base


def normalize_module(raw: Any, mod_index: int) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {"id": f"mod_{mod_index}", "title": "", "order": mod_index, "recordingFileName": None, "topics": []}
    mid = _optional_str(raw.get("id"), 120) or f"mod_{mod_index}"
    title = _optional_str(raw.get("title"), MAX_TOPIC_TITLE_LEN)
    try:
        order = int(raw.get("order", mod_index))
    except (TypeError, ValueError):
        order = mod_index
    rfn = raw.get("recordingFileName")
    recording_file_name = None if rfn is None else _optional_str(rfn, 512) or None
    topics_raw = raw.get("topics")
    topics: List[Dict[str, Any]] = []
    if isinstance(topics_raw, list):
        for ti, tr in enumerate(topics_raw[:MAX_TOPICS_PER_MODULE]):
            topics.append(normalize_topic(tr, ti))
    else:
        topics = []
    return {
        "id": mid,
        "title": title,
        "order": order,
        "recordingFileName": recording_file_name,
        "topics": topics,
    }


def normalize_curriculum(raw: Any) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
    """
    Returns (normalized_curriculum, error_message).
    error_message is set only for unacceptable input (wrong top-level type, too many modules).
    """
    if raw is None:
        return [], None
    if not isinstance(raw, list):
        return None, "curriculum must be a JSON array of modules"
    if len(raw) > MAX_MODULES:
        return None, f"curriculum exceeds maximum of {MAX_MODULES} modules"
    out: List[Dict[str, Any]] = []
    for i, m in enumerate(raw):
        out.append(normalize_module(m, i))
    return out, None
