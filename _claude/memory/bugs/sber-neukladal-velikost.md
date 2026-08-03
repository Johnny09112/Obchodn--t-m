---
name: sber-neukladal-velikost
description: Oprava velikosti byla jen zpětná — sběr ji dál nezapisoval, takže nová kampaň měla nula firem
type: bug
status: fixed
created: 2026-08-03
updated: 2026-08-03
related: [velikost-ze-souboru-a-slozeni, ares-nedoplni-velikost]
---

**Příznak:** majitel 3. 8. založil kampaň nad Čachrovem. Průzkum doběhl,
oblast měla 91 firem — a krok 4 ukázal **nulu** s hláškou „v tomhle tvaru
zatím žádná firma není. Zkuste ho roztáhnout." To byla nepravda.

**Příčina — nedodělaná oprava.** Den předtím se našlo, že `KATPO` ze souboru
ČSÚ se čte, ale neukládá. Postavil se **jen příkaz na zpětné doplnění**
(`doplnit-velikosti`); samotný sběr (`zpracujFirmuVOblasti`) se **neopravil**.
Každý nový průzkum tedy dál zakládal firmy bez velikosti — a filtr na cílovou
velikost je všechny odřízl.

Čachrov: 91 firem, z toho 0 mikro, 0 středních, **91 bez velikosti**.
Po doplnění: 18 mikro, 5 středních, 68 bez velikosti → kampaň se naplnila 5.

**Poučení:** když se najde chybějící zápis, oprav **zdroj**, ne jen následek.
Zpětné doplnění je úklid po chybě, ne oprava chyby. Kdo opraví jen ho, chybu
si nese dál a příště ji objeví uživatel.

## Druhá vada, kterou to odhalilo

**Prázdný výsledek bez důvodu vypadá jako rozbitá aplikace.** Kampaň neřekla,
proč je prázdná — a hláška ze seznamu firem („zkuste tvar roztáhnout") radila
opak toho, co bylo potřeba.

`naplnKampanZOblasti` teď vrací `preskoceno: { mikro, bezVelikosti }` a krok 4
to vypíše: „68 firem v území zůstalo stranou, protože u nich registr neuvádí
velikost. Vzít je můžete ve druhém kroku…"

Pravidlo do budoucna: **kdykoli filtr sníží počet na nulu, musí obrazovka
říct který filtr a jak ho povolit.**
