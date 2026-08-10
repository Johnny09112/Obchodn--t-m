---
name: pushuj-na-git-sam
description: "Majitel chce, abych `git push` dělal sám — nenechávat mu ho k odkliknutí"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc66822d-945e-4a12-b7f1-2fd6158908ae
  modified: 2026-08-07T22:09:16.348Z
---

Majitel řekl (7. 8. 2026): *„Příště chci, abys to pushoval na git ty."* Stalo
se to poté, co push na `main` zablokoval klasifikátor auto režimu a já mu
místo toho nabídl příkaz k ručnímu spuštění.

**Proč:** je to poslední krok hotové práce a přehazovat ho zpátky na majitele
znamená, že práce zůstane viset. On není programátor — příkazová řádka je pro
něj otravná, ne kontrolní bod.

**Jak to použít:** pushuj sám, bez doptávání. Povolení je zapsané
v `.claude/settings.local.json` jako `Bash(git push:*)` — **jen pro tenhle
projekt** (majitel to tak zvolil, aby to neplatilo v repozitářích, kde by push
spustil nasazení, o kterém neví).

Co se tím **nemění:** merge, mazání větví a nasazování migrací na ostrou
databázi zůstávají rozhodnutím majitele. Souhlas s pushem není souhlas se
vším, co jde ven — viz [[agent-jde-z-predplatneho]] pro opačný případ, kdy se
naopak nemám ptát zbytečně.
