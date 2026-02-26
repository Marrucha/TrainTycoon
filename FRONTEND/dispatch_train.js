import fs from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, getDocs, collection, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore'

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
const TRAINSET_ID = 'trainset-1772062501119';

function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in km
}

function calcStopMinutes(pop) {
    if (pop > 200000) return 5;
    if (pop >= 100000) return 3;
    return 2;
}

function addMinutesToHM(hm, minutes) {
    let [h, m] = hm.split(':').map(Number);
    m += Math.round(minutes);
    h += Math.floor(m / 60);
    m = m % 60;
    h = h % 24;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function run() {
    try {
        console.log("Pobieram kolekcje z bazy...")
        const citiesSnap = await getDocs(collection(db, 'cities'))
        let cities = {}
        citiesSnap.forEach(d => {
            cities[d.id] = { id: d.id, ...d.data() }
        })

        const tsSnap = await getDoc(doc(db, `players/${PLAYER_ID}/trainSet`, TRAINSET_ID))
        if (!tsSnap.exists()) throw new Error("Nie ma Kopernika w DB");
        const kopernik = tsSnap.data();
        const VMAX_KMH = kopernik.maxSpeed || 200;

        // Uproszczone liczenie strat przy ruszaniu 0-100kmh (30s)
        const timeToVmaxSeconds = (VMAX_KMH / 100) * 30;
        const offsetMin = timeToVmaxSeconds / 60;

        const stopsOrder = ["warszawa", "lodz", "kalisz", "wroclaw"];
        const reverseOrder = [...stopsOrder].reverse()

        const routesDocUpdates = {};
        const rozkladGlobal = [];

        const tryFindRoute = async (city1, city2) => {
            const id1 = `${city1}-${city2}`
            const id2 = `${city2}-${city1}`
            let ds1 = await getDoc(doc(db, 'routes', id1))
            if (ds1.exists()) return { id: ds1.id, data: ds1.data() }
            let ds2 = await getDoc(doc(db, 'routes', id2))
            if (ds2.exists()) return { id: ds2.id, data: ds2.data() }

            const c1 = cities[city1];
            const c2 = cities[city2];
            let dist = getHaversineDistance(c1.lat, c1.lon, c2.lat, c2.lon) * 1.25;
            let obj = {
                from: city1,
                to: city2,
                distance: Math.round(dist),
                dailyRevenue: 0,
                departures: [],
                trainId: null,
                avgOccupancy: 0,
                subsidy: 0,
                ticketPrice: Math.round(dist * 0.4),
                routeTier: 2,
                travelTime: Math.round((dist / VMAX_KMH) * 60 + offsetMin)
            }
            await setDoc(doc(db, 'routes', id1), obj);
            return { id: id1, data: obj }
        }

        const computeOneWay = async (stations, startTimes, kierunekName, kursBase) => {
            for (let j = 0; j < startTimes.length; j++) {
                let currentHM = startTimes[j];
                let kursId = kursBase + j;

                rozkladGlobal.push({
                    kurs: kursId,
                    miasto: cities[stations[0]].name,
                    przyjazd: currentHM,
                    odjazd: currentHM,
                    kierunek: kierunekName
                });

                for (let i = 0; i < stations.length - 1; i++) {
                    const c1 = stations[i]
                    const c2 = stations[i + 1]
                    const r = await tryFindRoute(c1, c2)

                    const distKm = r.data.distance || (getHaversineDistance(cities[c1].lat, cities[c1].lon, cities[c2].lat, cities[c2].lon) * 1.25);
                    const rideMin = (distKm / VMAX_KMH) * 60 + offsetMin;
                    const arriveHM = addMinutesToHM(currentHM, rideMin);

                    if (!routesDocUpdates[r.id]) { routesDocUpdates[r.id] = { departures: [], original: r.data } }
                    if (!routesDocUpdates[r.id].departures.includes(currentHM)) {
                        routesDocUpdates[r.id].departures.push(currentHM)
                    }

                    const stopMin = calcStopMinutes(cities[c2].population)
                    let nextHM = addMinutesToHM(arriveHM, stopMin);

                    rozkladGlobal.push({
                        kurs: kursId,
                        miasto: cities[c2].name,
                        przyjazd: arriveHM,
                        odjazd: (i === stations.length - 2) ? arriveHM : nextHM, // na stacji koncowej odjazd == przyjazd "finisz"
                        kierunek: kierunekName
                    })

                    currentHM = nextHM;
                }
            }
        }

        console.log("-> Liczenie odcinkow WWA - WRO")
        await computeOneWay(stopsOrder, ["06:00", "14:00"], "Wrocław", 1);

        console.log("-> Liczenie odcinkow WRO - WWA")
        await computeOneWay(reverseOrder, ["10:00", "18:00"], "Warszawa", 3);

        for (const rId in routesDocUpdates) {
            const rt = routesDocUpdates[rId];
            rt.departures.sort();
            console.log(`Update ${rId} z odjazdami ${rt.departures.join(',')}`)
            await updateDoc(doc(db, 'routes', rId), {
                departures: rt.departures,
                trainId: TRAINSET_ID, // Zawlaszczanie trasy
            });
        }

        // 5. Update UI in Coposer - Add schedule array 
        const routeString = "Warszawa ➔ Łódź ➔ Kalisz ➔ Wrocław";
        await updateDoc(doc(db, `players/${PLAYER_ID}/trainSet`, TRAINSET_ID), {
            routePath: routeString,
            assignedRoutes: Object.keys(routesDocUpdates),
            rozklad: rozkladGlobal // Wstrzykujemy tablice stacji z godzinami!!!
        });

        console.log("Pomyślnie zaktualizowano wszystkie grafiki globalne i profil Kopernika.");
        process.exit(0)

    } catch (e) {
        console.error(e)
        process.exit(1)
    }
}
run();
