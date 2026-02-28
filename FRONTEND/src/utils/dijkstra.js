/**
 * Algorytm Dijkstry do znajdowania najszybszej lub najtańszej trasy
 * bazując na dostępnych torach (routes/connections).
 */

class PriorityQueue {
    constructor() {
        this.values = [];
    }
    enqueue(val, priority) {
        this.values.push({ val, priority });
        this.sort();
    }
    dequeue() {
        return this.values.shift();
    }
    sort() {
        this.values.sort((a, b) => a.priority - b.priority);
    }
    isEmpty() {
        return this.values.length === 0;
    }
}

/**
 * Zbuduj graf w oparciu o aktywne krawędzie (łączące stacje) w grze.
 * @param {Array} connections - lista połączeń np. z INITIAL_ROUTES lub bieżących routes
 * @param {String} mode - 'fastest' (czas przejazdu) lub 'cheapest' (koszt)
 */
function buildGraph(connections = [], mode) {
    const graph = {};

    connections.forEach(conn => {
        if (!graph[conn.from]) graph[conn.from] = [];
        if (!graph[conn.to]) graph[conn.to] = [];

        // Tier 1 jest 50% droższy pod kątem wynajmu (koszt dla gracza)
        const costMultiplier = conn.routeTier === 1 ? 1.5 : 1;

        let weight;
        if (mode === 'fastest') {
            weight = conn.travelTime;
        } else { // cheapest
            weight = conn.distance * costMultiplier; // Wynajem torów / km
        }

        // Krawędź A -> B
        graph[conn.from].push({ node: conn.to, weight, edge: conn });
        // Krawędź B -> A (graf nieskierowany)
        graph[conn.to].push({ node: conn.from, weight, edge: conn });
    });

    return graph;
}

export function findShortestPath(connections = [], startId, endId, mode = 'fastest') {
    if (!startId || !endId) return null;
    const graph = buildGraph(connections, mode);
    if (!graph[startId] || !graph[endId]) return null;

    const distances = {};
    const previous = {};
    const pq = new PriorityQueue();

    for (let node in graph) {
        if (node === startId) {
            distances[node] = 0;
            pq.enqueue(node, 0);
        } else {
            distances[node] = Infinity;
            pq.enqueue(node, Infinity);
        }
        previous[node] = null;
    }

    let path = [];
    let edges = [];

    while (!pq.isEmpty()) {
        const smallest = pq.dequeue().val;

        if (smallest === endId) {
            // Znaleziono ścieżkę, odtwarzanie
            let curr = smallest;
            while (previous[curr]) {
                path.push(curr);
                edges.push(previous[curr].edge);
                curr = previous[curr].node;
            }
            path.push(startId);
            path.reverse();
            edges.reverse();

            // Oblicz łączne parametry znaleziona trasy
            const totalDistance = edges.reduce((sum, e) => sum + e.distance, 0);
            const totalTime = edges.reduce((sum, e) => sum + e.travelTime, 0);
            const totalCost = edges.reduce((sum, e) => sum + (e.distance * (e.routeTier === 1 ? 1.5 : 1)), 0);

            return { path, edges, totalDistance, totalTime, totalCost };
        }

        if (smallest || distances[smallest] !== Infinity) {
            for (let neighborIdx in graph[smallest]) {
                const neighbor = graph[smallest][neighborIdx];
                const candidate = distances[smallest] + neighbor.weight;

                if (candidate < distances[neighbor.node]) {
                    distances[neighbor.node] = candidate;
                    previous[neighbor.node] = { node: smallest, edge: neighbor.edge };
                    pq.enqueue(neighbor.node, candidate);
                }
            }
        }
    }

    return null; // Brak trasy
}

/**
 * Łączy ścieżki dla wielu punktów na trasie w kolejności
 */
export function findMultiPath(connections = [], stopIds, mode = 'fastest') {
    if (!stopIds || stopIds.length < 2) return null;

    let fullPath = [];
    let fullEdges = [];
    let totalDist = 0;
    let totalTime = 0;
    let totalCost = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
        const segment = findShortestPath(connections, waypoints[i], waypoints[i + 1], mode);
        if (!segment) return null; // Przerwana trasa

        // Dodaj path unikając duplikatów węzłów stycznych
        if (i === 0) {
            fullPath.push(...segment.path);
        } else {
            fullPath.push(...segment.path.slice(1));
        }

        fullEdges.push(...segment.edges);
        totalDist += segment.totalDistance;
        totalTime += segment.totalTime;
        totalCost += segment.totalCost;
    }

    return {
        path: fullPath,
        edges: fullEdges,
        totalDistance: totalDist,
        totalTime: totalTime,
        totalCost: totalCost
    };
}
