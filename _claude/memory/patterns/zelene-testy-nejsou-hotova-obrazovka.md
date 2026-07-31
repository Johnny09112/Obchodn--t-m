---
name: zelene-testy-nejsou-hotova-obrazovka
description: Testy a typy nechytí vady toku a pořadí — frontend se musí proklikat
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

Etapu B jsem prohlásil za hotovou s 381 zelenými testy a čistou kontrolou typů.
Majitel při prvním proklikání našel do pěti minut: nenasazené migrace,
neukládající se území, chybějící cestu k úpravě kampaně, rozhodovací tlačítko
až pod tabulkou 41 firem, a několik vad vzhledu.

**Žádnou z nich nemohl chytit test ani typ.** Byly to vady toku a pořadí,
ne logiky.

**Pravidla:**
- Do předávky patří „co je **nasazené**", ne jen „co je otestované".
  Migrace v ostré databázi jsou součást hotového.
- Než prohlásím frontend za hotový, projít celou cestou, kterou půjde člověk.
  Kde nemám heslo, říct to výslovně jako mezeru, ne jako splněnou položku.
- U vloženého celku (mapa, seznam) ověřit, kam se posune to, co je pod ním —
  sdílená součástka si nese vlastní výšku.
