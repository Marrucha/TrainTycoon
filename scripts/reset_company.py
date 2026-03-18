"""One-time script: reset company/shares state for player1."""
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import DELETE_FIELD

firebase_admin.initialize_app(credentials.ApplicationDefault())
db = firestore.client()

db.collection('players').document('player1').update({'company': DELETE_FIELD})
print('Done: company field removed from players/player1')
