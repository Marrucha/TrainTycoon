// Jednorazowy skrypt inicjalizujący dane dla systemu popytu:
// 1. Dodaje pole `reputation: 0.5` do players/player1
// 2. Tworzy dokument players/samorządowy (publiczny gracz bazowy)

import fs from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore'

// Uruchamiaj z katalogu FRONTEND: cd FRONTEND && node ../scripts/init_demand_data.js
const envFile = fs.readFileSync('./.env', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
    const match = line.replace('\r', '').match(/^([^=]+)=(.*)$/)
    if (match) {
        let val = match[2].trim()
        val = val.replace(/^['"]|['"]$/g, '')
        env[match[1].trim()] = val
    }
})

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function run() {
    try {
        // 1. Reputacja gracza player1 (neutralna 0.5)
        await updateDoc(doc(db, 'players', 'player1'), {
            reputation: 0.5,
        })
        console.log('✓ players/player1: reputation = 0.5')

        // 2. Publiczny gracz samorządowy
        await setDoc(doc(db, 'players', 'samorządowy'), {
            type: 'public',
            speedKmh: 80,
            priceClass2Per100km: 50,
            priceClass1Per100km: 75,
            // routes: [] — brak własnych wpisów = domyślny headway 120 min na każdym odcinku
            routes: [],
        })
        console.log('✓ players/samorządowy utworzony')

        console.log('Inicjalizacja zakończona.')
        process.exit(0)
    } catch (error) {
        console.error('Błąd:', error)
        process.exit(1)
    }
}

run()
