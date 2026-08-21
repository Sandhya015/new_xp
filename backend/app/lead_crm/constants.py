"""Lead CRM enums and scoring defaults."""

EVENT_SCORES: dict[str, int] = {
    "payment.failed": 30,
    "payment.abandoned": 30,
    "payment.created": 25,
    "callback.requested": 25,
    "registration.incomplete": 20,
    "registration.started": 20,
    "contact.submitted": 20,
    "training.interest": 10,
    "inbound.call": 15,
    "campaign": 10,
    "manual.upload": 5,
    "manual.entry": 10,
    "payment.successful": 0,
}

SOURCE_VIEWS: dict[str, list[str]] = {
    "contact_us": ["contact.submitted"],
    "callback": ["callback.requested"],
    "training_interest": ["training.interest"],
    "registration": ["registration.started", "registration.incomplete"],
    "payment_recovery": ["payment.created", "payment.failed", "payment.abandoned"],
    "converted": ["payment.successful"],
    "inbound": ["inbound.call"],
    "campaigns": ["campaign"],
    "uploads": ["manual.upload", "manual.entry"],
}

LIFECYCLE_STAGES = (
    "new",
    "assigned",
    "attempted",
    "connected",
    "interested",
    "follow_up_scheduled",
    "payment_pending",
    "enrolled",
    "not_interested",
    "no_response",
    "invalid",
    "dnd",
)

DISPOSITIONS = (
    "interested_payment_link",
    "interested_needs_confirmation",
    "followup_specific_time",
    "followup_guardian_fee",
    "no_answer",
    "busy",
    "unreachable",
    "wrong_number",
    "not_interested_price",
    "not_interested_timing",
    "already_enrolled",
    "dnd",
    "escalation",
)
