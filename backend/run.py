"""
Run the Flask app. Use: from backend dir: python run.py  OR  flask run (with FLASK_APP=run:app)
"""
import os
from dotenv import load_dotenv
load_dotenv()

from app import create_app
app = create_app()

if __name__ == "__main__":
    import logging
    # So welcome / SMTP logs (INFO) show in the terminal during local dev
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=app.config.get("DEBUG", False))
