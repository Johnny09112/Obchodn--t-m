---
name: otevrene-pozadavky-majitele
description: Co majitel vyžádal nebo co čeká na jeho rozhodnutí, k 3. 8. 2026
type: research
status: active
created: 2026-08-01
updated: 2026-08-03
---

Seřazeno podle toho, co blokuje postup.

## A. Čeká na rozhodnutí majitele

1. ~~**Čachrov — vzít i firmy bez známé velikosti?**~~ **Vyřešeno 4. 8.** —
   majitel je přibral sám v aplikaci, kampaň má 91 firem
   ([[male-firmy-a-nezname-jde-pribrat]]). Rešerše na ně zatím neběžela.
2. **Rešerše zbylých 432 plzeňských firem** (~7,5 h agentní práce, jde
   z předplatného). Doporučeno napřed 100 firem, ať se ověří, že úspěšnost
   drží i mimo nejlepší skóre ([[resurse-agentem-zmereno]]).
3. **Strop řádků v Supabase.** Zvednut na 20 000 přes roli `authenticator`;
   **trvalejší místo je Settings → API → Max rows** v dashboardu. Kdyby
   platforma roli přepsala, strop spadne zpět na tisíc (aplikace to přežije,
   jen zpomalí) — viz [[postgrest-strop-na-radky]].

4. **Schválený seznam firem není v databázi zamčený.** Schvalovací dialog
   slibuje „seznam se uzamkne a nepůjde do něj přidávat", ale pravidlo zápisu
   `kampan_firmy_zapis` stojí na `smi_do_kampane`, a ta se ptá **jen kdo** —
   správce, zástup, admin. Stav kampaně nekontroluje. Od 4. 8. to drží
   obrazovka ([[zamykej-vyjmenovanim-zamcenych-stavu]]), ale tvrdá pravidla
   patří do databáze. Náprava = migrace + nasazení. **Nerozhodnuto.**

## B. Postavit, až se rozhodne výš

1. **Sbírka listin — přesný počet zaměstnanců.** Jediný zdroj velikosti pro
   7 395 plzeňských firem, které registr nepokrývá ([[ares-nedoplni-velikost]]).
   Znamená stahovat a číst PDF účetních závěrek.
2. **Další zdroj e-mailů.** Jméno jednatele z rejstříku není adresa; bez
   e-mailu se ve fázi 3 nedá oslovit. Věcné i právní rozhodnutí, ne technické.
3. **Doplňování kontaktů podle kampaně** (`--kampan <id>`), ne jen podle
   oblasti. Malá věc, ale šetří práci.

## C. Vlastní vývoj, nezahájené

1. **Etapa D průvodce** — nezávislá kritika obrazovek, přístupnost
   (klávesnice, kontrast).
2. **Stránkování seznamu firem v kampani.** Kartotéka se od 3. 8. listuje
   ([[obrazovka-oblasti-a-listovani]]); seznam v kampani zatím ne — u kampaně
   nad krajem to bude potřeba.
3. **Přiřazení jídelny/bodu ke konkrétní firmě** pro obchodní use-case.
   **Není to totéž co jídelna oblasti** ([[jidelna-se-nepriradi-rucne]]).

## D. Čeká na majitele (starší, neuzavřené)

- Licence otevřených dat ČSÚ — právní věc před ostrým provozem.
- Rozhodnutí o SVJ a živnostnících v kartotéce.
- Návrh Čmuchala: registry zadávacích řízení u mikrofirem bez webu.
- Kapacity jídelen ve Zbůchu, Tlučné a Hrádku.

## Hotové (pro pořádek, ať se nezadává znovu)

Úklid oblastí · seznam oblastí s detailem · kampaň nad více oblastmi · tvar
oblasti u průzkumu · oznámení u hodin · velikost firem ze souboru · složení
území v proužku · kontakty nad oblastí · zrychlení (indexy, stránkování) ·
tažení bodů v mapě · přiblížení na vybranou oblast.
