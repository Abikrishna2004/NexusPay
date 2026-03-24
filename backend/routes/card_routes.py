from flask import Blueprint, request, jsonify
import datetime
from database import cards_col, users_col, transactions_col
from utils import token_required, generate_id, log_activity, create_notification, check_refresh

card_bp = Blueprint('cards', __name__)

@card_bp.route('', methods=['GET', 'POST'])
@token_required
def cards(current_user):
    if request.method == 'POST':
        if current_user['role'] != 'Customer': 
            return jsonify({"message": "Only customers can mint cards!"}), 403
        data = request.json
        card_id = generate_id()
        
        limit_requested = float(data.get('spending_limit', 5000))
        now = datetime.datetime.utcnow()
        new_card = {
            "id": card_id,
            "user_id": current_user['id'],
            "card_number": "4000 1234 " + str(int(now.timestamp()))[-8:],
            "expiry": (now + datetime.timedelta(days=3*365)).strftime("%m/%y"),
            "cvv": str(int(now.timestamp()))[-3:],
            "type": data.get('type', 'Virtual'),
            "status": "Pending Approval",
            "spending_limit": limit_requested,
            "balance": limit_requested,
            "debt": 0.0,
            "last_refresh_month": now.year * 100 + now.month,
            "created_at": now.isoformat()
        }
        cards_col.insert_one(new_card)
        log_activity(current_user['id'], "REQUESTED_CARD", f"Requested {new_card['type']} Card ending in {new_card['card_number'][-4:]}")
        create_notification("admin", f"User {current_user['name']} has requested a new card allocation.", "info")
        new_card.pop('_id', None)
        return jsonify({"message": "Card requested successfully. Awaiting Admin allocation.", "card": new_card}), 201
    
    # Refresh logic on GET
    query = {} if current_user['role'] == 'Admin' else {'user_id': current_user['id']}
    user_cards = list(cards_col.find(query, {'_id': 0}))
    for c in user_cards:
        check_refresh(c)
    return jsonify(user_cards)

@card_bp.route('/<card_id>', methods=['PUT', 'DELETE'])
@token_required
def update_card(current_user, card_id):
    card = cards_col.find_one({'id': card_id})
    if not card: return jsonify({"message": "Card not found"}), 404
    
    if current_user['role'] != 'Admin' and card['user_id'] != current_user['id']:
        return jsonify({"message": "Unauthorized"}), 403
        
    if request.method == 'DELETE':
        cards_col.delete_one({'id': card_id})
        return jsonify({"message": "Card deleted"})

    data = request.json
    updates = {}
    if 'status' in data: 
        updates['status'] = data['status']
        if current_user['role'] == 'Admin' and data['status'] == 'Active' and card['status'] == 'Pending Approval':
            # Remove wallet balance bonus as limit belongs to card
            pass
    if 'spending_limit' in data: 
        updates['spending_limit'] = float(data['spending_limit'])
        if card['balance'] > float(data['spending_limit']):
            updates['balance'] = float(data['spending_limit'])
    
    cards_col.update_one({'id': card_id}, {'$set': updates})
    return jsonify({"message": "Card configuration updated!"})

@card_bp.route('/<card_id>/repay', methods=['POST'])
@token_required
def repay_card(current_user, card_id):
    card = cards_col.find_one({'id': card_id})
    if not card or card['user_id'] != current_user['id']: 
        return jsonify({"message": "Unauthorized"}), 403
    
    amount = float(request.json.get('amount', 0))
    if amount <= 0: return jsonify({"message": "Invalid amount"}), 400
    
    # Repayment logic for debt (Non-refilling)
    cards_col.update_one({'id': card_id}, {'$inc': {'debt': -amount}})
    
    # Check if total debt cleared for the card to unset due date
    updated_card = cards_col.find_one({'id': card_id})
    if updated_card.get('debt', 0) <= 0:
        cards_col.update_one({'id': card_id}, {'$unset': {'repayment_due_date': ""}, '$set': {'debt': 0.0}})
        
    log_activity(current_user['id'], "CARD_REPAYMENT", f"Repaid ₹{amount} towards Card ending in {card['card_number'][-4:]}")
    
    # Create transaction log for the feed
    transactions_col.insert_one({
        "id": generate_id(), "customer_id": current_user['id'], "customer_name": current_user['name'],
        "merchant_name": "NexusPay (Repay)", "amount": amount, "type": "Repayment", "status": "Completed",
        "date": datetime.datetime.utcnow().isoformat()
    })
    
    return jsonify({"message": "Payment applied. Debt cleared, balance will refresh next month."})
