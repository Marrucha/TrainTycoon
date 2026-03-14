# Frontend Notes - Rozwiązania i Problemy

## 1. Planowanie tras (Route Planner) i Algorytm Dijkstry

Podczas tworzenia mechanizmu do planowania tras fizycznych dla Ułożonych Składów Pociągów w `RoutePlanner.jsx`, natrafiłem na kilka kluczowych kwestii:

### Obliczanie Najszybszej i Najtańszej Trasy
Zamiast ręcznego tworzenia ścieżek "klocek po klocku", zaimplementowaliśmy Algorytm Dijkstry (`frontend/src/utils/dijkstra.js`), który działa na zrekonstruowanym grafie bazującym na kolekcji `routes`.
- **Problem**: Różne priorytety dla przewoźnika (najszybciej vs najtaniej).
- **Rozwiązanie**: Funkcja budująca nasz nieskierowany graf ocenia dwie wagi:
  - W trybie `fastest`: wagą jest zdefiniowany `travelTime`.
  - W trybie `cheapest`: wagą jest `distance`, ale nakładamy mnożnik kosztów wynajmu torów: `x 1.5` dla Tier 1 (tory główne) i `x 1.0` dla Tier 2. Dzięki temu Dijkstra naturalnie faworyzuje dłuższe, ale tańsze tory drugiej kategorii, jeśli sumarycznie wychodzi to korzystniej finansowo.

### Dynamiczna aktualizacja trasy (Mutli-Path)
Gracz klika serię miast, które mają się stać trasą (np. Warszawa -> Katowice -> Wrocław).
- **Problem**: Klasyczny Dijkstra wyznacza relację Punkt A -> Punkt B. My rejs budujemy z wielu węzłów pobocznych.
- **Rozwiązanie**: Napisałem wrapper `findMultiPath`, który odpala Dijkstrę krok po kroku pomiędzy każdą wybraną parą kolejnych stacji (Waypoint N do N+1). Wrapper następnie łączy zrekonstruowane listy połączeń w jedną gładką, ciągłą podróż.

### Interaktywna mapa i React Leaflet
- **Problem**: Wstrzyknięcie własnych zachowań do elementu mapy, tak aby po kliknięciu miasta (SVG Marker) aktualizowała się wybrana ścieżka na okienku modala, a nie uciekał focus. Z kolei `MapContainer` ma własny stan i eventy.
- **Rozwiązanie**: Wyizolowano mechanikę warstwy punktowej i krawędziowej w specjalnym komponencie `RoutePlannerMapOverlay`. Użyto tu `createPortal`, wyrzucając SVG w warstwę Leaflet, a do zaznaczonych miast wprowadzono dodatkowe zliczanie stopów (np. zielona kropka z literką '1', '2') obok ikonki miasta, aby gracz miał jasność, w jakiej kolejności ułożył trasę.

### Łączenie Czasowe (Time Calculation)
- **Problem**: Moduł zapisuje fizyczne krawędzie i przypina zarys planów stacji do rozkładów w kontekście. Skąd bierze się czas przyjazdu/odjazdu ułożony na "surowo"?
- **Rozwiązanie**: Dla celów testowych wprowadzono uproszczoną formułę podczas tworzenia i zapisywania rozkładu: zaczynamy bazowo o 08:00 (rano), a do wyliczenia kolejnej stacji bierzemy `travelTime` segmentu oraz dodajemy standardowy postój pociągu (10 minut wymiany pasażerskiej). To jest punkt wyjścia dla systemu faktycznych rozkładów jazdy.
