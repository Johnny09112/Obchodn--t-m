---
name: spojeni-neni-pocet-kontaktu
description: „Spojení" znamená kontakt s e-mailem nebo telefonem — počet kontaktů je jiné číslo a smíchat je znamená protimluv na jedné obrazovce
type: pattern
status: active
created: 2026-08-17
updated: 2026-08-17
related: [zelene-testy-nejsou-hotova-obrazovka, jsonb-se-serializuje-dvakrat]
---

**Dvě různá čísla, jedno slovo:**

- **kontakt** — evidovaná osoba u firmy. Jednatel z rejstříku je kontakt,
  i když u něj není adresa ani telefon.
- **spojení** — kontakt, přes který jde firmu **oslovit** (`email` nebo
  `telefon` není NULL). To je `maSpojeni` / `pocetSpojeni` v `app/src/data.ts`
  a `pocetSeSpojenim` v jádře (`src/reserse.ts`).

**Past:** kartotéka ukazovala ve sloupci „Spojení" `contacts.length`, takže
u firmy stálo „spojení: 2“ a filtr „chybí kontakt“ ji zároveň vracel —
protimluv na jedné obrazovce. Typický případ: Lidl E-Commerce Logistics
má dva jednatele z rejstříku, u obou „jen jméno, adresa ani telefon nejsou“.

Je to **druhý výskyt téhož omylu**: 6. 8. se stejně chybně počítalo „se
spojením“ v přehledu, o které se opírá schvalování kampaně.

**Pravidlo:** kdykoli se v kódu nebo na obrazovce objeví slovo „spojení“,
musí za ním být filtr na e-mail/telefon. Počet osob je „kontaktů“, ne
„spojení“ — a do rozhodování o oslovení nepatří.
