---
name: zamykej-vyjmenovanim-zamcenych-stavu
description: Zámek psaný jako „otevřený je jen jeden stav" zamkne i pracovní stavy — vyjmenuj stavy zamčené
type: pattern
status: active
created: 2026-08-04
updated: 2026-08-04
related: [zelene-testy-nejsou-hotova-obrazovka, male-firmy-a-nezname-jde-pribrat]
---

**Past:** zámek obrazovky napsaný negací — „otevřená je jen rozpracovaná
kampaň" — vypadá bezpečněji než výčet zamčených stavů. Není.

```ts
// ŠPATNĚ: zamkne i ceka_na_pruzkum a k_posouzeni
const zamcena = kampan !== null && kampan.stav !== "rozpracovana";

// SPRÁVNĚ
const ZAMCENE_STAVY = ["schvalena", "bezi", "uzavrena", "zrusena"];
const zamcena = kampan !== null && ZAMCENE_STAVY.includes(kampan.stav);
```

`StavKampane` má sedm hodnot (`src/kampan.ts`). Kampaň se seznam firem skládá
ve stavech `rozpracovana`, `ceka_na_pruzkum` a `k_posouzeni` — tedy **ve dvou
stavech, které negace zamkla**. Kampaň nad Hrobcemi kvůli tomu přestala
nabízet 22 firem, které čekaly.

**Proč to prošlo vším:** testy to nechytly (obrazovku nepokrývají), typecheck
ani build taky ne, a **dvě revize to schválily** — druhá dokonce výslovně
ověřovala, že se nerozbilo zakládání kampaně, což se opravdu nerozbilo. Chyba
byla v zadání oprav, ne v jeho provedení; recenzenti měřili proti zadání.

Odhalilo to až proklikání v prohlížeči ([[zelene-testy-nejsou-hotova-obrazovka]]).

**Pravidlo:** u stavového automatu vyjmenuj stavy, ve kterých se **zakazuje**,
ne ten jediný, ve kterém se povoluje. Nový mezistav pak zůstane funkční —
zapomenutý výčet zákazů něco povolí navíc, zapomenutá negace utne práci.
A když zámek píšeš, projdi si **všechny** hodnoty toho typu, ne jen tu, kterou
máš zrovna na mysli.
