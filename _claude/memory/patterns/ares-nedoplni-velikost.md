---
name: ares-nedoplni-velikost
description: Dotaz do ARESu na velikost firmy nevrátí nic navíc proti souboru ČSÚ — je to tentýž registr
type: pattern
status: active
created: 2026-08-02
updated: 2026-08-02
related: [kontakty-i-nad-oblasti]
---

**Nabízí se to samo:** v souboru ČSÚ chybí u části firem velikost (sloupec
`KATPO` = `000` nebo prázdný), tak se přece zeptáme ARESu na jednotlivá IČO.

**Nefunguje to.** Ověřeno 2. 8. na vzorku 25 plzeňských s.r.o./a.s., kterým
v souboru velikost chybí: ARES doplnil **0 z 25**. Vrací stejné „neuvedeno".

**Proč:** soubor ČSÚ *je* statistický registr (RES) a endpoint
`ekonomicke-subjekty-res` v ARESu čte tentýž registr. Není to druhý zdroj,
je to stejný zdroj jinou cestou.

**Kolik by to stálo:** 7 386 firem v Plzni × ~0,3 s = přes půl hodiny čistého
čekání za nulový výsledek. U celé republiky násobky.

**Kde velikost opravdu je**, když v registru chybí:
- **Sbírka listin** — účetní závěrky mají přesný počet zaměstnanců i obrat.
  Stažení a čtení PDF, zatím nepostavené.
- **Web firmy** — přes agenta, ale ten dnes velikost vůbec nehledá
  (není v jeho tabulce „Co hledáš").

**Ponaučení obecněji:** než se pustí dávkové dotazování kvůli chybějícímu
údaji, ověř na dvaceti kusech, že ten zdroj údaj vůbec má. Půl hodiny
zjišťování ušetřilo deset hodin běhu.
