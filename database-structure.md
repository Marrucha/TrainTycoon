# Struktura bazy danych (Firestore) dla projektu Train Manager

Dane są przechowywane w trzech głównych (płaskich) kolekcjach głównych dokumentów: `cities`, `trains` oraz `routes`.
Każdy dokument odpowiada jednemu rekordowi operacyjnemu w logice gry i posiada narzuconą niżej listę pól, służącą między innymi do wyliczania tras w locie.

---

## 🏛 Kolekcja: `cities` (Miasta i Stacje)

Dokumenty w `cities` reprezentują miasta i miejsca postojowe na mapie (w tym stacje graniczne lub międzynarodowe). Służą do wyświetlania statystyk i wyznaczania współrzędnych SVG dla animacji pociągów na frontendzie.

**Format i Opis Pól:**

*   `id` (String): Identyfikator miasta służący też za dowiązanie z polami tras (np. `"warszawa"`, `"berlin"`, `"budzisko"`). Taki sam jak nazwa dokumentu.
*   `name` (String): Nazwa miasta wyświetlana klientowi (np. "Warszawa", "Gorzów Wlkp.").
*   `voivodeship` (String) [Opcjonalne]: Województwo (np. `"Mazowieckie"`). Występuje przy polskich miastach i mniejszych stacjach.
*   `country` (String) [Opcjonalne]: Kraj (np. `"Niemcy"`, `"Litwa"`). Pole zarezerwowane głównie dla dokumentów ze znacznikiem tier "international".
*   `tier` (String / Number): Ważność węzła, gdzie:
    *   `1` - stolice województw
    *   `2` - pozostałe polskie miasta
    *   `"international"` - miasta zagraniczne
    *   `"crossing"` - przejścia graniczne i przesiadki brzegowe.
*   `isCapital` (Boolean) [Opcjonalne]: Czy dane miasto jest stolicą regionu. (np. `true`).
*   `tourist` (Boolean) [Opcjonalne]: Prawda, jeśli węzeł zalicza się do miast bardzo turystycznych (np. Zakopane, Wisła).
*   `lat` (Number): Szerokość geograficzna w stopniach (latitude).
*   `lon` (Number): Długość geograficzna w stopniach (longitude).
*   `svgX` (Number): Parametr układu X w proporcjach względem warstwy `.png` mapy na frontendzie.
*   `svgY` (Number): Parametr układu Y w proporcjach względem warstwy `.png` mapy na frontendzie.
*   `population` (Number) [Opcjonalne]: Oszacowana populacja miasta do algorytmów obliczających np. średnie obłożenie pasażerskie.
*   `platforms` (Number) [Opcjonalne]: Ilość dostępnych fizycznie peronów na stacji obsługujących planowanie rozkładu jazdy trasy (od 2 do ok. 13).
*   `crosses` (String) [Opcjonalne]: Informacja o tym jakie granice przekracza, w przypadku węzłów typu "crossing" (np. `"Polska ↔ Niemcy"`).

---

## 🚂 Kolekcja: `trains` (Flota Taborów)

Dokumenty opisują posiadane, wyprodukowane i możliwe do kupienia pociągi (wagony, jednostki, pojazdy) jakimi operuje w grze menadżer.

**Format i Opis Pól:**

*   `id` (String): Unikalny identyfikator przydziałowy użyty wewnątrz obiektów Route (np. `"t1"`, `"t4"`). Taki sam jak nazwa dokumentu.
*   `name` (String): Nazwa maszyny taboru składu z ewidencji (np. `"IC 1001"`, `"EIC 301"`).
*   `type` (String): Marka, koncepcja pociągu rzutująca na wskaźnik premium (np. `"InterCity"`, `"TLK"`, `"EIC"`).
*   `speed` (Number): Maksymalna prędkość operacyjna maszyny (w `km/h`). Wpływa na skrócenie czasów transportu.
*   `seats` (Number): Ilość foteli/w miejsc i dopuszczalnej ilości pasażerów zabieranych przez pojazd do wykreowania limitu przychodów ze sprzedaży biletów.
*   `costPerKm` (Number): Wydatki z tytułu eksploatacji składu za każdy przejechany fizycznie w kilometrach odcinek podany jako waluta (pln w grze). 

---

## 🛤 Kolekcja: `routes` (Linie i Rozkłady)

Skomplikowane węzły tras od stacji z punktu A (np. "Kraków") do stacji z punktu B (np. "Warszawa"), uwzględniające przydział pociągu (lub ich brak i możliwości połączeniowe).

**Format i Opis Pól:**

*   `id` (String): Klucz relacji w logice, najczęściej `"{from}-{to}"` (np. `"warszawa-skierniewice"`). Tożsamy z nazwą dokumentu Firestore.
*   `from` (String): Odzwierciedla wartość miast z pola `id` w dokumencie `cities` - punkt startowy (miasto A).
*   `to` (String): Odzwierciedla wartość miast z pola `id` w dokumencie `cities` - punkt końcowy (miasto B).
*   `routeTier` (String / Number): Typ powiązania trasy, taki sam jak w tabeli z miastami (np. 1, 2, `"international"`). 
*   `trainId` (String | null): Jeśli do połączenia międzyliniowego przypisaliśmy z bazy tabor z floty, w tym miejscu widnieje dowiązany klucz identyfikacyjny np. `"t3"` (lub rezerwowo `null` w przypadku "nieużywanego" kanału przejazdu gotowego do aktywnej rekrutacji taboru).
*   `departures` (Array of Strings): Tablica sztywnych godziowych odjazdów używana przez interfejsy menadżera. (W systemie w modelu 24H HH:MM) Np: `["07:00", "12:00"]`.
*   `distance` (Number): Wyceniona w kilometrach fizyczna odległość po między dokumentami `from` a `to`.
*   `travelTime` (Number): Zaprogramowany, estymowany czas na starym modelu jazdy pokonywania odcinka w minutach.
*   `ticketPrice` (Number): Koszt (przychód dla budżetu miasta) za pojedynczego bileta sprzedanego dla pasażera pomiędzy punktami stacji na ten dystans.
*   `avgOccupancy` (Number): Wskaźnik średniej popularności danej linii przedstawiany w ułamku z dokładnością i pulą błędu estymacji (np. `0.85` wyniesie 85 proc obłożenia w całości foteli dostępnych na zakup).
*   `dailyRevenue` (Number): Dochód dzienna bazowa, sumaryczna gotówka z zebranych zarobków przed doliczeniem dotacji operacyjnej dla konkretnej linii i połączenia.
*   `subsidy` (Number): Państwowa dotacja do linii lub połączeń subregionalnych doliczana w cyklach z `dailyRevenue`. 
