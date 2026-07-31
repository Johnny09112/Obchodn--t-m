---
name: sito-mezi-oblasti-a-kampani
description: Síto koho neoslovovat sedí na hranici oblast → kampaň, ne v přepočtu oblasti
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Kontext:** Seznam firem v oblasti se plní **podle geometrie, bez ptaní** —
a to hned ze tří míst (přepočet v jádru, sběr Čmuchala, kreslení v aplikaci).
Cesta do kampaně z něj kopírovala všechno, takže kampaň nabídla i firmu
z blacklistu nebo školu, která se stala partnerskou jídelnou až potom.

**Rozhodnutí:** síto (`duvodNeoslovovat` v `src/sito.ts`) je na hranici mezi
„kde firma je" a „koho oslovíme". `oblast_firmy` zůstává čistě geometrická.

**Důvod:** na hranici pokryje všechny tři cesty naráz. Kdyby ho ovlivňoval
blacklist, měnil by se počet firem na mapě podle věcí, které s mapou nesouvisí.

**Vyřazuje:** blacklist, partnerská jídelna, bytový dům, doložená vlastní
jídelna. **Obor podle profilu schválně ne** — firma posbíraná za starého
profilu by po přepnutí z kampaně tiše zmizela.

**Důsledek:** vynechané firmy se vracejí i s důvodem a ukazují se. Tiché
filtrování je horší než žádné.
