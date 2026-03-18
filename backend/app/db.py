"""
MongoDB connection. Uses MONGODB_URI or MONGO_URI from config. DB name: xpertintern.
"""
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

_client: MongoClient | None = None
_db: Database | None = None


def get_client(uri: str) -> MongoClient:
    """Create or return shared MongoClient. Call init_db from create_app."""
    global _client
    if _client is None:
        _client = MongoClient(uri)
    return _client


def get_db() -> Database | None:
    """Return database. Requires init_db to have been called at app startup."""
    return _db


def get_users_collection() -> Collection:
    """Users collection for auth (students, companies, admins)."""
    return get_db()["users"]


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


def init_db(uri: str, database_name: str = "xpertintern") -> Database | None:
    """Initialize connection. Call from create_app after config is loaded. Returns db or None if URI empty."""
    if not uri or not uri.strip():
        return None
    global _db
    client = get_client(uri)
    _db = client[database_name]
    return _db
