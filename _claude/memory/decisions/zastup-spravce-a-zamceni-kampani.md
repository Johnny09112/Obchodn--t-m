---
name: zastup-spravce-a-zamceni-kampani
description: Kampaň upravuje správce, jeho zástup a admin; mazat smí jen admin
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Kontext:** Majitel chtěl zástup pro případ nemoci. Při ověření se ukázalo,
že do každé kampaně směl **kdokoli přihlášený** a sloupec `spravce` byl jen
informativní cedulka — zástup by neměl koho zastupovat.

**Rozhodnutí:** správcem je zakladatel kampaně (vynucuje databáze). Upravovat
smí správce, zástup a admin. Schvalovat dál jen admin a výš. **Mazat smí jen
admin**, ostatní archivují.

**Důvod:** vyhrazení mazání adminovi nahradilo potvrzovací e-mail, který
majitel chtěl, ale TP-8 ho nedovolí. Věcně je to silnější — e-mail by dorazil
až potom, co jsou data pryč.

**Důsledek:** zamčený je i seznam firem kampaně a objednávky průzkumu; jinak
by to byl zámek na dveřích vedle otevřeného okna. Ověřeno naostro: role
uživatel cizí kampaň neupraví (0 řádků), kampaň se zástupem ano (1 řádek).
