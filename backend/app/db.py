"""
MongoDB connection. Uses MONGODB_URI or MONGO_URI from config. DB name: xpertintern.
"""
import logging
import os

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_db: Database | None = None


def _mongo_client_kwargs() -> dict:
    """Shorter timeouts on Lambda so routes fail fast instead of hitting API Gateway 29s limit."""
    on_lambda = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    def _ms(name: str, default_lambda: str, default_other: str) -> int:
        raw = os.environ.get(name, "").strip()
        if raw.isdigit():
            return int(raw)
        return int(default_lambda if on_lambda else default_other)

    return {
        "serverSelectionTimeoutMS": _ms("MONGO_SERVER_SELECTION_TIMEOUT_MS", "8000", "20000"),
        "connectTimeoutMS": _ms("MONGO_CONNECT_TIMEOUT_MS", "8000", "20000"),
    }


def get_client(uri: str) -> MongoClient:
    """Create or return shared MongoClient. Call init_db from create_app."""
    global _client
    if _client is None:
        _client = MongoClient(uri, **_mongo_client_kwargs())
    return _client


def get_db() -> Database | None:
    """Return database. Requires init_db to have been called at app startup."""
    return _db


def get_users_collection() -> Collection:
    """Users collection for auth (students, companies, admins)."""
    db = get_db()
    if db is None:
        raise RuntimeError("Database not configured")
    return db["users"]


def get_courses_collection() -> Collection:
    """Courses / programs (training)."""
    return get_db()["courses"]


def get_contacts_collection() -> Collection:
    """Contact form submissions (leads)."""
    return get_db()["contacts"]


def get_certificates_collection() -> Collection:
    """Certificates (certNo, studentId, programName, etc.)."""
    return get_db()["certificates"]


def get_enrollments_collection() -> Collection:
    """Enrollments (userId, courseId, orderId, etc.)."""
    return get_db()["enrollments"]


def get_orders_collection() -> Collection:
    """Payment orders / invoices."""
    return get_db()["orders"]


def get_internships_collection() -> Collection:
    """Internship postings (companyId, title, etc.)."""
    return get_db()["internships"]


def get_applications_collection() -> Collection:
    """Internship applications (studentId, internshipId, status)."""
    return get_db()["applications"]


def get_visitors_collection() -> Collection:
    """Visitor / lead tracking (page views, course views)."""
    return get_db()["visitors"]


def get_followups_collection() -> Collection:
    """Lead follow-up activities (leadId, type, date, notes, addedBy)."""
    return get_db()["followups"]


def get_notifications_collection() -> Collection:
    """User notifications (userId, type, title, message, read, createdAt)."""
    return get_db()["notifications"]


def get_support_tickets_collection() -> Collection:
    """Support tickets (userId, subject, category, description, status, priority, createdAt)."""
    return get_db()["support_tickets"]


def _ix(collection: Collection, keys, **kwargs) -> None:
    """Create one index; log and continue if it fails (e.g. duplicate keys on unique)."""
    try:
        collection.create_index(keys, **kwargs)
    except Exception as e:
        logger.warning("Mongo index %s on %s skipped: %s", kwargs.get("name"), collection.name, e)


def ensure_indexes(db: Database) -> None:
    """
    Create indexes for hot query paths (equality + sort), avoiding full collection scans.
    Idempotent; safe to call on every startup. (MongoDB uses indexes, not DynamoDB GSIs.)
    """
    _ix(db["users"], "email", unique=True, name="idx_users_email")
    _ix(db["users"], [("role", 1), ("createdAt", -1)], name="idx_users_role_created")
    _ix(db["users"], [("role", 1), ("status", 1)], name="idx_users_role_status")

    _ix(db["courses"], [("active", 1), ("createdAt", -1)], name="idx_courses_active_created")
    _ix(
        db["courses"],
        [("active", 1), ("category", 1), ("createdAt", -1)],
        name="idx_courses_active_category_created",
    )

    _ix(db["enrollments"], [("userId", 1), ("courseId", 1)], name="idx_enrollments_user_course")
    _ix(db["enrollments"], [("userId", 1), ("createdAt", -1)], name="idx_enrollments_user_created")
    _ix(db["enrollments"], "courseId", name="idx_enrollments_course")

    _ix(db["orders"], [("userId", 1), ("createdAt", -1)], name="idx_orders_user_created")
    _ix(
        db["orders"],
        [("status", 1), ("createdAt", -1)],
        name="idx_orders_status_created",
    )
    _ix(db["orders"], "orderId", unique=True, sparse=True, name="idx_orders_orderId")

    _ix(db["contacts"], [("createdAt", -1)], name="idx_contacts_created")

    _ix(
        db["applications"],
        [("studentId", 1), ("internshipId", 1)],
        name="idx_applications_student_internship",
    )
    _ix(
        db["applications"],
        [("internshipId", 1), ("createdAt", -1)],
        name="idx_applications_internship_created",
    )

    _ix(
        db["internships"],
        [("companyId", 1), ("createdAt", -1)],
        name="idx_internships_company_created",
    )
    _ix(
        db["internships"],
        [("active", 1), ("createdAt", -1)],
        name="idx_internships_active_created",
    )
    _ix(
        db["internships"],
        [("status", 1), ("createdAt", -1)],
        name="idx_internships_status_created",
    )

    _ix(db["certificates"], "certNo", unique=True, name="idx_certificates_certNo")
    _ix(
        db["certificates"],
        [("studentId", 1), ("issueDate", -1)],
        name="idx_certificates_student_issue",
    )


def init_db(uri: str, database_name: str = "xpertintern") -> Database | None:
    """Initialize connection. Call from create_app after config is loaded. Returns db or None if URI empty."""
    if not uri or not uri.strip():
        return None
    global _db
    client = get_client(uri)
    _db = client[database_name]
    ensure_indexes(_db)
    return _db
