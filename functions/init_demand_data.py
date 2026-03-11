# Jednorazowy skrypt inicjalizujący dane dla systemu popytu:
# 1. Dodaje pole `reputation: 0.5` do players/player1
# 2. Tworzy dokument players/samorządowy (publiczny gracz bazowy)
#
# Uruchamiaj z katalogu functions/:
#   venv\Scripts\python init_demand_data.py

import firebase_admin
from firebase_admin import credentials, firestore

# Używa Application Default Credentials (firebase login --reauth ustawia je automatycznie)
firebase_admin.initialize_app()
db = firestore.client()

def run():
    db.collection('players').document('player1').update({
        'reputation': 0.5,
    })
    print('✓ players/player1: reputation = 0.5')

    db.collection('players').document('samorządowy').set({
        'type': 'public',
        'speedKmh': 80,
        'priceClass2Per100km': 50,
        'priceClass1Per100km': 75,
        'routes': [],
    })
    print('✓ players/samorządowy utworzony')
    print('Inicjalizacja zakończona.')

if __name__ == '__main__':
    run()
