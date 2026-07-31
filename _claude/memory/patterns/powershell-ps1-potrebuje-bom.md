---
name: powershell-ps1-potrebuje-bom
description: PowerShell 5.1 čte .ps1 jako ANSI — soubory s diakritikou potřebují UTF-8 BOM
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

Skript hlídky napsaný v UTF-8 bez BOM přečetl PowerShell 5.1 jako ANSI:
česká písmena se rozsypala a **rozbila i řetězce** — parser hlásil devět chyb
včetně chybějících závorek. Skript by spadl hned při spuštění.

**Pravidlo:** `.ps1` s diakritikou ukládat **s UTF-8 BOM**. `.cmd` a `.vbs`
se čtou jako ANSI vždycky — tam diakritiku vůbec nepoužívat.

**A hlavně:** skript, který nejde spustit z prostředí, aspoň nechat přeložit —
`[System.Management.Automation.PSParser]::Tokenize` odhalí syntaxi
i rozsypané kódování, aniž se cokoli spustí.
