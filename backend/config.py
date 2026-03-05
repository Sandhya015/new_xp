"""
Environment-based configuration. Never hardcode secrets or stage-specific values.
"""
import os
from typing import List


class Config:
    """Base config."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    CORS_ORIGINS: List[str] = []
    # DB (when connected)
    MONGODB_URI = os.environ.get("MONGODB_URI", "")


class DevelopmentConfig(Config):
    ENV = "development"
    DEBUG = True
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")


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
