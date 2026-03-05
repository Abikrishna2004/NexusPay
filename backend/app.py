import os
import bcrypt
import uvicorn
from a2wsgi import WSGIMiddleware
from flask import Flask
from flask_cors import CORS
from database import init_db, users_col

# Import blueprints
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.card_routes import card_bp
from routes.transaction_routes import transaction_bp
from routes.admin_routes import admin_bp
from routes.misc_routes import misc_bp

app = Flask(__name__)
# Load key from .env or fallback
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'nexus_advanced_production_key_2026')
CORS(app)

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(user_bp, url_prefix='/api/users')
app.register_blueprint(card_bp, url_prefix='/api/cards')
app.register_blueprint(transaction_bp, url_prefix='/api/transactions')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(misc_bp, url_prefix='/api')

init_db()
asgi_app = WSGIMiddleware(app)

if __name__ == '__main__':
    uvicorn.run("app:asgi_app", host="0.0.0.0", port=5000, reload=True)
