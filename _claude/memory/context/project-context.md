---
name: project-context
description: Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus
type: context
status: active
created: 2026-08-01
updated: 2026-08-03
---

# obchodni-tym — živý kontext

> Statické věci (stack, konvence, zákony) jsou v projektovém CLAUDE.md. Tady jen DYNAMICKÉ — co se mění během vývoje. Přepisuj v místě, neapenduj.

## Aktuální stav

**Fáze 0 (příprava) běží, ale fáze 1 (Čmuchal — sběr) běží napřed.** Sbírá se
naostro, protože se na reálných datech kalibruje líp než na úvahách. Do fáze 3
(oslovování) se nesmí, dokud není hotový zbytek fáze 0: tvrzení, šablony,
odesílací doména, právní konzultace.

Čísla z ostré databáze k 3. 8. 2026:

| Údaj | Hodnota |
|---|---|
| Firem v kartotéce | **13 858** |
| Z toho se spojením | 648 |
| Oblastí · kampaní | 7 · 5 |
| Náklady na API | **0 USD** — placené nikdy neběželo, agent jde z předplatného |
| Migrace | po `0033_indexy_rychlost.sql`, nasazeno |
| Testy | **540 zelených, 62 souborů** |
| Odesílání | **vypnuté**, a žádný kód ho neumí zapnout |

Aplikace běží na `https://cantinero-find.vercel.app`, staví se z `main`.
Vývojový server: `npm run dev --prefix app` (port 5173).

## Plzeň — referenční oblast

| Údaj | Hodnota |
|---|---|
| Firem v oblasti | 12 762 |
| Mikro (1–24) | 4 747 |
| **Cílových (25+)** | **620** |
| Velikost registr neuvádí | 7 395 |
| Z cílových má jméno · e-mail · telefon | 560 · 125 · 80 |

## Co se stalo 1.–3. 8.

- **Oblasti**: úklid a mazání ([[mazani-oblasti]]), seznam s detailem
  ([[prehled-oblasti-pohledem]]), kampaň nad více oblastmi
  ([[kampan-nad-vice-oblastmi]]), tvar u průzkumu ([[tvar-oblasti-u-pruzkumu]]).
- **Velikost firem** se konečně ukládá ze souboru ČSÚ
  ([[velikost-ze-souboru-a-slozeni]]) — nejdřív zpětně, pak i **u zdroje**
  ([[sber-neukladal-velikost]]). Tím začalo fungovat síto.
- **Kontakty** i nad oblastí ([[kontakty-i-nad-oblasti]]); rešerše agentem
  změřená ([[resurse-agentem-zmereno]]).
- **Oznámení u hodin** místo e-mailu ([[oznameni-u-hodin]]).
- **Rychlost**: chyběly indexy ([[chybejici-index-na-contacts]]), kartotéka
  se listuje ([[obrazovka-oblasti-a-listovani]]).
- **Mapa**: tažení bodů ([[tazeni-bodu-prerusoval-react]]), přiblížení na
  vybranou oblast, jídelny se počítají ([[jidelna-se-nepriradi-rucne]]).

## Aktuální focus

**Čeká se na rozhodnutí majitele o Čachrově** (viz otevřené body) a pak
na volbu dalšího celku.

## Otevřené body

Úplný seznam a priority: [[otevrene-pozadavky-majitele]]. Nejdůležitější:

- **Čachrov**: kampaň má 5 cílových firem, 68 dalších je bez známé velikosti.
  Majiteli nabídnuto je zahrnout a pustit na ně rešerši. **Nerozhodnuto.**
- **7 395 plzeňských firem bez velikosti**, z toho ~polovina skutečná s.r.o.
  ARES je nedoplní ([[ares-nedoplni-velikost]]). Jediná cesta je sbírka
  listin — **nepostavená**.
- **Jméno jednatele není adresa.** V cílovém segmentu Plzně má e-mail jen
  125 z 620. Rešerše to zvedá (19 z 20), ale stojí ~64 s na firmu.
- **Rešerše zbylých 432 plzeňských firem** ≈ 7,5 h agentní práce.
  Nerozhodnuto.

## Co znamená „hotovo"

1. `npm test` **a** `npm run typecheck` (pouští i `app/`).
2. U frontendu **proklikat v prohlížeči**. Od 3. 8. to jde: majitel se
   přihlásí v panelu Browser a dál se klika sám
   ([[zelene-testy-nejsou-hotova-obrazovka]]).
3. U migrací **nasadit** (`npm run cli -- migrate`).
4. Před tvrzením o nasazení `npm run build --prefix app`
   ([[vercel-instaluje-jen-app-zavislosti]]).

## Kde co hledat

| Co | Kde |
|---|---|
| Závazné zadání | `SPEC.md` |
| Postup pro novou oblast | `docs/NOVA-OBLAST.md` |
| Lidský popis systému | `docs/JAK-TO-FUNGUJE.md` |
| Vizuální výstupy pro majitele | `docs/vizualizace/` |
| Co je v souboru ČSÚ a co ne | `docs/vizualizace/co-mame-offline-2026-08-02.html` |
| Historie do 31. 7. | `_claude/memory/_archive/` |
