from flask import Blueprint, request, jsonify
from database import notifications_col, users_col, client
from utils import token_required
import os

misc_bp = Blueprint('misc', __name__)

@misc_bp.route('/health', methods=['GET'])
def health():
    try:
        client.admin.command('ping')
        return jsonify({"status": "running", "database": "connected to MongoDB Atlas"})
    except Exception as e:
        return jsonify({"status": "running", "database": "disconnected", "error": str(e)}), 503

import bcrypt

@misc_bp.route('/notifications', methods=['GET', 'PUT'])
@token_required
def get_notifications(current_user):
    if request.method == 'GET':
        my_notifs = list(notifications_col.find({"user_id": current_user['id']}, {"_id": 0}).sort("date", -1).limit(40))
        if current_user['role'] == 'Admin':
            global_sys = list(notifications_col.find({"user_id": "admin"}, {"_id": 0}).sort("date", -1).limit(20))
            my_notifs = global_sys + my_notifs
        return jsonify(my_notifs)
    else:
        notifications_col.update_many({"user_id": current_user['id'], "read": False}, {"$set": {"read": True}})
        return jsonify({"message": "Marked read"})

@misc_bp.route('/merchants', methods=['GET'])
@token_required
def list_merchants(current_user):
    merchants = list(users_col.find({"role": "Merchant", "status": "Active"}, {"_id": 0, "id": 1, "name": 1}))
    return jsonify(merchants)
