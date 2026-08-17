---
name: project-context
description: Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus
type: context
status: active
created: 2026-08-01
updated: 2026-08-17
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
| Testy | **696 zelených, 76 souborů** (k 17. 8.) |
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

## Milník 13. 8. — rešerše dokončená na všech kvalifikovaných firmách

**V kartotéce není jediná kvalifikovaná firma bez rešerše.** Za den prošlo
zhruba 230 firem ve dvanácti dávkách.

| Údaj | Hodnota |
|---|---|
| Firem s popisem oboru vlastními slovy | **214** |
| Firem s uloženým webem | **156** |
| Firem se spojením | **356** |
| Záznamů v evidenci | 7 946 |
| Obchodních signálů | 12 |
| Kvalifikovaných bez rešerše | **0** |

Nová kampaň **Bezdružice** (`a5658560`) nad územím „Průzkum Bezdružice" —
založena 13. 8., aby šly dobrat zbylé firmy z prvního ostrého běhu. Většinu
tvoří fyzické osoby a mikropodniky; majitel je přidal vědomě.

### Čtyři chyby odhalené a opravené během toho dne

1. **Firma bez razítka se vracela do fronty donekonečna** — razítko se
   nastavovalo jen při nálezu, takže firmu, kterou agent tiše vynechal,
   nikdo neoznačil. Řeší `reserse_pokusu` (migrace 0042, tři pokusy)
   — [[firma-bez-razitka-se-vraci-navzdy]].
2. **Rešerše jezdila na firmy mimo dosah jídelny.** Výběr nekoukal na stav;
   v jedné kampani stálo 216 čekajících proti sedmi kvalifikovaným. Filtr je
   psaný jako výčet **zakázaných** stavů.
3. **Výběr firem byl na dvou místech a rozešel se** — `firmyProReserse`
   a `firmyKObohaceni`. Filtr přidaný jen do prvního způsobil, že agent
   dostával jiné firmy, než kterým se počítaly pokusy. Duplicita zrušena:
   `firmyKObohaceni` dostává hotový seznam IČO. **Komentář v kódu tuhle
   chybu předpovídal** — napsala ho revize předchozího celku.
4. **`spojeni` se agentovi nabízelo jako atribut** a kontrola ho odmítala.
   Opraveno zadání, ne pojistka.

### Ostrá dávka 7. 8. — mechanismus funguje, výtěžnost ne

Kampaň Hrobce, 20 firem objednaných z aplikace, **18 zpracovaných**.
Výpis běhu: `profil cantinero` — profil se do rešerše propsal.

| Co | Výsledek |
|---|---|
| Nálezů atributů | **1** (`ucel_adresy`, se zdrojem i doslovnou citací) |
| Kontaktů | 15, spojení přibylo u 13 firem |
| Odmítnuto | 0 |
| **`smenny_provoz`** | **0 z 18** |

**Mechanismus je ověřený na skutečných datech.** `k-obohaceni` prokazatelně
předává `smenny_provoz` agentovi v poli `chybi` **i s popisem, kde ho
hledat** — a ten atribut se do systému dostal **jen migrací 0037, bez
jediného řádku kódu**. To byl cíl celé práce a ten je splněný.

**Výtěžnost je nula a je to zpráva o datech, ne o kódu.** Hrobce jsou
mikropodniky a obce — kariérní stránky ani inzeráty nemají, takže směny
není odkud vzít. Zadání (kap. 2) na tuhle sázku předem upozorňovalo:
na dva „zajímavé" atributy připadaly ze 7 256 záznamů evidence tři.
**Majitel to ví.** Poctivý test výtěžnosti by chtěl území s výrobou
a většími firmami, ne Hrobce.

**Otevřené vědomě:** `zapisDavku` profil kampaně nekontroluje — je to rada
v promptu, ne kontrola v kódu. Mezera v plánu, ne v provedení; podrobnosti
v [[dva-profily-sber-a-reserse]].

## Přepočet dosahu (13. 8.) a co z něj vyplynulo

**Poslední akce 13. 8.:** proběhl `npm run cli -- dosah` (přepočet dosahu
jídelen).

**Co ukázal:**

| Jídelna | Firem v zóně | Z toho čeká na jídelnu | Cílových (25+) |
|---|---|---|---|
| **34. ZŠ Plzeň, Gerská** | **2 301** | **2 301** | **59** |
| ZŠ a MŠ Tlučná | 316 | 255 | 26 |
| ZŠ a MŠ Hrádek | 139 | 99 | 5 |
| ZŠ Zbůch | 136 | 94 | 21 |
| ZŠ, MŠ a ZUŠ Bezdružice | 22 | 0 | 4 |

Celkem **2 914 firem v dosahu, z toho 115 cílových**. Kvalifikovaných je
dnes 165 — tedy zhruba 20 v cílovém segmentu.

**Podstatné zjištění:** těch 2 301 plzeňských firem je ve stavu
`cekajici_na_jidelnu`, přestože jídelnu v dosahu **mají**. Sběr je založil
dřív, než jídelna vznikla, a přepočet dosahu **stav firmy nemění**
([[dosah-je-tabulka-ne-sloupec]]). Kdyby se překvalifikovaly, cílový
segment vyroste ze zhruba 20 na **115 firem — pětinásobek**.

**Ale volná kapacita je pořád 70 obědů** (Tlučná 20, Zbůch 20, Hrádek 20,
Bezdružice 10) a **u 34. ZŠ Plzeň není vyplněná vůbec** (`NULL`). Jde tedy
odemknout pětkrát víc firem, ale není jim co nabídnout.

### Obě otázky zodpovězeny 17. 8. 2026

1. **Kapacita 34. ZŠ Plzeň = 50 obědů/den.** Volná kapacita celkem tím roste
   ze 70 na **120 obědů/den**.
2. **Překvalifikace 2 301 plzeňských firem se NEDĚLÁ.** Rozhodnutí majitele:
   počkat. Stavy v ostré databázi zůstávají, jak jsou.

**Proč to dává smysl i po doplnění kapacity:** prodat jde dnes **80 obědů
denně** (Tlučná a Zbůch jsou od 17. 8. v přípravě, jejich 40 obědů je
potenciál). To je zhruba na dvě až tři firmy. Odemknout 115 cílových firem
proti téhle kapacitě by znamenalo nafouknout frontu, na kterou nemáme
odpověď. Překvalifikace je technicky triviální — čeká na kapacitu, ne na kód.

**Postaveno 17. 8.:** obrazovka **Jídelny** — kapacita jde konečně měnit
v aplikaci (dřív jedině při zakládání jídelny příkazem). Ukazuje počty firem
v dosahu a **rozlišuje jídelnu v provozu od jídelny v přípravě**, takže volná
kapacita se dělí na „co jde prodat dnes" a „potenciál" (migrace 0044,
nasazená). Podrobnosti: [[kapacita-se-upravuje-v-aplikaci]].

**Stav jídelen k 17. 8. (ostrá databáze):**

| Jídelna | Kapacita | Stav |
|---|---|---|
| 34. ZŠ Plzeň, Gerská | 50 | v provozu |
| ZŠ a MŠ Hrádek | 20 | v provozu |
| ZŠ, MŠ a ZUŠ Bezdružice | 10 | v provozu |
| ZŠ a MŠ Tlučná | 20 | **příprava** |
| ZŠ Zbůch | 20 | **příprava** |

**Prodat jde 80 obědů/den, dalších 40 je v přípravě.** Proti 165
kvalifikovaným firmám. Tlučnou a Zbůch přepnul majitel 17. 8.

**Obrazovka proklikaná v prohlížeči (17. 8., Playwright MCP).** Čísla i stavy
sedí s ostrou databází, editace kapacity se otevře a zruší bez zápisu. Našla
se přitom jedna vada vzhledu — popisky v souhrnu se překrývaly s čísly;
opraveno a nasazeno ([[nowrap-v-gridu-pretece-pres-sousedy]]).

## Aktuální focus

**Fáze 1 je hotová a rešerše doběhla na všech kvalifikovaných firmách.**
Obrazovka „Co je nového" (obchodní podněty) je postavená a používá se.

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
