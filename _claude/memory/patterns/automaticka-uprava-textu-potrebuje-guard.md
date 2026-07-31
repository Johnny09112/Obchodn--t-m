---
name: automaticka-uprava-textu-potrebuje-guard
description: Skript, který jen vypíše hotovo, nic nedokazuje — hlídej každou náhradu zvlášť
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

Třikrát za jednu session se stalo, že skript na doplnění importů se netrefil
do vzoru, `replace` tiše vrátil původní text a skript přesto vypsal „hotovo".
Podruhé to bylo horší: guard porovnával **celý soubor**, takže jedna povedená
náhrada zamaskovala druhou nepovedenou.

**Pravidlo:** u automatické úpravy textu porovnat před a po **u každé náhrady
zvlášť** a při neshodě skončit chybou:

    for (const [a, b] of zmeny) {
      if (!s.includes(a)) { console.log("POZOR nenalezeno: " + a); process.exit(1); }
      s = s.split(a).join(b);
    }

A pozor na zpětné uvozovky a lomítka v `node -e` uvnitř bashe — shell je
spolkne a do souboru se dostane rozsypaný text. Delší skript psát do souboru,
ne do příkazové řádky.
