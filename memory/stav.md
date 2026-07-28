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
- **235 testů zelených, náklady 0 USD** (placené API nikdy neběželo).
- **Krok 2 frontendového plánu hotový: kategorie a blacklist** (migrace 0012).
  Kategorie jsou data, ne kód — dají se upravit bez zásahu do programu.
  167 firem zařazeno; „Restaurace a pohostinství" je zatím prázdná, protože
  stravování vyřazujeme už při sběru. Blacklist má povinný důvod a uplatní
  se při sběru (`vyrazeni.duvod = 'blacklist'`).
- **Krok 1 frontendového plánu hotový: oblast je samostatná věc.**
  Smí existovat bez jídelny (obrácený postup) a může být kruh i nakreslený
  tvar. Migrace 0011, `src/oblast.ts`, CLI `oblast nova|prirad|firmy`.
  Ověřeno naostro: „Průzkum Rokycansko“, kruh 12 km, 41 firem, bez jídelny.
- **Kontakty: 18 z 20 firem nad 25 zaměstnanců je hotových** (známe jméno
  osoby i spojení na ni). Zbývají dvě — I.U.STAVBY nemá vůbec webovou stopu,
  H.B. TEXTILIE má jméno i e-mail, ale na různých záznamech (viz poznatky).
- **Firma smí být v dosahu víc jídelen** (tabulka `dosah`, migrace 0010).
  Dnes 0 sdílených, ale Zbůch a Tlučná se zónami už překrývají.
- `cli zona` ukáže, kolik firem přibude při jakém poloměru. **Vidí ale jen
  do území jídelny** — na rozšíření zóny za hranice obce nestačí.
- **5 jídelen**, z toho 4 se známou kapacitou (70 obědů/den celkem).
  Pátá je 34. ZŠ Plzeň, Gerská — kapacita zatím neznámá.
- `.env` se načítá sám, `NOMINATIM_CONTACT` se už nemusí psát k příkazům.
- **Konkrétní osoba u firmy** — hlavní úkol Čmuchala. Kód sám zapisuje
  kontakt z otevřených dat MPSV (jméno, pozice, e-mail, telefon) a jednatele
  z veřejného rejstříku tam, kde jinak kontakt není. Měřeno: jméno by
  přibylo u 8 z 10 firem, které dosud neměly žádné. Detaily v `poznatky.md`.
- **Zdrojem seznamu firem je kompletní registr ČSÚ** (`src/registr.ts`,
  otevřená data, 541 MB v `data/cache/`). Limit 1 000 výsledků tím přestal
  platit — funguje stejně na vesnici i v Praze. Adresovatelný trh celé ČR:
  **35 138 firem nad 25 zaměstnanců** (Praha 9 337, Brno 2 091, Plzeň 719).
  Detaily a pasti v `poznatky.md`.
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

1. **Ostrý běh na Plzni** — jídelna je založená, čeká 719 firem nad 25 zam.
   v 10 obvodech. První zkouška velkého města; pozor na počet dotazů na
   geokódování (1 req/s → 719 firem je přes 12 minut jen na zaměřování).
2. **Stříbro** — technicky odblokované (285 subjektů projde), ale partnerská
   jídelna tam není. Majitel ho chce pustit; buď najít partnera, nebo obrátit
   postup a nechat systém napřed ukázat, kde jsou zaměstnanci.
3. **Projít vzorek subjektů „velikost neuvedena"** — celostátně jich je
   480 498, takže číslo 35 138 cílů je spodní odhad. Můžou se tam schovávat
   skuteční zaměstnavatelé.
4. Zbytek fáze 0 (tvrzení, šablony, doména, právník — viz `docs/FAZE-0.md`).

**Otevřené k dořešení:** licence otevřených dat ČSÚ není na stránkách
produktu výslovně uvedená (kontakt: michal.cigas@csu.gov.cz). Před ostrým
komerčním provozem to chce potvrdit — právní věc, rozhoduje majitel.

**Otevřené k dořešení:** skóre se po rešerši nepřepočítává — firma s doloženou
vlastní jídelnou si drží původní skóre z doby sběru. Před frontou na oslovení
(fáze 3) to bude potřeba srovnat.

## Co čeká na majitele

- **Dobrousit kategorie.** Do „ostatních" spadlo 24 firem, z toho spolky
  a sport (CZ-NACE 93, 94, 90 — 10 firem), opravny (95 — 2), zemědělství
  a rybolov (01, 03 — 2). Chce majitel pro ně vlastní kategorie, nebo je
  přiřadit do stávajících?

- **Návrh Čmuchala ke schválení:** u mikrofirem bez webu zkusit veřejné
  registry zadávacích řízení (profily zadavatelů, ISVZ/NEN) — pokud firma
  byla subdodavatelem na veřejné zakázce, bývá tam kontakt na statutárního
  zástupce. Agent to podle pravidel nezkusil a čeká na schválení.
- **Má se hledat spojení i u 81 mikrofirem?** Podle dřívějšího rozhodnutí
  se na ně cílí jinou formou než e-mailem, takže by ten čas šel spíš do Plzně.
- **Je firma „hotová", když je jméno na jednom záznamu a e-mail na druhém?**
  Přísně 18 z 20, na úrovni firmy 19 z 20 (viz poznatky).

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
