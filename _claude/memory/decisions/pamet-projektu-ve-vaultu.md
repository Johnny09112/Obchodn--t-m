---
name: pamet-projektu-ve-vaultu
description: Paměť projektu se přestěhovala z memory/ do vaultu _claude/
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Kontext:** Projekt měl paměť ve složce `memory/` (stav, rozhodnutí,
poznatky — 1 806 řádků). Majitel nasadil šablonu VZOR s atomickými záznamy
a samoudržovaným indexem.

**Rozhodnutí:** vault `_claude/` je jediný zdroj pravdy; `memory/` se ruší.
Vault je **uvnitř repozitáře a commituje se** — je to týmová paměť, kolega ji
musí vidět.

**Provedení:** kurátorské, ne opisovací. 104 rozhodnutí a 49 poznatků se
nepřepisovalo jedna ku jedné — přeneseny ty, které pořád platí. **Původní
soubory leží celé v `_archive/`**, takže se nic neztratilo.

**Odchylka od runbooku:** ten v úklidu říká „smaž README.md". Protože je vault
uvnitř repozitáře, znamenalo by to smazat README projektu — neuděláno.
Runbook tím myslí README šablony, které se sem nezkopírovalo.
