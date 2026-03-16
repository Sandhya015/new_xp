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


def init_db(uri: str, database_name: str = "xpertintern") -> Database | None:
    """Initialize connection. Call from create_app after config is loaded. Returns db or None if URI empty."""
    if not uri or not uri.strip():
        return None
    global _db
    client = get_client(uri)
    _db = client[database_name]
    return _db
