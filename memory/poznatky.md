# Poznatky a gotchas

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
