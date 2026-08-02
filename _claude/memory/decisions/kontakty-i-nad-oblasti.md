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

**Cena běhu:** MPSV je zdarma (index se stáhne jednou) a dá i telefon a e-mail;
teprve když tam firma není, dotahuje se jednatel z rejstříku — 300 ms na firmu.
Pro 13 600 firem ≈ 1,5 hodiny. Proto `--limit` a dávky.

**Stav k 2. 8.:** kód hotový a otestovaný, **naostro zatím nespuštěno** —
čeká se na majitelovo rozhodnutí, jak velkou dávku pustit.
