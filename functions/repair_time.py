import sys
import datetime as dt

import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate('config/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()
doc_ref = db.collection('gameConfig').document('constants')

# Symulacja: ufundowanie startu gry 2 godziny temu (czasu fizycznego)
now_ms = int(dt.datetime.now().timestamp() * 1000) - (7200 * 1000)

doc_ref.set({
    'REAL_START_TIME_MS': now_ms,
    'GAME_START_TIME_MS': now_ms, 
    'TIME_MULTIPLIER': 30
}, merge=True)

print("Pomyślnie zresetowano czas - start gry zasymulowany na 2 fizyczne godziny temu.")
