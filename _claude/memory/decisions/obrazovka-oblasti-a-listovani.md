---
name: obrazovka-oblasti-a-listovani
description: Oblasti = mapa nahoře, jeden seznam pod ní ovládá vrstvy; kartotéka se listuje po stovkách
type: decision
status: active
created: 2026-08-03
updated: 2026-08-03
related: [prehled-oblasti-pohledem, chybejici-index-na-contacts]
---

Dvě kola připomínek od majitele (2. a 3. 8.), obojí o tomtéž: **nesmí být
dva seznamy téhož a nesmí se vysypat všechno naráz.**

## Pořadí na obrazovce Oblasti

**Mapa → překryv → seznam oblastí → seznam firem.**

Majitel 2. 8.: „na první pohled kompletně zmizela mapa, jsou jen oblasti.
To bych určitě otočil, abych první viděl mapu a až následně byly oblasti
a pak firmy."

Seznam firem patří k mapě (ukazuje, co je ve vybraném tvaru), takže se
seznam oblastí vkládá **dovnitř** `MapaOblasti` přes `children` — mapa se
kvůli pořadí neřeže na dvě komponenty.

## Jeden seznam, ne dva

Panel s oblastmi vpravo v mapě (`PanelVrstev`) se na obrazovce Oblasti
**nekreslí**. Jeho práci převzal seznam pod mapou: sloupec „V mapě"
se zaškrtávátkem a barvou vrstvy, plus „Zobrazit vše / Skrýt vše".

Řídí to prop `vrstvyZvenci` — když se předá, mapa vrstvy nevlastní a panel
nekreslí. **Průvodce kampaní ho má dál**, tam seznam slouží k výběru území
do kampaně a panel u mapy má svůj smysl.

Blok o překryvu se vyčlenil do `PrekryvOblasti`, aby nezmizel s panelem —
je to varování k TP-5.

## Kartotéka se listuje

Výchozích **100 řádků**, volba 25/50/100/250/všechny. Majitel 3. 8.:
„nedával bych kompletně celý seznam v kartotéce, stejně to takto nemá smysl."

Třináct tisíc řádků se vykresluje vteřiny a nikdo je nepřečte. Změna filtru
vrací na první stranu — jinak člověk kouká na prázdno, protože stojí na
patnácté straně výběru, který má dvě.

**Načítání je něco jiného než vykreslování.** Rychlost vyřešily indexy
([[chybejici-index-na-contacts]]); listování řeší jen to, co prohlížeč kreslí.

## Kliknutí v seznamu přiblíží mapu

`Mapa` má prop `zamerNa: { klic, oblast }`. Reaguje se **na klíč, ne na tvar** —
jinak by mapa uskakovala při každém posunu bodu během úpravy.
