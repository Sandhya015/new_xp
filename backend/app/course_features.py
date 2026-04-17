"""Detect courses that use the built-in completion quiz + certificate flow (Python and selected seeds)."""


def course_has_python_quiz(course: dict | None) -> bool:
    if not course:
        return False
    slug = (course.get("slug") or "").strip().lower()
    if slug in ("python", "python-programming", "python-fundamentals"):
        return True
    title = (course.get("title") or "").lower()
    if "python" in title:
        return True
    # Exact tag "Python" (seed); avoid matching unrelated tags like "Python & Analytics" unless title/slug already matched
    tag = (course.get("tag") or "").strip().lower()
    if tag == "python":
        return True
    return False


def course_has_completion_quiz(course: dict | None) -> bool:
    """Courses that expose GET/POST .../python-quiz and certificate-from-quiz (includes Java seed)."""
    if course_has_python_quiz(course):
        return True
    slug = (course.get("slug") or "").strip().lower()
    if slug == "demo-java-programming-seed":
        return True
    return False
