import fs from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, getDocs, collection, doc, updateDoc, setDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore'

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
const TRAINSET_ID = 'trainset-1772062501119'; // "Kopernik"

async function run() {
    try {
        console.log("Pobieram z bazy...")
        const rSnap = await getDocs(collection(db, 'routes'))
        let routes = []
        rSnap.forEach(d => {
            routes.push({ id: d.id, ...d.data() })
        })

        const citiesSnap = await getDocs(collection(db, 'cities'))
        let cities = {}
        citiesSnap.forEach(d => {
            cities[d.id] = { id: d.id, ...d.data() }
        })

        // Usun lewe polaczenia ktore wczesniej zrobilem (bo pominely Skierniewice/Sieradz)
        const bad = ['kalisz-lodz', 'lodz-kalisz', 'warszawa-lodz', 'lodz-warszawa', 'wroclaw-kalisz', 'kalisz-wroclaw', 'warsaw-lodz']
        for (let r of routes) {
            if (bad.includes(r.id)) {
                await deleteDoc(doc(db, 'routes', r.id))
            }
        }
        routes = routes.filter(r => !bad.includes(r.id))

        // Zbuduj graf z pozostalych id route
        let graph = {}
        for (let c in cities) {
            graph[c] = []
        }

        routes.forEach(r => {
            if (graph[r.from]) graph[r.from].push({ to: r.to, route: r })
            if (graph[r.to]) graph[r.to].push({ to: r.from, route: r })
        })

        function dijkstra(start, end) {
            let dist = {}
            let prev = {}
            let q = new Set()
            for (let c in cities) {
                dist[c] = Infinity;
                q.add(c)
            }
            dist[start] = 0;

            while (q.size > 0) {
                let u = null;
                for (let v of q) {
                    if (u === null || dist[v] < dist[u]) {
                        u = v;
                    }
                }
                if (dist[u] === Infinity || u === end) break;
                q.delete(u);

                if (!graph[u]) continue;
                for (let neighbor of graph[u]) {
                    let alt = dist[u] + (neighbor.route.distance || 10);
                    if (alt < dist[neighbor.to]) {
                        dist[neighbor.to] = alt;
                        prev[neighbor.to] = { city: u, route: neighbor.route };
                    }
                }
            }

            let path = [];
            let curr = end;
            while (curr && curr !== start) {
                if (!prev[curr]) return null;
                path.unshift({ city: curr, route: prev[curr].route })
                curr = prev[curr].city;
            }
            if (curr === start) {
                path.unshift({ city: start, route: null })
            }
            return path;
        }

        // Teraz rozkladGlobal
        const VMAX_KMH = 200;
        const timeToVmaxSeconds = (VMAX_KMH / 100) * 30;
        const offsetMin = timeToVmaxSeconds / 60;

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

        const rozkladGlobal = [];
        const routesDocUpdates = {};

        const processPath = (fullPath, startTimes, kierunekName, kursBase) => {
            for (let j = 0; j < startTimes.length; j++) {
                let currentHM = startTimes[j];
                let kursId = kursBase + j;

                rozkladGlobal.push({
                    kurs: kursId,
                    miasto: cities[fullPath[0].city].name,
                    przyjazd: currentHM,
                    odjazd: currentHM,
                    kierunek: kierunekName
                })

                for (let i = 1; i < fullPath.length; i++) {
                    let step = fullPath[i];
                    let prevStep = fullPath[i - 1];
                    let r = step.route;
                    let distKm = r.distance || 10;
                    let rideMin = (distKm / VMAX_KMH) * 60 + offsetMin;
                    let arriveHM = addMinutesToHM(currentHM, rideMin);

                    let routeKey = r.id; // Corrected key to route ID rather than creating new

                    if (!routesDocUpdates[routeKey]) routesDocUpdates[routeKey] = { id: routeKey, departures: [], distance: r.distance };
                    // Add departure ONLY for the node that departs. If going forwards:
                    if (!routesDocUpdates[routeKey].departures.includes(currentHM)) {
                        routesDocUpdates[routeKey].departures.push(currentHM);
                    }

                    // For the next iteration, wait in the station unless we hit the very end
                    let stopMin = calcStopMinutes(cities[step.city].population || 0);
                    let nextHM = addMinutesToHM(arriveHM, stopMin);

                    rozkladGlobal.push({
                        kurs: kursId,
                        miasto: cities[step.city].name,
                        przyjazd: arriveHM,
                        odjazd: (i === fullPath.length - 1) ? arriveHM : nextHM,
                        kierunek: kierunekName
                    });

                    currentHM = nextHM;
                }
            }
        }

        let pathWWA_LODZ = dijkstra('warszawa', 'lodz');
        let pathLODZ_KAL = dijkstra('lodz', 'kalisz');
        let pathKAL_WRO = dijkstra('kalisz', 'wroclaw');

        if (pathWWA_LODZ && pathLODZ_KAL && pathKAL_WRO) {
            let part1 = pathWWA_LODZ;
            let part2 = pathLODZ_KAL.slice(1);
            let part3 = pathKAL_WRO.slice(1);
            const forward = [...part1, ...part2, ...part3];
            processPath(forward, ["06:00", "14:00"], "Wrocław", 1);

            let pathWRO_KAL = dijkstra('wroclaw', 'kalisz');
            let pathKAL_LODZ = dijkstra('kalisz', 'lodz');
            let pathLODZ_WWA = dijkstra('lodz', 'warszawa');

            let bPart1 = pathWRO_KAL;
            let bPart2 = pathKAL_LODZ.slice(1);
            let bPart3 = pathLODZ_WWA.slice(1);
            const backward = [...bPart1, ...bPart2, ...bPart3];
            processPath(backward, ["10:00", "18:00"], "Warszawa", 3);

            const batch = writeBatch(db);

            // Prepare updates but clear trainId from all routes first? No, just overwrite the assigned
            for (const rId in routesDocUpdates) {
                const rt = routesDocUpdates[rId];
                rt.departures.sort();
                console.log(`Update ${rId} odjazdy = ${rt.departures.join(',')}`)
                let rDocRef = doc(db, 'routes', rId);
                batch.update(rDocRef, {
                    departures: rt.departures,
                    trainId: TRAINSET_ID,
                    travelTime: Math.round((rt.distance / VMAX_KMH) * 60 + offsetMin)
                })
            }

            // Badge route title e.g. "Warszawa ➔ Łódź ➔ Wrocław" (omitting small towns)
            const routePathText = "Warszawa ➔ Łódź ➔ Kalisz ➔ Wrocław";

            batch.update(doc(db, `players/${PLAYER_ID}/trainSet`, TRAINSET_ID), {
                assignedRoutes: Object.keys(routesDocUpdates),
                rozklad: rozkladGlobal,
                routePath: routePathText
            })

            await batch.commit();

            console.log("Zrobione. Trasa nadpisana grafem poprawnymi odcinkami.")
        } else {
            console.log("Brakuje jakichs drog posrednich w bazie")
        }

        process.exit(0)
    } catch (e) {
        console.error(e)
        process.exit(1)
    }
}
run();
