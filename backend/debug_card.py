import os
import certifi
from pymongo import MongoClient

MONGO_URI = 'mongodb+srv://NexusPayUser:NexusPayUser.@nexuspay.imlucvb.mongodb.net/?appName=NexusPay'
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client['nexuspay']
cards_col = db['cards']

card_ref = cards_col.find_one({"card_number": {"$regex": "2911$"}}, {"_id": 0})
if card_ref:
    uid = card_ref['user_id']
    all_cards = list(cards_col.find({"user_id": uid}, {"_id": 0}))
    print(f"Total cards for user {uid}: {len(all_cards)}")
    for c in all_cards:
        print(f"Card: {c.get('card_number')[-4:]}, Balance: {c.get('balance')}, Debt: {c.get('debt')}, Limit: {c.get('spending_limit')}")
else:
    print("No card 2911 found.")
