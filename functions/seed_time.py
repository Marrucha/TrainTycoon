import sys
import datetime as dt

import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.Certificate('config/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)
except Exception:
    pass

db = firestore.client()

doc_ref = db.collection('gameConfig').document('constants')

# Wstrzykujemy aktualny moment jako start dla nowej epoki
now_ms = int(dt.datetime.now().timestamp() * 1000)

doc_ref.set({
    'REAL_START_TIME_MS': now_ms,
    'GAME_START_TIME_MS': now_ms, 
    'TIME_MULTIPLIER': 30
}, merge=True)

print("Pomyślnie wgrano czas startowy do bazy do gameConfig/constants.")
