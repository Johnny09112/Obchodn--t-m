---
name: hlidka-cmuchala-u-majitele
description: Naplánovaný běh Čmuchala je ikona u hodin na majitelově počítači
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Kontext:** Aplikace agenta spustit nesmí, ale krok 3 průvodce by jinak čekal
na člověka s příkazovou řádkou, kterého kolega nemá.

**Rozhodnutí:** hlídka běží **u majitele na počítači** jako ikona
u hodin (`skripty/Cmuchal.vbs` → `cmuchal-hlidka.ps1`). Řádné běhy 8:00,
13:00 a 19:00; urgentní objednávky každých 10 minut.

**Důvod:** Čmuchal potřebuje 521 MB registru ČSÚ, který je jen na majitelově
disku. Server by znamenal ten soubor někam dostávat a udržovat — a stál by
peníze. Správce úloh majitel odmítl: není vidět a nedá se z něj poznat, jestli
něco běží.

**Cena:** běží, jen když je počítač zapnutý.

**Souvisí:** zámek `zamky` hlídá jeden běh naráz — `vyridPruzkum` si
vyzvedává i rozdělané úseky, takže dva souběžné běhy by si braly práci.
