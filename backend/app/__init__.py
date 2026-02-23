from flask import Flask
from app.config import config_map
from app.extensions import db, migrate, jwt
import os


def create_app(env: str = None) -> Flask:
    app = Flask(__name__)

    env = env or os.getenv("FLASK_ENV", "development")
    app.config.from_object(config_map.get(env, config_map["default"]))

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    with app.app_context():
        # Import models so Flask-Migrate can detect them
        from app.db.models import User  # noqa: F401

        # Register blueprints
        from app.api.auth import auth_bp
        app.register_blueprint(auth_bp)

    return app
