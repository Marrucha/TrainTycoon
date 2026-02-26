# Instrukcja dodawania miast i zmieniania danych bez frontend'u (Node.js script + Firebase)

Ta notatka z procedurą powstała, aby sprawnie edytować dane (z podziałem na np. rozłączanie tras czy wprowadzanie nowych współrzędnych bez udziału frontowej apllikacji webowej) bezpośrednio przez backendowy skrypt w Node, po podpięciu pod `firebase-admin` lub `firestore`. Używać ze skryptami wyrzucanymi do plików `.js`. 

## 1. Pobieranie danych `.env` z uwzględnieniem spacji i znaczników końca linii.
Błąd podczas mojego poprzedniego pobierania envów polegał na tym, że domyślnie skrypt pod środowiskiem **Windows** wrzucał znak `\r` na końcu linii pliku tekstowego wywołując błąd `INVALID_ARGUMENT` podczas komunikacji protokołów FireBase REST Api.

**Nigdy nie przetwarzaj `.env` gołym `split('\n')` w środowisku z Windows (CRLF).** 

Do zbudowania `env` ręcznie, zawsze musisz podmienić powrót karetki `\r` i usunąć cudzysłowy w wartościach konfiguracyjnych:

```javascript
import fs from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore'

// 1. Zabezpieczony loader enviromentów
const envFile = fs.readFileSync('.env.local', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
    // Usunięcie potężnego błędu ze znakami środowiska Windows (carriage return)
    const match = line.replace('\r', '').match(/^([^=]+)=(.*)$/)
    if (match) {
        let val = match[2].trim();
        // Usunięcie ewentualnych cudzysłowów pojedynczych lub podwójnych jeżeli tak zapisano
        val = val.replace(/^['"]|['"]$/g, '');
        env[match[1].trim()] = val;
    }
})

// 2. Mapowanie do podłączenia Firebase
const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
}

// 3. Zainicjalizowanie instancji
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
```

## 2. Prawidłowy szablon wprowadzania

Gdy skrypt bazy jest gotowy poprzez asynchroniczne pchnięcie, po zakończeniu transakcji zawsze ręcznie musisz wywołać koniec procesu w node `process.exit(0)`, w przeciwnym raze wątek websocket firebase zawiesi działanie terminala Node na kolejne kilka minut.

Wzorzec:
```javascript
async function run() {
    try {
        const noweMiasto = {
            id: 'nowe-miasto',
            name: 'Nowe Miasto',
            voivodeship: 'Województwo',
            tier: 2,
            lat: 53.00,
            lon: 21.00,
            svgX: 100, // trzeba przeliczyć rzutowanie względem lat/lon x = (lon - 14.0) / 10.5 * 500, y = (54.9 - lat) / 5.9 * 550
            svgY: 100,
            population: 10000,
            platforms: 2
        }
        await setDoc(doc(db, 'cities', 'nowe-miasto'), noweMiasto)
        
        // Operacje poboczne, jak np. usunięcie innych
        // await deleteDoc(doc(db, 'routes', 'stara-trasa'))

        console.log("SUKCES")
        process.exit(0) // WAŻNE ABY ZAMNĄĆ SKRYPT
    } catch (error) {
        console.error("Błąd bazy danych:", error)
        process.exit(1)
    }
}
run()
```
