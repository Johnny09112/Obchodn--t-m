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
- **Enrichment náklady**: claude-opus-4-8 $5/M in + $25/M out; hrubý odhad
  jednotky USD na ~10 obohacených firem (plus web search). Sledovat v agent_runs.
