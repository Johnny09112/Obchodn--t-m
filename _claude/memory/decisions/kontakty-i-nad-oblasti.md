---
name: kontakty-i-nad-oblasti
description: Doplňování kontaktů umí i firmy bez jídelny — sběr nad oblastí je zakládá mimo zónu
type: decision
status: active
created: 2026-08-02
updated: 2026-08-02
related: [prehled-oblasti-pohledem]
---

**Kontext:** Kartotéka měla 13 767 firem, ale jen 104 spojení. Vypadalo to jako
slabý zdroj kontaktů; ve skutečnosti šlo o **výběr, který se k nim nedostal**.

Čísla z ostré databáze (2. 8.):

| Odkud firmy jsou | Firem | S kontaktem |
|---|---:|---:|
| sběr kolem jídelny | 165 | 104 |
| sběr nad oblastí | 13 600 | **0** |

**Příčina:** `doplnKontakty` se ptalo na `c.v_zone is true and c.stav =
'kvalifikovany'`. Sběr nad oblastí ale zakládá firmy **bez jídelny, bez zóny**
a ve stavu `cekajici_na_jidelnu` — oblast smí vzniknout dřív než jídelna, to je
celý smysl obráceného postupu. Ten filtr je tedy nikdy nemohl najít.

**Rozhodnutí:** `doplnKontakty` má druhý rozsah — `oblastId`. Bere firmy
z `oblast_firmy` dané oblasti, **bez ohledu na zónu**, vynechá jen `zamitnuty`.
V příkazové řádce `doplnit-kontakty --oblast <id>`.

**Výchozí chování se schválně nemění.** Běh bez omezení by se pustil do celé
kartotéky a to je při 300 ms na dotaz do ARESu přes hodinu.

## Změřeno na ostré dávce (2. 8., 200 firem z Plzně)

| Údaj | Hodnota |
|---|---|
| Zpracováno | 200 firem s nejvyšším skóre |
| Kontakt z MPSV (i e-mail a telefon) | 32 |
| Jednatel z rejstříku (jen jméno) | 164 |
| Bez výsledku | 4 |
| **Trvání** | **576 s ≈ 2,9 s na firmu** |

**Odhad 300 ms na firmu byl špatný o řád.** Skutečné tempo je ~2,9 s
(ARES dělá na firmu víc než jeden dotaz plus latence), takže celá Plzeň
(12 667 firem) je **zhruba 10 hodin**, ne 1,5. Kdo bude plánovat další
dávky, ať počítá s tímhle číslem.

**Důsledek pro postup:** doplňovat kontakty plošně nad celou oblastí je drahé
a většinou zbytečné — potřeba jsou u firem, které jsou **v kampani**
(532 firem ≈ 25 min). Rozsah „podle kampaně" zatím **není postavený**;
nabídnuto majiteli 2. 8.

**Užitečnost kontaktu:** ze 300 firem se spojením má e-mail jen **50**.
Zbytek je jméno jednatele z rejstříku — pro fázi 3 se na něj nedá napsat.
Bez dalšího zdroje e-mailů je to poloviční výsledek.
