"""Detect courses that use the built-in Python fundamentals quiz + certificate flow."""


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
