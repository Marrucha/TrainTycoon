import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin
cred = credentials.Certificate('config/serviceAccountKey.json') # usually what it expects or default
try:
    firebase_admin.initialize_app()
except Exception:
    firebase_admin.initialize_app(cred)

db = firestore.client()

constants = {
    'SALARIES': {
        'maszynista': 9000,
        'kierownik': 7000,
        'pomocnik': 6000,
        'konduktor': 5000,
        'barman': 4500
    },
    'EXP_SALARY_RATES': {
        'maszynista': 100,
        'pomocnik': 80,
        'kierownik': 70,
        'konduktor': 60,
        'barman': 50
    },
    'INTERN_SALARY': 4300,
    'AGENCY_FEE_MULTIPLIER': 6,
    'ANNUAL_RATE': 0.06,
    'COMMITMENT_RATE': 0.01,
    'CLASS2_PER_100KM': 6,
    'BASE_WARS_RATE': 20
}

db.collection('gameConfig').document('constants').set(constants, merge=True)
print("Constants uploaded to Firestore.")
