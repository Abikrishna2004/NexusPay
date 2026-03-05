from flask import Blueprint, request, jsonify
from database import users_col, transactions_col, cards_col, audit_col
from utils import token_required, log_activity, create_notification
import re

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/users', methods=['GET'])
@token_required
def admin_get_users(current_user):
    if current_user['role'] != 'Admin': return jsonify({"message": "Unauthorized"}), 403
    users_list = list(users_col.find({}, {'_id': 0, 'password': 0}))
    return jsonify(users_list)

@admin_bp.route('/users/<target_user_id>', methods=['PUT'])
@token_required
def admin_update_user(current_user, target_user_id):
    if current_user['role'] != 'Admin': return jsonify({"message": "Unauthorized"}), 403
    data = request.json
    updates = {}
    if 'status' in data: updates['status'] = data['status']
    if 'kyc_status' in data: updates['kyc_status'] = data['kyc_status']
    
    users_col.update_one({'id': target_user_id}, {'$set': updates})
    log_activity(current_user['id'], "ADMIN_ACTION", f"Modified user status for {target_user_id}.")
    create_notification(target_user_id, f"Your account status/KYC has been updated to: {data.get('status', data.get('kyc_status'))}")
    return jsonify({"message": "User updated successfully!"}), 200

@admin_bp.route('/users/<target_user_id>/details', methods=['GET'])
@token_required
def get_user_details(current_user, target_user_id):
    if current_user['role'] != 'Admin': return jsonify({"message": "Unauthorized"}), 403
    
    # Spent
    pipeline_spent = [
        {"$match": {"customer_id": target_user_id, "type": "Payment", "status": "Completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    res_spent = list(transactions_col.aggregate(pipeline_spent))
    total_spent = res_spent[0]['total'] if res_spent else 0.0
    
    # Refunds
    pipeline_refund = [
        {"$match": {"customer_id": target_user_id, "type": "Refund", "status": "Completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    res_refund = list(transactions_col.aggregate(pipeline_refund))
    total_refund = res_refund[0]['total'] if res_refund else 0.0

    # Card Repayments 
    repayments = list(audit_col.find({"user_id": target_user_id, "action": "CARD_REPAYMENT"}, {'_id': 0}))
    total_repaid = 0.0
    for r in repayments:
        match = re.search(r'Repaid ₹([\d\.]+)', r.get('details', ''))
        if match:
            total_repaid += float(match.group(1))

    # Owed & Limit
    user_cards = list(cards_col.find({"user_id": target_user_id}, {'_id': 0}))
    total_credit = sum(c.get('spending_limit', 0) for c in user_cards)
    total_owed = sum(max(0, c.get('spending_limit', 0) - c.get('balance', 0)) for c in user_cards)

    # Combined History
    user_txs = list(transactions_col.find({"$or": [{"customer_id": target_user_id}, {"merchant_id": target_user_id}]}, {'_id': 0}))
    for tx in user_txs:
        # Standardize missing fields
        if 'action' not in tx: tx['action'] = "Transaction"
        
    for r in repayments:
        # Standardize for history loop display
        r.setdefault('type', 'Repayment')
        r.setdefault('merchant_name', 'NexusPay Credit Services')
        match = re.search(r'Repaid ₹([\d\.]+)', r.get('details', ''))
        r['amount'] = float(match.group(1)) if match else 0.0

    unified_history = user_txs + repayments
    unified_history.sort(key=lambda x: x.get('date', ''), reverse=True)

    return jsonify({
        "total_spent": total_spent,
        "total_refunds": total_refund,
        "total_repaid": total_repaid,
        "total_credit_limit": total_credit,
        "total_owed": total_owed,
        "cards": len(user_cards),
        "history": unified_history[:15]
    })

@admin_bp.route('/stats', methods=['GET'])
@token_required
def admin_stats(current_user):
    if current_user['role'] != 'Admin': return jsonify({"message": "Unauthorized"}), 403
    
    pipeline = [{"$match": {"type": "Payment", "status": "Completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    res = list(transactions_col.aggregate(pipeline))
    total_rev = res[0]['total'] if res else 0.0
    
    total_tx = transactions_col.count_documents({})
    total_users = users_col.count_documents({'role': {'$ne': 'Admin'}})
    active_cards = cards_col.count_documents({'status': 'Active'})
    flagged_tx = transactions_col.count_documents({'status': 'Flagged'})
    
    # Total Credit Extended (All limit for all active cards)
    all_cards = list(cards_col.find({'status': 'Active'}, {'_id': 0, 'spending_limit': 1, 'balance': 1}))
    total_credit_extended = sum(c.get('spending_limit', 0) for c in all_cards)
    
    # Total Active Owed (How much they still need to pay back out of what they used)
    total_owed_back = sum(max(0, c.get('spending_limit', 0) - c.get('balance', 0)) for c in all_cards)
    
    # Total Repaid Historically (How much real liquid cash NexusPay received from borrowers)
    repayments = list(audit_col.find({"action": "CARD_REPAYMENT"}))
    total_repaid_historically = 0.0
    for r in repayments:
        match = re.search(r'Repaid ₹([\d\.]+)', r.get('details', ''))
        if match:
            total_repaid_historically += float(match.group(1))
            
            
    return jsonify({
        "total_revenue_processed": total_rev,
        "total_transactions": total_tx,
        "total_active_users": total_users,
        "total_active_cards": active_cards,
        "flagged_transactions": flagged_tx,
        "total_credit_extended": total_credit_extended,
        "total_owed_back": total_owed_back,
        "total_repaid_historically": total_repaid_historically
    })

@admin_bp.route('/audit', methods=['GET'])
@token_required
def get_audit_logs(current_user):
    if current_user['role'] != 'Admin': return jsonify({"message": "Unauthorized"}), 403
    logs = list(audit_col.find({}, {"_id": 0}).sort("date", -1).limit(100))
    return jsonify(logs)
