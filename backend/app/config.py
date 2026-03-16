"""
Environment-based configuration. Never hardcode secrets or stage-specific values.
"""
import os
from typing import List


class Config:
    """Base config."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY", "dev-jwt-secret-change-in-production")
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 86400))  # 24h default
    CORS_ORIGINS: List[str] = []
    MONGODB_URI = os.environ.get("MONGODB_URI", "") or os.environ.get("MONGO_URI", "")


class DevelopmentConfig(Config):
    ENV = "development"
    DEBUG = True
    _origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    CORS_ORIGINS = [o.strip() for o in _origins.split(",") if o.strip()] or ["http://localhost:5173", "http://127.0.0.1:5173"]


class StagingConfig(Config):
    ENV = "staging"
    DEBUG = False
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]


class ProductionConfig(Config):
    ENV = "production"
    DEBUG = False
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]


def get_config() -> type:
    env = os.environ.get("FLASK_ENV", "development")
    return {
        "development": DevelopmentConfig,
        "staging": StagingConfig,
        "production": ProductionConfig,
    }.get(env, DevelopmentConfig)
