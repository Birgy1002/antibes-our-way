# ANTIBES · OUR WAY — v0.8

Erste lauffähige Fassung der Côte-d’Azur-Workation-App, strukturell aus `luebeck-our-way` abgeleitet.

## Enthalten
- Bottom navigation: Home · Explore · Plans · Eat & Drink · Map
- 51 Explore-Orte
- 22 Cafés / Weinbars / Rooftops
- 14 flexible Plans
- November-Filter und zeitkritische Hinweise
- Workation & Innovation als Explore-Tag, nicht als Café-Kriterium
- lokale Statuswahl Want to go / Maybe / Been
- kontextsensitives Zurück aus Place/Food-Details in denselben Plan + Scrollposition
- Regionenkarte; Einzelziele öffnen die exakte Adresse in Google Maps
- PWA-Dateien; Service Worker wird auf localhost absichtlich **nicht** registriert

## Datenstruktur
- `data/places.js`
- `data/gastro.js`
- `data/plans.js`
- `data/events.js`

Restaurants sind im Filter vorgesehen, werden aber später separat und selektiv für Antibes und Nice ergänzt.

## Lokal testen
In VS Code den Ordner öffnen → `index.html` → Live Server.

## Nächste sinnvolle Schritte
1. In Browser/Handy testen und UX korrigieren.
2. Individuelle Einzelpins ergänzen, wenn gewünscht.
3. Restaurants Antibes/Nice separat kuratieren.
4. November-Events kurz vor Reise aktualisieren.
5. Danach neues GitHub-Pages-Repo anlegen und PWA aufs Handy nehmen.


## v0.2 – Peyrassol + Event Radar
- Peyrassol gets a dedicated Home card (Wine + Art Day)
- separate Event Radar view accessible from Home
- known November dates expanded: Nice L’Automne de l’Image / OVNi, Maison de l’IA, Menton/Beausoleil architecture tours
- weekly external radar watches Antibes official agenda, Nice photo/art programming, special tours, innovation/coworking and Peyrassol events


## Cache / versioning rule (from v0.6)
- Every release gets a new visible asset version, e.g. `?v=0.6`, `?v=0.7`.
- The service-worker cache name must match the release (`antibes-our-way-v0.6`, etc.).
- On `localhost` / `127.0.0.1` the app automatically unregisters service workers and deletes all `antibes-our-way-*` caches. Live Server therefore always shows the files currently open in VS Code.
- In production, navigation is network-first; versioned static assets are cached for offline use.
- For every future variant: bump the version in `index.html`, `app.js`, and `service-worker.js`.


## v0.7 – Nice neighborhoods, Cap Moderne, Monaco & practical planning
- Explore cards now include a fuller Why interesting section.
- Plans show closure/market-day warnings directly in the overview and detail.
- Nice reorganized by neighborhood: Vieux Nice self-guided walk, Cimiez, Libération/Musiciens, Port & Mont Boron.
- Nice & Beyond self-guided Vieux Nice route and coastal Nice→Villefranche idea integrated.
- Biot/Sophia only uses ALPHA on confirmed public-event days; Valbonne is the fallback.
- Èze/Corniches and Menton/Cap Martin combined to avoid two drives in the same direction.
- Cap Moderne / E-1027 added as exterior-only in November and highlighted on Sentier Le Corbusier.
- Monaco/Monte-Carlo added as an optional train day with Villa Paloma, Le Rocher, Casino Square and Japanese Garden.
- Event radar scope broadened to Meetup, Eventbrite, French Tech Côte d’Azur, SKEMA/UniCA/ETSI and Monaco sources.
- Hero sailboat redrawn larger and clearly recognizable.
- Cache/versioning bumped to v0.7.


## v0.8 – Corniches & copy refinements
- Chagall card rewritten: internal planning rationale removed; Cimiez explained instead.
- All visible MIP abbreviations expanded to Musée International de la Parfumerie.
- New Explore entry explains Basse, Moyenne and Grande Corniche and when each is useful.
- Plan 12 now uses Moyenne outbound to Èze, Basse toward Cap Martin/Menton, and Grande as daylight-only scenic return.
- Optional plan stops are no longer forced into Google Maps route links.
- Cache/versioning bumped to v0.8.


## v0.9 – combinable filters
Eat & Drink filters are now dimensional: Type (Coffee/Wine/Restaurant), Extras (Outdoor/Rooftop/Aperitif; multi-select), and Area (Antibes/Nice/Around). Explore area filters are simplified to Antibes/Nice/Around.
