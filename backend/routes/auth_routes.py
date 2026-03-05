from flask import Blueprint, request, jsonify, current_app
import bcrypt
import datetime
import jwt
from database import users_col, admins_col
from utils import generate_id, log_activity

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        data = request.json
        if users_col.find_one({'email': data.get('email')}):
            return jsonify({"message": "Email already exists"}), 400
        if users_col.find_one({'username': data.get('username')}):
            return jsonify({"message": "Username already taken"}), 400
        
        hashed_pw = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt(8))
        user_id = generate_id()
        
        new_user = {
            "id": user_id,
            "name": data.get('name'),
            "username": data.get('username'),
            "email": data.get('email'),
            "password": hashed_pw.decode('utf-8'),
            "role": data.get('role', 'Customer'),
            "status": "Active",
            "kyc_status": "Pending",
            "mfa_enabled": False,
            "created_at": datetime.datetime.utcnow().isoformat(),
            "balance": 0.0
        }
        users_col.insert_one(new_user)
        log_activity(user_id, "REGISTER", f"Registered new account: {new_user['role']}.")
        return jsonify({"message": "User registered successfully", "user_id": user_id}), 201
    except Exception as e:
        return jsonify({"message": f"Database Error: {e}"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        login_identifier = data.get('email') 
        
        # We find all matching users natively since multiple admins might share "Admin@CJ"
        potential_users = list(users_col.find({'$or': [{'email': login_identifier}, {'username': login_identifier}]}))
        if not potential_users:
            potential_users = list(admins_col.find({'$or': [{'email': login_identifier}, {'username': login_identifier}]}))
            
        valid_user = None
        for u in potential_users:
            if bcrypt.checkpw(data['password'].encode('utf-8'), u['password'].encode('utf-8')):
                valid_user = u
                break
                
        if valid_user:
            if valid_user.get('status') == 'Blocked':
                return jsonify({"message": "Account Blocked. Contact support."}), 403
            token = jwt.encode({
                'user_id': valid_user['id'],
                'role': valid_user['role'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
            }, current_app.config['SECRET_KEY'], algorithm="HS256")
            log_activity(valid_user['id'], "LOGIN", "User session started.")
            return jsonify({
                "token": token,
                "user": {
                    "id": valid_user['id'],
                    "name": valid_user['name'],
                    "email": valid_user['email'],
                    "role": valid_user['role'],
                    "kyc_status": valid_user.get('kyc_status'),
                    "status": valid_user.get('status')
                }
            }), 200
            
        return jsonify({"message": "Invalid credentials provided."}), 401
    except Exception as e:
        return jsonify({"message": f"Login Error: {e}"}), 500
