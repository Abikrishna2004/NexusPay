import uuid
import datetime
from flask import request, jsonify, current_app
import jwt
from functools import wraps
from database import users_col, admins_col, audit_col, notifications_col

def generate_id():
    return str(uuid.uuid4())

def log_activity(user_id, action, details):
    try:
        audit_col.insert_one({
            "id": generate_id(),
            "user_id": user_id,
            "action": action,
            "details": details,
            "date": datetime.datetime.utcnow().isoformat()
        })
    except: pass

def create_notification(user_id, message, type="info"):
    try:
        notifications_col.insert_one({
            "id": generate_id(),
            "user_id": user_id,
            "message": message,
            "type": type,
            "date": datetime.datetime.utcnow().isoformat(),
            "read": False
        })
    except: pass

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            token = token.split(" ")[1]
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            if data.get('role') == 'Admin':
                current_user = admins_col.find_one({'id': data['user_id']}, {'_id': 0})
            else:
                current_user = users_col.find_one({'id': data['user_id']}, {'_id': 0})
            
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
            if current_user.get('status') == 'Blocked':
                return jsonify({'message': 'Account Blocked! Contact Support.'}), 403
        except Exception as e:
            return jsonify({'message': 'Token is invalid or expired!', 'error': str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated
