"""Convert integer INR amounts to words (Indian format), e.g. 6080 -> Six Thousand Eighty."""
from __future__ import annotations

_ONES = (
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
)

_TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _under_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    t, u = divmod(n, 10)
    return f"{_TENS[t]}{(' ' + _ONES[u]) if u else ''}".strip()


def _under_thousand(n: int) -> str:
    if n < 100:
        return _under_hundred(n)
    h, r = divmod(n, 100)
    tail = _under_hundred(r) if r else ""
    return f"{_ONES[h]} Hundred{' ' + tail if tail else ''}".strip()


def inr_int_to_words(n: int) -> str:
    n = int(n)
    if n < 0:
        return "Minus " + inr_int_to_words(-n)
    if n == 0:
        return "Zero"
    parts: list[str] = []

    crore, n = divmod(n, 10000000)
    if crore:
        parts.append(_under_thousand(crore) + " Crore")

    lakh, n = divmod(n, 100000)
    if lakh:
        parts.append(_under_thousand(lakh) + " Lakh")

    thousand, n = divmod(n, 1000)
    if thousand:
        parts.append(_under_thousand(thousand) + " Thousand")

    if n:
        parts.append(_under_thousand(n))

    return " ".join(parts)
