# Cantinero

Agentní obchodní systém dle [SPEC.md](SPEC.md). Tento repozitář obsahuje
**fázi 1 — Čmuchala**: vyhledávání a kvalifikaci firem v zónách partnerských
jídelen. Jen sběr, žádné odesílání (`system_state.sending_enabled` je defaultně
`false` a žádný kód fáze 1 neumí odesílat).

## Co je hotové (fáze 1)

- Postgres schéma (Supabase layout, `supabase/migrations/`) s tvrdými pravidly
  v DB: formát IČO (TP-1), evidence se zdrojem a whitelistem atributů
  (TP-2/TP-3), úrovně adres (TP-6), single-row `system_state` (TP-8),
  `agent_runs` (TP-13).
- ARES klient (ověření IČO vč. checksumu, výčet firem dle obce).
- Geocoding (Nominatim, 1 req/s) + výpočet vzdálenosti a zón (pěší ≤ 800 m,
  dojezd ≤ zóna jídelny).
- Skórování 0–100 (vzdálenost, velikost, vlastní jídelna, obor, poptávková adresa).
- Enrichment z webu přes Claude API (`claude-opus-4-8` + web search): stav
  stravování, účel adres, max 2 kontakty — vše jen s doslovnou citací a zdrojem,
  jinak se zahazuje.
- Orchestrátor Čmuchala + CLI + metriky fáze 1.

## Spuštění

```bash
npm install
npm test                # celá testovací sada (PGlite, bez sítě)
```

Provoz vyžaduje `.env` dle [.env.example](.env.example) (DATABASE_URL na
Supabase, ANTHROPIC_API_KEY, NOMINATIM_CONTACT):

```bash
npm run cli -- migrate
npm run cli -- seed-jidelna --nazev "ZŠ Komenského" --adresa "…" --lat 50.08 --lng 14.42 --kod-obce 554782 --kapacita 150
npm run cli -- run --jidelna <id> --limit 50
npm run cli -- stav
npm run cli -- metriky
```

Cíl fáze 1: **200 ověřených firem v zónách** se zdrojem u každého údaje +
ruční kontrola vzorku 30 firem. Postup do fáze 2 (Spojka, inbound) až po
vyhodnocení.

## Co fáze 1 záměrně nedělá

Žádné odesílání, šablony, souhlasy ani suppression logika — tabulky existují,
logika přijde ve fázích 2–5 dle SPEC kap. 12. Před fází 3 je nutná konzultace
s advokátem (SPEC kap. 13).
