---
name: project-context
description: Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus
type: context
status: active
created: 2026-08-01
updated: 2026-08-07
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

## Co se stalo 6. 8.

**AI průzkum se objednává tlačítkem a vyřídí se sám.** Objednávka jde do
fronty (`reserse`, migrace 0034), hlídka u hodin ji v řádném běhu vyzvedne
a spustí Čmuchala neinteraktivně. Poslední místo, kde byl majitel závislý
na tom, že někdo píše do chatu.

**Práce se předává soubory, ne příkazy.** Původní návrh nechával agenta vzít
si ji přes `k-obohaceni` — při první ostré dávce mu Bash zamítlo oprávnění
a dávka doběhla s nulou. Nálezy zapisuje obsluha přes `zapisDavku`, takže
agent nepotřebuje shell vůbec.

**Ověřeno naostro na Hrobcích:** 5 z 5 firem, 6 nových kontaktů, spojení
přibylo u 4, jedna bez nálezu. U všech doložený zdroj i doslovná citace.

Cestou opraveno: „se spojením" počítalo firmy, kterým napsat nejde (a o to
číslo se opírá schvalování kampaně); úrovně adres se hlásily pootočené proti
TP-6 ([[pootocene-urovne-adres]]); tajemství se přesunulo mimo pracovní
složku ([[tajemstvi-mimo-pracovni-slozku]]).

SPEC kap. 5 rozdělena na dvě vrstvy ([[dve-vrstvy-znalost-a-zprava]]).

## Profil produktu (7. 8.) — hotovo v kódu, migrace nasazené

**Větev `profil-produktu`, pět úkolů odpracovaných subagentně. Nezmergováno.**

**Co to dělá:** pevný seznam povolených atributů se přesunul z kódu do
tabulky `atributy` s příznaky `do_zpravy` (smí do zprávy) a `hleda_agent`
(hledá Čmuchal). Profil vybírá, co se o firmě zjišťuje; kampaň si nese svůj
profil (`kampane.profil_kod`, `NULL` = globálně aktivní). **TP-3 se tím
rozdělil** — whitelist váže zprávu, sběr určuje profil.

TP-3 po přesunu drží **dvěma nezávislými vrstvami**: běhovou kontrolou
v `zapisAtribut` a cizím klíčem `evidence_atribut_fk`. Do `evidence` navíc
zapisuje v produkčním kódu jedině `src/repo.ts` a tabulka má RLS **bez
jediné politiky**, takže přes datové API se do ní nedostane nikdo.

**Migrace 0035, 0036 a 0037 nasazené 7. 8.** Kontrola před i po: evidence
beze změny na 7 256 řádcích, žádná hodnota `atribut` mimo rejstřík, stará
podmínka `check` zrušená a nahrazená cizím klíčem, RLS zapnuté.

- Zadání: `docs/superpowers/specs/2026-08-07-profil-produktu-design.md`
- Plán: `docs/superpowers/plans/2026-08-07-profil-produktu.md`
- Ledger celého běhu: `.superpowers/sdd/2026-08-07-profil-produktu/progress.md`
- Pasti, které to odhalilo: [[tri-kopie-seznamu-atributu]],
  [[dva-profily-sber-a-reserse]]

**Co zbývá k „hotovo" podle zadání kap. 8: ostrá dávka na Hrobcích s novým
atributem `smenny_provoz`** — ověřit, že se dohledal aspoň u jedné firmy
a **má citaci**, nebo že se nedohledal a majitel to ví.

**Varování, které majitel zná a přijal:** na dva „zajímavé" atributy
(`ma_vlastni_jidelnu`, `zpusob_stravovani`) připadají ze 7 256 záznamů
evidence celkem tři. Mechanismus stojí nad něčím, co se prakticky nikdy
nepodařilo dohledat. Proto „hotovo" znamená ostrou dávku, ne zelené testy.

**Otevřené vědomě:** `zapisDavku` profil kampaně nekontroluje — je to rada
v promptu, ne kontrola v kódu. Mezera v plánu, ne v provedení; podrobnosti
v [[dva-profily-sber-a-reserse]].

## Aktuální focus

**Fáze 1 je z pohledu majitele hotová** — sběr, přibírání firem i AI průzkum
si objedná sám v aplikaci. Čeká se na volbu dalšího celku.

Dva otevřené body z 6. 8., které stojí za pozornost:

- **Heslo k databázi se má změnit.** Při ověřování bezpečnosti jsem nechal
  agenta přečíst `.env`; obsah prošel jeho kontextem.
- **Schválený seznam firem není v databázi zamčený** — drží to jen obrazovka.
  Viz [[otevrene-pozadavky-majitele]] bod A4.

## Co se stalo 4. 8.

**Dodatečné přibírání firem do kampaně** ([[male-firmy-a-nezname-jde-pribrat]]).
U seznamu firem je trvalý panel, který při každém otevření ukáže, co v území
čeká, a nabídne to dvěma tlačítky — firmy bez známé velikosti a firmy do 24
zaměstnanců zvlášť. Čísla se dopočítávají z dat, takže nemůžou zastarat.

Cestou se ukázalo, že **aplikace zahazovala mikropodniky**, ačkoli SPEC kap.
10.2 je zná jako plnohodnotný segment. Pravidlo „mikro se neberou nikdy"
v SPEC nikde nebylo. Společenství vlastníků se nepřibírají — drží je síto.

Ověřeno naostro na Čachrovu: 5 → 23 → **91 firem**, mezi 18 malými ani jedno
společenství. Kampaň Hrobce má dalších 22 malých firem, které čekají.

Past objevená až proklikáním: [[zamykej-vyjmenovanim-zamcenych-stavu]].

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
