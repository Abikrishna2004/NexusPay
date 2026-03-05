from flask import Blueprint, request, jsonify
import datetime
from database import cards_col, users_col
from utils import token_required, generate_id, log_activity, create_notification

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
        new_card = {
            "id": card_id,
            "user_id": current_user['id'],
            "card_number": "4000 1234 " + str(int(datetime.datetime.utcnow().timestamp()))[-8:],
            "expiry": (datetime.datetime.utcnow() + datetime.timedelta(days=3*365)).strftime("%m/%y"),
            "cvv": str(int(datetime.datetime.utcnow().timestamp()))[-3:],
            "type": data.get('type', 'Virtual'),
            "status": "Pending Approval",
            "spending_limit": limit_requested,
            "balance": limit_requested,
            "created_at": datetime.datetime.utcnow().isoformat()
        }
        cards_col.insert_one(new_card)
        log_activity(current_user['id'], "REQUESTED_CARD", f"Requested {new_card['type']} Card ending in {new_card['card_number'][-4:]}")
        create_notification("admin", f"User {current_user['name']} has requested a new card allocation.", "info")
        new_card.pop('_id', None)
        return jsonify({"message": "Card requested successfully. Awaiting Admin allocation.", "card": new_card}), 201
    
    if current_user['role'] == 'Admin':
        all_cards = list(cards_col.find({}, {'_id': 0}))
        return jsonify(all_cards)
    
    user_cards = list(cards_col.find({'user_id': current_user['id']}, {'_id': 0}))
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
            users_col.update_one({'id': card['user_id']}, {'$inc': {'balance': card['spending_limit']}})
    if 'spending_limit' in data: updates['spending_limit'] = float(data['spending_limit'])
    
    cards_col.update_one({'id': card_id}, {'$set': updates})
    return jsonify({"message": "Card configuration updated!"})

@card_bp.route('/<card_id>/repay', methods=['POST'])
@token_required
def repay_card(current_user, card_id):
    card = cards_col.find_one({'id': card_id})
    if not card: return jsonify({"message": "Card not found"}), 404
    if card['user_id'] != current_user['id']: return jsonify({"message": "Unauthorized"}), 403
    
    amount = float(request.json.get('amount', 0))
    if amount <= 0: return jsonify({"message": "Invalid amount"}), 400
    
    new_balance = min(card['balance'] + amount, card['spending_limit'])
    
    update_doc = {'$set': {'balance': new_balance}}
    if new_balance >= card['spending_limit']:
        update_doc['$unset'] = {'repayment_due_date': ""}
        
    cards_col.update_one({'id': card_id}, update_doc)
    log_activity(current_user['id'], "CARD_REPAYMENT", f"Repaid ₹{amount} towards Card ending in {card['card_number'][-4:]}")
    
    return jsonify({"message": "Payment applied to card successfully."})
