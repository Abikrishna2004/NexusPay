from flask import Blueprint, request, jsonify
from database import users_col, admins_col
from utils import token_required, log_activity, create_notification

user_bp = Blueprint('users', __name__)

@user_bp.route('/profile', methods=['GET', 'PUT'])
@token_required
def get_profile(current_user):
    if request.method == 'GET':
        return jsonify(current_user)
    
    data = request.json
    updates = {}
    if 'name' in data: updates['name'] = data['name']
    if 'mfa_enabled' in data: updates['mfa_enabled'] = data['mfa_enabled']
    if 'phone' in data: updates['phone'] = data['phone']
    if 'address' in data: updates['address'] = data['address']
    if 'avatar' in data: updates['avatar'] = data['avatar']
    if 'kyc_document' in data: 
        updates['kyc_status'] = "Under Review"
        create_notification(current_user['id'], "Your KYC Document has been uploaded and is under review.", "info")
        
    if current_user.get('role') == 'Admin':
        admins_col.update_one({'id': current_user['id']}, {'$set': updates})
    else:
        users_col.update_one({'id': current_user['id']}, {'$set': updates})
        
    log_activity(current_user['id'], "UPDATE_PROFILE", "User updated personal profile/KYC.")
    return jsonify({"message": "Profile updated successfully!"}), 200
