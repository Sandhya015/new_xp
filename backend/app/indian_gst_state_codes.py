"""Map billing state names (as used in frontend dropdown) to GST state codes (two digits)."""
from __future__ import annotations

# Keys must match frontend `INDIAN_STATES_UTS` literals exactly.
STATE_NAME_TO_GST_CODE: dict[str, str] = {
    "Andhra Pradesh": "37",
    "Arunachal Pradesh": "12",
    "Assam": "18",
    "Bihar": "10",
    "Chhattisgarh": "22",
    "Goa": "30",
    "Gujarat": "24",
    "Haryana": "06",
    "Himachal Pradesh": "02",
    "Jharkhand": "20",
    "Karnataka": "29",
    "Kerala": "32",
    "Madhya Pradesh": "23",
    "Maharashtra": "27",
    "Manipur": "14",
    "Meghalaya": "17",
    "Mizoram": "15",
    "Nagaland": "13",
    "Odisha": "21",
    "Punjab": "03",
    "Rajasthan": "08",
    "Sikkim": "11",
    "Tamil Nadu": "33",
    "Telangana": "36",
    "Tripura": "16",
    "Uttar Pradesh": "09",
    "Uttarakhand": "05",
    "West Bengal": "19",
    "Andaman and Nicobar Islands": "35",
    "Chandigarh": "04",
    "Dadra and Nagar Haveli and Daman and Diu": "26",
    "Delhi": "07",
    "Jammu and Kashmir": "01",
    "Ladakh": "38",
    "Lakshadweep": "31",
    "Puducherry": "34",
}


def gst_state_code_for_name(name: str | None) -> str:
    n = (name or "").strip()
    if not n:
        return ""
    return STATE_NAME_TO_GST_CODE.get(n, "")
