import firebase_admin
from firebase_admin import credentials, firestore
import json

try:
    cred = credentials.Certificate('backend/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
except:
    pass

db = firestore.client()
doc = db.collection('gameConfig').document('constants').get()

if doc.exists:
    print(json.dumps(doc.to_dict(), indent=2))
else:
    print("NO DOC")
