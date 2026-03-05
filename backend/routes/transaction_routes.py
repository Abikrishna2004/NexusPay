from flask import Blueprint, request, jsonify
import datetime
from database import transactions_col, cards_col, users_col
from utils import token_required, generate_id, log_activity, create_notification

transaction_bp = Blueprint('transactions', __name__)

@transaction_bp.route('', methods=['POST', 'GET'])
@token_required
def handle_transactions(current_user):
    if request.method == 'POST':
        data = request.json
        amount = float(data.get('amount', 0))
        merchant_id = data.get('merchant_id')
        card_id = data.get('card_id')
        qr_parsed = data.get('qr_parsed')
        
        card = cards_col.find_one({'id': card_id, 'user_id': current_user['id']})
        
        if qr_parsed:
            merchant = {
                'id': 'ext_qr_id',
                'name': qr_parsed.get('name', 'External QR Vendor'),
                'role': 'Merchant'
            }
            merchant_id = qr_parsed.get('upi', merchant['id'])
        else:
            merchant = users_col.find_one({'id': merchant_id, 'role': 'Merchant'})
            
        if not card or not merchant:
            return jsonify({"message": "Invalid card or merchant reference"}), 400
        if card['status'] != 'Active':
            return jsonify({"message": f"Payment denied. Card is {card['status']}."}), 400
        if card['balance'] < amount:
            return jsonify({"message": "Insufficient balance on specified card."}), 400
        if amount > card['spending_limit']:
            return jsonify({"message": "Amount exceeds card spending limit."}), 400
        
        tx_status = "Completed"

        card_update = {'$inc': {'balance': -amount}}
        if card['balance'] >= card['spending_limit']:
            card_update['$set'] = {'repayment_due_date': (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat()}
            
        cards_col.update_one({'id': card_id}, card_update)
        if not qr_parsed:
            users_col.update_one({'id': merchant_id}, {'$inc': {'balance': amount}})
        users_col.update_one({'id': current_user['id']}, {'$inc': {'balance': -amount}})
        
        tx_id = generate_id()
        transaction = {
            "id": tx_id,
            "customer_id": current_user['id'],
            "customer_name": current_user['name'],
            "merchant_id": merchant_id,
            "merchant_name": merchant['name'],
            "card_id": card_id,
            "amount": amount,
            "status": tx_status,
            "type": "Payment",
            "date": datetime.datetime.utcnow().isoformat()
        }
        transactions_col.insert_one(transaction)
        
        create_notification(current_user['id'], f"Payment of ₹{amount:.2f} to {merchant['name']} was successful.", "success")
        if not qr_parsed:
            create_notification(merchant_id, f"Received payment of ₹{amount:.2f} from {current_user['name']}.", "success")
        
        transaction.pop('_id', None)
        return jsonify({"message": "Transaction successful", "transaction": transaction}), 201

    query = {}
    if current_user['role'] == 'Merchant': query['merchant_id'] = current_user['id']
    elif current_user['role'] == 'Customer': query['customer_id'] = current_user['id']
    
    if request.args.get('status'): query['status'] = request.args.get('status')
    if request.args.get('type'): query['type'] = request.args.get('type')
    
    txs = list(transactions_col.find(query, {'_id': 0}).sort('date', -1).limit(100))
    return jsonify(txs)

@transaction_bp.route('/<tx_id>/refund', methods=['POST'])
@token_required
def process_refund(current_user, tx_id):
    tx = transactions_col.find_one({'id': tx_id})
    if not tx: return jsonify({"message": "Transaction unknown"}), 404
    if tx['type'] == 'Refund' or tx['status'] == 'Refunded': return jsonify({"message": "Transaction is already refunded"}), 400
    
    if current_user['role'] not in ['Admin', 'Merchant'] or (current_user['role'] == 'Merchant' and tx['merchant_id'] != current_user['id']):
        return jsonify({"message": "Unauthorized to refund this specific transaction."}), 403
        
    amount = tx['amount']
    cards_col.update_one({'id': tx['card_id']}, {'$inc': {'balance': amount}})
    users_col.update_one({'id': tx['merchant_id']}, {'$inc': {'balance': -amount}})
    users_col.update_one({'id': tx['customer_id']}, {'$inc': {'balance': amount}})
    
    transactions_col.update_one({'id': tx_id}, {'$set': {'status': 'Refunded'}})
    
    refund_tx = {
        "id": generate_id(),
        "original_tx_id": tx_id,
        "customer_id": tx['customer_id'],
        "customer_name": tx['customer_name'],
        "merchant_id": tx['merchant_id'],
        "merchant_name": tx['merchant_name'],
        "card_id": tx['card_id'],
        "amount": amount,
        "status": "Completed",
        "type": "Refund",
        "date": datetime.datetime.utcnow().isoformat()
    }
    transactions_col.insert_one(refund_tx)
    
    create_notification(tx['customer_id'], f"Refund of ₹{amount:.2f} from {tx['merchant_name']} has been deposited back.", "info")
    log_activity(current_user['id'], "REFUND", f"Refunded Transaction ID: {tx_id}")
    return jsonify({"message": "Refund processed perfectly."})
