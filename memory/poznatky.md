# Poznatky a gotchas

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
