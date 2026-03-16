"""
Flask app instance for Lambda. Referenced by serverless-wsgi as app_wsgi.app
to avoid circular import (plugin's generated wsgi_handler imports this module).
"""
import os
from dotenv import load_dotenv
load_dotenv()

from app import create_app

app = create_app()
