# Stav projektu

_Aktualizováno: 2026-07-27_

## Kde jsme

Fáze 0 (přípravná) běží, ale **Čmuchal už sbírá naostro** — kalibrujeme ho
na reálných datech dřív, než se pustí zbytek fáze 0.

**Hotovo a ověřené ostrým během:**
- Čmuchal v2 — obrácené hledání „kde se pracuje", ne „kdo je kde zapsaný".
  Tři zdroje: otevřená data MPSV (pracoviště), OpenStreetMap (fyzická místa),
  sweep rejstříku podle obce (nejúplnější, ale nutný filtr na zaměstnance).
- Filtry: bez zaměstnanců, agentury práce, nevhodné obory (CZ-NACE 56 a 78),
  práh velikosti (výchozí 10 zaměstnanců — jen značí, nevyhazuje).
- Deník vyřazení (`vyrazeni`) — u každého kandidáta důvod i detail.
- Rešerše přes agenta na předplatném (`k-obohaceni` → `zapis-nalezy`),
  definice agenta v `.claude/agents/cmuchal.md`.
- Kartotéka členěná po oblastech + mapa na podkladu OpenStreetMap.
- **121 testů zelených, náklady 0 USD** (placené API nikdy neběželo).

**Data (v `data/pgdata-v5`):** 209 firem ve 4 oblastech, integrita ověřená.
Zbůch 55 firem (10 nad 25 zam.) · Tlučná 65 (5) · Bezdružice 24 (4) ·
Hrádek 65 (2). Kapacita známá jen u Bezdružic (10 obědů/den).

## Další krok (v tomto pořadí)

1. **Vyřadit vlastní jídelnu ze seznamu firem** — v Tlučné je mezi kandidáty
   ZŠ, která je zároveň náš partner. Sama sobě obědy prodávat nebude.
2. **Projít vzorek z 1 288 subjektů „velikost neuvedena"** — můžou se tam
   schovávat skuteční zaměstnavatelé, dnes je pouštíme jen ze slabšího zdroje.
3. **Vyřešit limit 1 000 výsledků ARES** — blokuje Stříbro i Plzeň
   (Plzeň = 342 zaměstnavatelů jen v datech MPSV). Zúžit dotaz podle
   městské části nebo oboru.
4. Pak rešerše kontaktů na nejlepší kandidáty a zbytek fáze 0
   (tvrzení, šablony, doména, právník — viz `docs/FAZE-0.md`).

## Co čeká na majitele

- Skutečné kapacity Zbůchu, Tlučné a Hrádku (potřeba až před fází 3).
- Projít vyřazené kandidáty a říct, co tam nepatří → brousíme pravidla.
- Rozhodnutí o sdílené databázi, až bude systém používat i kolega.

## Kde co hledat

| Co | Kde |
|---|---|
| Závazné zadání | `SPEC.md` |
| Orchestrace fáze 0 | `docs/FAZE-0.md` |
| Lidský popis systému | `docs/JAK-TO-FUNGUJE.md` |
| Rozhodnutí (co, kdo, proč) | `memory/rozhodnuti.md` |
| Technické poznatky a pasti | `memory/poznatky.md` |
| Postřehy z rešerší | `playbook-cmuchal.md` |
| Vizuální výstupy | `docs/vizualizace/` (mapa a kartotéka se generují) |

## Příkazy

```bash
npm test
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- stav
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- kartoteka
CANTINERO_DATA_DIR=data/pgdata-v5 NOMINATIM_CONTACT=… npm run cli -- run --jidelna <id>
```

**Pozor:** aktivní data jsou v `data/pgdata-v5`, ne ve výchozím `data/pgdata`
(starší běhy). Databázi smí otevřít jen jeden proces naráz — hlídá to zámek.
