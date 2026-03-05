import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://NexusPayUser:NexusPayUser.@nexuspay.imlucvb.mongodb.net/?appName=NexusPay')

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
db = client.get_default_database() if client.get_database('nexuspay') is None else client['nexuspay']

users_col = db['users']
admins_col = db['admins']
cards_col = db['cards']
transactions_col = db['transactions']
notifications_col = db['notifications']
audit_col = db['audit_logs']

def init_db():
    try:
        users_col.create_index("email", unique=True)
        users_col.create_index("id", unique=True)
        cards_col.create_index("id", unique=True)
        transactions_col.create_index("id", unique=True)
        print("Connected to MongoDB Atlas and verified indexing.")
    except Exception as e:
        print(f"MongoDB Boot Error: {e}")
