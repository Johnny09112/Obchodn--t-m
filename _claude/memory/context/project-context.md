---
name: project-context
description: Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus
type: context
status: active
created: 2026-08-01
updated: 2026-08-01
---

# obchodni-tym — živý kontext

> Statické věci (stack, konvence, zákony) jsou v projektovém CLAUDE.md. Tady jen DYNAMICKÉ — co se mění během vývoje. Přepisuj v místě, neapenduj.

## Aktuální stav

**Fáze 0 (příprava) běží, ale fáze 1 (Čmuchal — sběr) běží napřed.** Sbírá se
naostro, protože se na reálných datech kalibruje líp než na úvahách. Do fáze 3
(oslovování) se nesmí, dokud není hotový zbytek fáze 0: tvrzení, šablony,
odesílací doména, právní konzultace.

Čísla z ostré databáze k 1. 8. 2026:

| Údaj | Hodnota |
|---|---|
| Firem v kartotéce | **13 767** |
| Z toho se spojením | **860** · v Plzni má 560 z 620 cílových |
| Vyřazených kandidátů, s důvodem | 4 044 |
| Oblasti · kampaně · průzkumy | 8 · 4 · 2 (oba hotové) |
| Běhů agenta | 15 |
| Náklady na API | **0 USD** — placené nikdy neběželo |
| Migrace | po `0032_oblast_slozeni.sql`, nasazeno |
| Testy | 533 zelených, 61 souborů |
| Odesílání | **vypnuté**, a žádný kód ho neumí zapnout |

Aplikace běží na `https://cantinero-find.vercel.app`, staví se z `main`.

**Poslední milník (31. 7.):** průvodce kampaní je celý — etapy A (návrh),
B (založení a území), B+ (hlídka Čmuchala), C (průzkum a seznam firem).
K tomu archivace a mazání kampaní, zámek úprav a provozní deník (obrazovka
Provoz, jen admin). Ověřeno celým řetězcem naostro: aplikace objednala
průzkum → hlídka ho vzala → Čmuchal sebral 13 600 firem → kampaň se naplnila.

**Úklid oblastí (1. 8.):** mazání nepoužitých oblastí je hotové a nasazené
(migrace 0028) — viz [[mazani-oblasti]]. Přitom se ukázalo, že mazání bylo
otevřené celému týmu a kaskádou by bralo i historii průzkumů; obojí zavřeno.

**Seznam oblastí (1. 8.):** obrazovka Oblasti má nahoře seznam s detailem
(pohled `oblasti_prehled`, migrace 0029) — [[prehled-oblasti-pohledem]].
Přitom se našel a opravil pomalý zápis po jedné
([[zapis-po-jedne-je-lokalne-neviditelny]]).

**Kampaň nad více oblastmi (1. 8.):** hotová a nasazená (migrace 0030) —
[[kampan-nad-vice-oblastmi]]. Tím je uzavřená celá trojice, kterou majitel
zadal 31. 7. (úklid, seznam s detailem, víc oblastí).

**Tvar oblasti u průzkumu (2. 8.):** hotové a nasazené (migrace 0031) —
[[tvar-oblasti-u-pruzkumu]]. Neproklikané v prohlížeči, viz tam.

**Kontakty i nad oblastí a oznámení u hodin (2. 8.):** obojí hotové —
[[kontakty-i-nad-oblasti]], [[oznameni-u-hodin]].

**Velikost firem a složení území (2. 8.):** hotové a nasazené (migrace 0032) —
[[velikost-ze-souboru-a-slozeni]]. Velikost se konečně ukládá ze souboru ČSÚ;
5 707 firem ji dostalo zpětně. **Síto tím začalo fungovat.**

## Plzeň — kde to stojí (2. 8.)

| Údaj | Hodnota |
|---|---|
| Firem v oblasti | 12 762 |
| Mikro (1–24) | 4 747 |
| **Cílových (25+)** | **620** |
| Velikost neuvádí registr | 7 395 |
| Z cílových má jméno | **560** |
| Z cílových má e-mail | 125 |
| Z cílových nemá nic | 60 |

## Aktuální focus

**Čeká se na majitele: pustit zkušební rešerši agentem na 20 firem?**
Byl by to **první placený běh** (dosud 0 USD), proto se nespustil sám.

Dál: etapa D průvodce (kritika a přístupnost), stránkování velkých seznamů.
Podrobně [[otevrene-pozadavky-majitele]].

## Otevřené body

Úplný seznam je v [[otevrene-pozadavky-majitele]]. Nejdůležitější:

- **7 395 plzeňských firem bez velikosti**, z toho zhruba polovina skutečná
  s.r.o. ARES je nedoplní ([[ares-nedoplni-velikost]]) — jediná cesta je
  sbírka listin, nepostavená.
- **Jméno jednatele není adresa.** I v cílovém segmentu má e-mail jen 125
  z 620. Bez dalšího zdroje adres je to poloviční výsledek.
- **Cena rešerše agentem není změřená.** Krok 3 nikdy neběžel.

## Co znamená „hotovo"

1. `npm test` **a** `npm run typecheck` (pouští i `app/`).
2. U frontendu **proklikat v prohlížeči** — testy ani typy nechytí vady toku
   a pořadí ([[zelene-testy-nejsou-hotova-obrazovka]]).
3. U migrací **nasadit** (`npm run cli -- migrate`).
4. Před tvrzením o nasazení pustit `npm run build --prefix app`
   ([[vercel-instaluje-jen-app-zavislosti]]).

## Kde co hledat

| Co | Kde |
|---|---|
| Závazné zadání | `SPEC.md` |
| Postup pro novou oblast | `docs/NOVA-OBLAST.md` |
| Lidský popis systému | `docs/JAK-TO-FUNGUJE.md` |
| Vizuální výstupy pro majitele | `docs/vizualizace/` |
| Historie rozhodnutí a poznatků do 31. 7. | `_claude/memory/_archive/` |
