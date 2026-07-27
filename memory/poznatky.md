# Poznatky a gotchas

## První ostrý běh (Bezdružice, 40 kandidátů, 2026-07-27) — co selhalo

Mechanika prošla (0 chyb, 39 kvalifikováno), ale **kvalita dat je slabá**.
Čtyři konkrétní vady k opravě před dalším během:

1. **Neodfiltrované OSVČ.** Většina nálezů jsou fyzické osoby („Alena
   Voříšková", „Zbyněk Rak"). Živnostník není odběratel firemních obědů.
   → Filtrovat podle právní formy, nebo aspoň bodově potlačit.
2. **`velikost_kategorie` je NULL u všech 40.** Vyhledávací endpoint ARES
   nevrací `statistickeUdaje.kategoriePoctuPracovniku` — vrací ho až detail
   subjektu. `cmuchal.ts` detail nevolá (spoléhá na výsledek hledání), takže
   25 z 100 bodů skóre je mrtvých. → Volat `overFirmu()` pro každého kandidáta.
3. **CZ-NACE se míchají úrovně.** Přicházejí jak sekce (`G`), tak dvoumístné
   (`55`, `00`) i pětimístné (`43120`) kódy. Náš test `slice(0,2)` je proto
   nespolehlivý — `55` (ubytování/stravování) projde jako „kancelářský obor".
   → Normalizovat na oddíl a ošetřit sekce.
4. **Geocoding u vesnic kolabuje na střed obce.** 40 firem → jen 30 různých
   bodů, spousta přesně na 307 m. Vzdálenost je tak orientační.
   → U malých obcí brát vzdálenost jako přibližnou, nespoléhat na ni v bodování.

Důsledek: skóre se pohybovalo v úzkém pásmu 52–56 b, tedy **nerozlišuje**.
Než se pojede Plzeň, je potřeba tyhle čtyři věci opravit.

## MPSV volná místa — nejlepší zdroj provozoven (ověřeno 2026-07-27)

`https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json` — otevřená data
Úřadu práce. **U každého inzerátu je `zamestnavatel.ico` + `zamestnavatel.nazev`
a `mistoVykonuPrace.pracoviste[].adresa.obec.id` (RÚIAN kód obce).** To je přímý
signál „tahle firma má pracoviště tady", tedy to, co ARES nedá.

- **Filtry a `limit` v URL se ignorují** — vždy přijde celý balík: ~178 MB,
  39 438 inzerátů, stažení ~8 s. Nutno cachovat na disk a filtrovat lokálně.
- Výsledky testu: Bezdružice 5 zaměstnavatelů, Zbůch 6, Plzeň 342,
  Tlučná 0, Hrádek u Rokycan 0.
- Omezení: je to bodový signál — kdo zrovna nenabírá, tam není. Doplňkový
  zdroj, ne jediný.

## Kategorie počtu zaměstnanců — POZOR na kód „000"

Oficiální číselník se dá stáhnout:
`POST /ciselniky-nazevniky/vyhledat` s `{"kodCiselniku":"KategoriePoctuPracovniku"}`.
**`000` = „Neuvedeno", NIKOLI „bez zaměstnanců" — tou je až `110`.** Původní
mapování v `ares.ts` bylo kvůli tomu špatně. Správný číselník je v `src/res.ts`.

Ověření na 40 firmách z prvního běhu: 16× bez zaměstnanců, 21× neuvedeno,
2× 1–5, 1× 25–49 (město Bezdružice). **Skuteční zaměstnavatelé z MPSV nebyli
mezi nimi ani jednou** — potvrzuje, že hledání podle sídla je slepá cesta.

## Zdroje dat — ověřeno 2026-07-27 (klíčové pro návrh Čmuchala v2)

- **ARES zná jen SÍDLA, ne provozovny.** Sub-registr RŽP (`/ekonomicke-subjekty-rzp/{ico}`)
  vrací `zivnosti` a `adresySubjektu`, ale **žádné provozovny** (`provozovnyStav`
  je undefined). Zinkovna v Bezdružicích proto přes ARES nejde najít — v celém
  ARES je „zinkovna" jediná (Žárová zinkovna Bílina) a sídlí jinde.
  → Provozovny se musí hledat jinudy: fyzicky podle místa.
- **Počet zaměstnanců JE dostupný** — ale v sub-registru RES
  (`/ekonomicke-subjekty-res/{ico}` → `zaznamy[0].statistickeUdaje.kategoriePoctuPracovniku`),
  ne v základním detailu ani ve výsledku hledání. **Kód „000" = bez zaměstnanců.**
  Všechny tři testované s.r.o. v Bezdružicích mají „000" → nejsou to odběratelé.
  **Tohle je hledaný filtr na OSVČ a prázdné schránky.**
- **OpenStreetMap (Overpass API) funguje a najde reálná pracoviště**, která
  ARES minul: Léčebný Hotel Prusík, Lázeňský hotel Jirásek, KAPIC software,
  COOP, zdravotní středisko, restaurace. Zdarma, legální, bez klíče.
  Gotchy: hlavní server `overpass-api.de` často vrací **504** → použít mirror
  `overpass.kumi.systems`; dotaz držet úzký (velký radius + moc tagů = timeout);
  povinný slušný User-Agent s kontaktem.

## ARES — ověřeno reálnými dotazy 2026-07-26

- **Limit 1 000 výsledků** na `/ekonomicke-subjekty/vyhledat`. Nad limit vrací
  HTTP 400 `VYSTUP_PRILIS_MNOHO_VYSLEDKU`. **Plzeň má 49 831 subjektů → náš
  `najdiFirmyVObci` na velkých městech spadne.** Nutná strategie zúžení
  (městská část / NACE / ulice) — viz `docs/FAZE-0.md`, úkol pro S0.3.
- Filtr `sidlo` **nepodporuje** `nazevObce` ani `psc` — jen `kodObce`
  (číselný RÚIAN kód). Neznámý filtr se tiše ignoruje a API pak vrátí
  `VSTUP_PRAZDNY`, což mate — netvař se, že filtr funguje, dokud to neověříš.
- Kód obce se dá získat vyhledáním libovolného známého subjektu v obci
  (`obchodniJmeno`) — takhle jsme dohledali všech 5 škol.
- Počty subjektů v cílových obcích (vč. OSVČ a spolků): Bezdružice 212,
  Hrádek u Rokycan 450, Zbůch 556, Tlučná 745, Plzeň 49 831.

## Nominatim

- **Blokuje `example.com` v User-Agent → HTTP 403.** `NOMINATIM_CONTACT` musí
  být skutečná kontaktní adresa provozovatele, jinak geocoding nefunguje.

- **IČO checksum**: mod-11, váhy 8..2, kontrolní číslice `(11 − suma % 11) % 10`.
  Pozor: `00000001` je checksum-validní — reálnost firmy garantuje až ARES (TP-1).
- **ARES API**: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest`; vyhledávání
  dle `sidlo.kodObce` (POST /ekonomicke-subjekty/vyhledat, stránkuje se).
  Kód obce je hrubé síto (Praha = jedna obec) — jemný filtr dělá geocoding + zóna.
- **Nominatim**: tvrdý limit 1 req/s + povinný kontakt v User-Agent, jinak ban.
- **PGlite**: Postgres 17 ve WASM, testy běží offline; nepodporuje vnořené
  transakce (vnitřní `tx` sdílí vnější).
- **Windows/Git**: CRLF warningy jsou neškodné; nechat default autocrlf.
- **Enrichment náklady**: platí jen při provozu přes API. Rozhodnuto jinak —
  enrichment dělá agent v Claude Code na předplatném (viz rozhodnuti.md),
  takže mezní náklad je nula. `src/enrich.ts` (API cesta) zůstává jako
  varianta pro externího klienta; ceník claude-opus-4-8 $5/M in + $25/M out.
- **PGlite na disku**: `new PGlite(cesta)` si **nevytvoří vnořený adresář** —
  je potřeba `mkdir -p` předem (řeší `pripojPglite`). Datový adresář má i
  prázdný ~39 MB (běžná režie Postgresu), záloha = zkopírovat `data/`.
