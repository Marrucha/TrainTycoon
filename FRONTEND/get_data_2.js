import fs from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, getDocs, collection } from 'firebase/firestore'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
    const match = line.replace('\r', '').match(/^([^=]+)=(.*)$/)
    if (match) {
        let val = match[2].trim();
        val = val.replace(/^['"]|['"]$/g, '');
        env[match[1].trim()] = val;
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
const PLAYER_ID = 'player1'

async function run() {
    try {
        const citiesSnap = await getDocs(collection(db, 'cities'))
        let cities = []
        citiesSnap.forEach(d => cities.push({ id: d.id, ...d.data() }))

        const myTrainsSnap = await getDocs(collection(db, `players/${PLAYER_ID}/trainSet`))
        let trainSets = []
        myTrainsSnap.forEach(d => trainSets.push({ id: d.id, ...d.data() }))

        const relevantCities = cities.filter(c => ['Warszawa', 'Łódź', 'Kalisz', 'Wrocław'].includes(c.name));
        fs.writeFileSync('output.json', JSON.stringify({ cities: relevantCities, trainSets: trainSets }, null, 2))

        process.exit(0)
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
}
run()
