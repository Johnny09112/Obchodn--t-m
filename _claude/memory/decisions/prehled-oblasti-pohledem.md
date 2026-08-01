---
name: prehled-oblasti-pohledem
description: Seznam oblastí čte databázový pohled oblasti_prehled, ne dopočet v prohlížeči
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: [mazani-oblasti, postgrest-strop-na-radky]
---

**Kontext:** Majitel chtěl seznam oblastí s detailem místo klikání do mapy —
kdy naposled prozkoumaná, kolik firem, v jakých kampaních figuruje.

**Rozhodnutí (migrace 0029):** počty a kampaně počítá databáze v pohledu
`oblasti_prehled`, jedním dotazem pro všechny oblasti.

**Důvod:** počet firem v oblasti jsou desetitisíce řádků (Plzeň 12 762).
Stáhnout je do prohlížeče kvůli jednomu číslu nejde ([[postgrest-strop-na-radky]])
a ptát se na každou oblast zvlášť je N+1.

**`security_invoker = on` je podstatné.** Bez něj pohled běží právy vlastníka
a obejde pravidla přístupu na tabulkách pod sebou. S ním platí pořád stejná
pravidla, i až se změní.

**Mazání se přestěhovalo do seznamu** (z panelu mapy, kde vzniklo o pár hodin
dřív). Dvě místa na totéž mate; seznam je navíc to místo, kde se úklid dělá.
Panel mapy je na kreslení.

**`vybranaId` u `MapaOblasti` už není jen počáteční.** Mapa ji poslechne,
kdykoli se změní — tak ji otevírá seznam. Zacyklit to nemůže: když se hodnota
shoduje s otevřenou oblastí, efekt nic neudělá, a kliknutí do mapy se vrací
stejnou hodnotou.

**Hledá se bez diakritiky** — `porovnatelne()` ze `sito.ts`, ta samá funkce,
kterou používají pravidla blacklistu. Kdo píše „zapadni cechy", myslí
„Západní čechy".
