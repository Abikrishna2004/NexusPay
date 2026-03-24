from flask import Blueprint, request, jsonify
from database import notifications_col, users_col, cards_col, transactions_col, client
from utils import token_required, check_refresh
import os, datetime

misc_bp = Blueprint('misc', __name__)

@misc_bp.route('/health', methods=['GET'])
def health():
    try:
        client.admin.command('ping')
        return jsonify({"status": "running", "database": "connected to MongoDB Atlas"})
    except Exception as e:
        return jsonify({"status": "running", "database": "disconnected", "error": str(e)}), 503

# Dashboard Optimizations
@misc_bp.route('/dashboard/full', methods=['GET'])
@token_required
def get_dashboard_full(current_user):
    res = {
        "profile": current_user,
        "notifications": list(notifications_col.find({"user_id": current_user['id']}, {"_id": 0}).sort("date", -1).limit(20))
    }
    
    if current_user['role'] == 'Customer':
        cards = list(cards_col.find({"user_id": current_user['id']}, {"_id": 0}))
        for card in cards:
            check_refresh(card)
        res["cards"] = cards
        res["transactions"] = list(transactions_col.find({"customer_id": current_user['id']}, {"_id": 0}).sort("date", -1).limit(10))
        res["merchants"] = list(users_col.find({"role": "Merchant", "status": "Active"}, {"_id": 0, "id": 1, "name": 1}))
    
    elif current_user['role'] == 'Merchant':
        res["transactions"] = list(transactions_col.find({"merchant_id": current_user['id']}, {"_id": 0}).sort("date", -1).limit(20))
        
    elif current_user['role'] == 'Admin':
        # Summary for admin dashboard speed - only calculate core stats
        total_users = users_col.count_documents({'role': {'$ne': 'Admin'}})
        active_cards = cards_col.count_documents({'status': 'Active'})
        
        # Simple pipeline for total rev
        pipeline = [{"$match": {"type": "Payment", "status": "Completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
        rev_res = list(transactions_col.aggregate(pipeline))
        total_rev = rev_res[0]['total'] if rev_res else 0.0

        # Historic repayments
        repay_pipeline = [{"$match": {"type": "Repayment", "status": "Completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
        repay_res = list(transactions_col.aggregate(repay_pipeline))
        total_repaid = repay_res[0]['total'] if repay_res else 0.0
        
        # Total extended
        total_extended = sum(c.get('spending_limit', 0) for c in cards_col.find({'status': 'Active'}))
        
        res["stats"] = {
            "total_revenue_processed": total_rev,
            "total_active_users": total_users,
            "total_active_cards": active_cards,
            "flagged_transactions": transactions_col.count_documents({'status': 'Flagged'}),
            "total_credit_extended": total_extended,
            "total_owed_back": sum(c.get('debt', 0) for c in cards_col.find({'status': 'Active'})),
            "total_repaid_historically": total_repaid
        }
        res["users"] = list(users_col.find({'role': {'$ne': 'Admin'}}, {'_id': 0, 'password': 0}).sort('created_at', -1).limit(50))
        res["cards"] = list(cards_col.find({}, {'_id': 0}).sort('id', -1).limit(50))
        res["transactions"] = list(transactions_col.find({}, {'_id': 0}).sort('date', -1).limit(50))

    return jsonify(res)

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
