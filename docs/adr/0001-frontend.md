# ADR 0001 — Frontend pro oblasti, kategorie a kampaně

**Stav:** návrh k odsouhlasení · **Datum:** 2026-07-28 · **Rozhodne:** majitel

## Kontext

Majitel potřebuje čtyři věci, které konverzačně udělat nejdou nebo jdou špatně:

1. **Kreslit oblast hledání.** Kruh kolem jídelny nestačí — usekne sousední
   město v půlce a zvětšení poloměru nabere na druhé straně, co nemá.
   Potřeba je nepravidelný tvar natažený jedním směrem.
2. **Oblast bez jídelny.** Obrácený postup: nejdřív označit území, dostat
   seznam firem jako podklad na jednání, a jídelnu doplnit až po dohodě.
3. **Kategorie firem podle zaměření** — filtr srozumitelný člověku, ne kódy
   CZ-NACE.
4. **Vlastní blacklist** — v duchu automatického vyřazení bytových domů,
   ale s pravidly, která určí majitel.

A dál výběr firem do kampaně kliknutím do mapy.

Rozhodnutí z 2026-07-26 říkalo, že frontend slouží ke **sledování
a schvalování, ne jako ovládání**. Body 1, 2 a výběr do kampaně jsou
ovládání — majitel to rozhodnutí 2026-07-28 vědomě změnil. Uživatelé:
**majitel i kolega**.

## Rozhodnutí

### Architektura: aplikace je oči a ruce, agent zůstává v Claude Code

```
   člověk ──► webová aplikace ──┐
                                ├──► sdílená databáze (Supabase)
   člověk ──► Claude Code ──────┘        ▲
              (agent Čmuchal)            │
                                    tatáž data
```

Agent **neběží** v aplikaci. Zůstává v Claude Code na předplatném každého
uživatele (rozhodnutí 2026-07-26 o provozu na předplatném) a s aplikací se
potkává jen v databázi. Aplikace tedy nepotřebuje server, který by něco
spouštěl — potřebuje jen číst a psát data.

**Důsledek:** aplikace je statická stránka mluvící přímo se Supabase.
Žádný vlastní backend, žádný běžící proces, hosting zdarma.

Kód je na to připravený: `pripojPostgres(DATABASE_URL)` už existuje
a používá se místo lokální PGlite pouhým vyplněním proměnné.

### Geometrie bez PostGIS

Supabase PostGIS umí, ale **testy běží nad PGlite, která ho nemá**.
Kdyby se dotazy opřely o PostGIS, `npm test` přestane fungovat offline —
a to je pravidlo projektu.

**Řešení:** tvar oblasti se ukládá jako GeoJSON do `jsonb` a test „leží
bod uvnitř?" se dělá v TypeScriptu (ray casting pro polygon, vzdálenost
pro kruh). Pro naše objemy je to zdarma — celá ČR má 35 tisíc firem nad
25 zaměstnanců, tedy pár milisekund.

**Vedlejší přínos:** stejné chování na obou databázích, testy zůstávají
offline a bez sítě.

### Datový model (přírůstky)

| tabulka | k čemu |
|---|---|
| `oblasti` | Území hledání. `typ` = kruh (střed + poloměr) nebo polygon (GeoJSON). **`jidelna_id` je nepovinné** — oblast smí existovat bez jídelny a jídelna se k ní doplní později. |
| `oblast_firmy` | Které firmy do oblasti spadají. Přepočítává se stejně jako `dosah`. |
| `kategorie` | Převod CZ-NACE → kategorie srozumitelná člověku (výroba, úřad, zdravotnictví, obchod, doprava, školství…). |
| `blacklist` | Pravidla majitele: podle IČO, vzoru názvu, oboru nebo právní formy. Vždy s důvodem — stejně jako deník vyřazení. |
| `kampane` | Kampaň = pojmenovaný výběr firem + oblast + stav. |
| `kampan_firmy` | Které firmy do kampaně patří a v jakém jsou stavu. |

`dosah` (jídelna ↔ firma) zůstává. `oblasti` jsou obecnější: jídelna má
dosah, oblast může být jen průzkumná.

### Co aplikace umí a co ne

**Umí:** zobrazit mapu, nakreslit a upravit oblast, filtrovat firmy
(velikost, kategorie, stav kontaktu, vzdálenost), vypsat seznam, vybrat
firmy do kampaně, spravovat blacklist, prohlížet kartotéku s evidencí.

**Neumí a nebude:**
- **Spouštět agenta** — to zůstává v Claude Code.
- **Odesílat e-maily.** TP-8 platí dál: `system_state.sending_enabled`
  je false a zapnout to smí jedině člověk. Frontend na tom nic nemění.
  Před prvním odesláním musí být hotová tvrzení, šablony a právní
  posouzení z fáze 0.

### Technologie

- **Databáze:** Supabase, nový (třetí) projekt. Podle Supabase **0 Kč/měsíc**
  pro organizaci `rvggjrhhhfssdjhcbwxj`. Stávající dva projekty
  (`mas-copilot`, `Johnny09112's Project`) zůstávají nedotčené.
- **Přihlašování:** Supabase Auth (e-mail), přístup hlídá Row Level Security
  přímo v databázi — ne v aplikaci. Data se tak nedají obejít ani přímým
  dotazem.
- **Aplikace:** statická stránka (mapa Leaflet, kterou už používáme
  v `mapa.html`, + kreslení). Hosting zdarma.
- **Data zůstávají v EU** — obě stávající Supabase organizace jsou v EU
  regionech, nový projekt založíme taky.

### Pořadí prací

| # | co | UI? | přínos |
|---|---|---|---|
| 1 | Oblasti v jádru — model, výpočet příslušnosti, CLI | ne | Obrácený postup (oblast bez jídelny) funguje hned z příkazu |
| 2 | Kategorie + blacklist | ne | Filtry, které bude frontend potřebovat, budou hotové dřív než on |
| 3 | Přesun na sdílenou databázi | ne | Nutný krok pro dva uživatele; ověří se na stávajících datech |
| 4 | Web: mapa, kreslení oblasti, seznam firem | **ano** | Hlavní požadavek — kreslení a kontrola oblasti před hledáním |
| 5 | Kampaně: výběr z mapy do seznamu | **ano** | Podklad pro ruční odesílání |

Kroky 1–3 mají smysl samy o sobě i kdyby se frontend odložil. Krok 4 je
ta věc, kvůli které se to celé dělá.

## Rizika a co s nimi

| riziko | co s tím |
|---|---|
| **Projekt zdarma se po týdnu nečinnosti uspí.** | Se dvěma uživateli a běhy agenta nehrozí, ale je to důvod hlídat. Probuzení je otázka kliknutí, data se neztratí. |
| **Přesun dat z lokální databáze.** | Migrace jsou idempotentní a schéma je stejné. Lokální data se přenesou; záloha se dělá zkopírováním adresáře. |
| **Dva uživatelé, jedna databáze — kdo co přepsal.** | Supabase je víceprocesový Postgres, takže tichá ztráta integrity jako u PGlite nehrozí. U kampaní a blacklistu se zapisuje, kdo změnu udělal. |
| **Kreslení oblasti je nezvyklé ovládání.** | První verze umí obojí: kruh (rychlé, stačí ve většině případů) i kreslení (když kruh nesedí). |
| **Postavíme špatné UI.** | Krok 4 se dělá na skutečných datech z kroků 1–3, ne na vymyšlených. |

## Co tím padá

Dřívější nabídka „nakresli si oblast v mapě a pošli mi ji zpátky" se ruší.
Byla to náhražka, která obchází problém místo jeho vyřešení.

## Otevřené otázky pro majitele

1. **Založit třetí Supabase projekt** (0 Kč/měsíc)? Bez toho krok 3 nejde.
2. **Kategorie** — jaké členění dává obchodně smysl? Návrh: výroba, stavebnictví,
   doprava a sklady, obchod, úřady a samospráva, školství, zdravotnictví
   a sociální služby, služby, ostatní.
3. **Doména** — má aplikace běžet na vlastní adrese, nebo stačí adresa
   od hostingu? (Doména stojí peníze, tedy rozhodnutí majitele.)
