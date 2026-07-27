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
- **143 testů zelených, náklady 0 USD** (placené API nikdy neběželo).
- Bytové domy (SVJ, bytová družstva) se nezařazují; živnostníci mají vlastní
  část kartotéky. Rozlišuje právní forma z rejstříku (`companies.pravni_forma`,
  migrace 0008), ne název. Data: 208 → **110 firem + 57 živnostníků**,
  41 bytových domů vyřazeno.
- Sweep rejstříku se u ARES rovnou zužuje na formy zaměstnavatelů →
  **Stříbro odblokované** (1 580 subjektů spadlo → 285 projde). Ověřeno
  naostro. Plzeň sweepem pokrytá nebude, a to záměrně (viz rozhodnutí).
- Partnerská jídelna se nemůže stát kandidátem (migrace 0007, `jidelny.ico`,
  důvod vyřazení `partnerska_jidelna`). IČO všech 4 jídelen doplněno z ARES.
- Fronta na rešerši jde zúžit podle velikosti: `k-obohaceni --segmenty …`.
- **První ostrá dávka rešerše — konec procesu ověřen.** 20 firem nad
  25 zaměstnanců napříč všemi 4 oblastmi: **17 z 20 má doložený kontakt**,
  z toho 10 na jmenovanou osobu a 4 přímo adresu pro obchodní nabídky.
  26 kontaktů, 5 nálezů, 0 odmítnutých zápisů, 0 USD. Shrnutí pro majitele:
  `docs/vizualizace/reserse-2026-07-27.html`, poznatky v `playbook-cmuchal.md`
  (běh `c12acbba-7f70-4972-ad30-24cc413e5972`).

**Data (v `data/pgdata-v5`):** 208 firem ve 4 oblastech, integrita ověřená.
Kapacita známá jen u Bezdružic (10 obědů/den). Všech 20 firem nad
25 zaměstnanců je prověřeno rešerší.

## Poučení z první dávky rešerše

- **Způsob stravování se z webu dohledat nedá** — 0 z 20 firem ho uvádí.
  Na personalizaci podle tohoto údaje se nedá stavět.
- **Vlastní jídelna se doložit dá** a je to stejně cenný nález jako kontakt:
  vyřadila Centrum pobytových služeb Zbůch a ZŠ Vejprnice z cílení.
- **U 3 firem je kontakt jen z katalogu třetí strany** (Živé firmy, Firmy.cz,
  RegionPlzeň), ne z webu firmy → údaj může být zastaralý, značit zvlášť.
- **SIGNUM není agentura práce**, ale žárová zinkovna (500–999 zam.) —
  podezření z dřívějška bylo záměnou s agenturami, které pro ni najímaly.

## Další krok (v tomto pořadí)

1. **Rozhodnout, jestli se jde do Stříbra** — technicky je odblokované
   (285 subjektů projde), ale jídelna ve Stříbře není mezi odsouhlasenými
   pěti. Rozhoduje majitel.
2. **Plzeň přes MPSV + OpenStreetMap**, ne přes sweep rejstříku. 342
   zaměstnavatelů z otevřených dat MPSV je hotový seznam; sweep je tam
   špatný nástroj (viz rozhodnutí 2026-07-27). Potřebná je jídelna
   34. ZŠ Plzeň v DB.
3. **Projít vzorek z 1 288 subjektů „velikost neuvedena"** — můžou se tam
   schovávat skuteční zaměstnavatelé, dnes je pouštíme jen ze slabšího zdroje.
4. Zbytek fáze 0 (tvrzení, šablony, doména, právník — viz `docs/FAZE-0.md`).

**Otevřené k dořešení:** skóre se po rešerši nepřepočítává — firma s doloženou
vlastní jídelnou si drží původní skóre z doby sběru. Před frontou na oslovení
(fáze 3) to bude potřeba srovnat.

## Co čeká na majitele

- **Rozhodnutí o SVJ a OSVČ** — kartotéku zaplavují společenství vlastníků
  bytů (v Hrádku přes 15) a živnostníci vedení vlastním jménem. Formálně mají
  zaměstnance, ale obědy tam nikdo neodebírá. Vyřazení celé kategorie je
  změna pravidel → rozhoduje majitel. Detail v `memory/poznatky.md`.
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
| Výsledek první rešerše | `docs/vizualizace/reserse-2026-07-27.html` |

## Příkazy

```bash
npm test
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- stav
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- kartoteka
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- k-obohaceni --segmenty stredni,korporat
CANTINERO_DATA_DIR=data/pgdata-v5 NOMINATIM_CONTACT=… npm run cli -- run --jidelna <id>
```

**Pozor:** aktivní data jsou v `data/pgdata-v5`, ne ve výchozím `data/pgdata`
(starší běhy). Databázi smí otevřít jen jeden proces naráz — hlídá to zámek.
