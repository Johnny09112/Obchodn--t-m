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
| Z toho se spojením | **104** |
| Vyřazených kandidátů, s důvodem | 4 044 |
| Oblasti · kampaně · průzkumy | 8 · 4 · 2 (oba hotové) |
| Běhů agenta | 15 |
| Náklady na API | **0 USD** — placené nikdy neběželo |
| Migrace | po `0027_pruzkum_urgentni.sql`, nasazeno |
| Testy | 416 zelených, 45 souborů |
| Odesílání | **vypnuté**, a žádný kód ho neumí zapnout |

Aplikace běží na `https://cantinero-find.vercel.app`, staví se z `main`.

**Poslední milník (31. 7.):** průvodce kampaní je celý — etapy A (návrh),
B (založení a území), B+ (hlídka Čmuchala), C (průzkum a seznam firem).
K tomu archivace a mazání kampaní, zámek úprav a provozní deník (obrazovka
Provoz, jen admin). Ověřeno celým řetězcem naostro: aplikace objednala
průzkum → hlídka ho vzala → Čmuchal sebral 13 600 firem → kampaň se naplnila.

## Aktuální focus

**Oblasti: úklid (mazání nepoužitých), seznam s detailem, kampaň nad více
oblastmi.** Podrobně i s pastí u `pruzkumy.oblast_id` viz
[[otevrene-pozadavky-majitele]].

Před tím nebo vedle: uložit tvar oblasti k průzkumu (odsouhlaseno,
nepostaveno) a odpověď majitele na oznámení Windows místo e-mailu.

## Otevřené body

Úplný seznam je v [[otevrene-pozadavky-majitele]]. Nejdůležitější:

- **`pruzkumy.oblast_id` je `on delete cascade`** — smazání oblasti by smazalo
  i záznam průzkumu. Srovnat na `restrict` dřív, než se mazání povolí.
- Majitel neodpověděl na nabídku oznámení Windows místo e-mailu.
- Asymetrie: sběr kolem jídelny zapisuje kontakty z MPSV, sběr nad oblastí ne
  — proto má 13 767 firem jen 104 spojení.

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
