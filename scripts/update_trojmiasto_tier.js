// Jednorazowy skrypt: zmiana routeTier tras Trójmiasta z 2 na 1
// Uruchamiaj z katalogu FRONTEND: cd FRONTEND && node ../scripts/update_trojmiasto_tier.js

import fs from 'fs'
import { initializeApp } from '../FRONTEND/node_modules/firebase/app/dist/index.esm.js'
import { getFirestore, doc, updateDoc } from '../FRONTEND/node_modules/firebase/firestore/dist/index.esm.js'

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
        await updateDoc(doc(db, 'routes', 'gdynia-sopot'), { routeTier: 1 })
        console.log('✓ routes/gdynia-sopot: routeTier = 1')

        await updateDoc(doc(db, 'routes', 'sopot-gdansk'), { routeTier: 1 })
        console.log('✓ routes/sopot-gdansk: routeTier = 1')

        console.log('Gotowe.')
    } catch (err) {
        console.error('Błąd:', err)
    }
    process.exit(0)
}

run()
