---
name: nowrap-v-gridu-pretece-pres-sousedy
description: Popisek s white-space: nowrap uvnitř gridové buňky nezalomí, ale přeteče přes sousední sloupec — čísla se překryjí a nic to nenahlásí
type: pattern
status: active
created: 2026-08-17
updated: 2026-08-17
related: [zelene-testy-nejsou-hotova-obrazovka, kapacita-se-upravuje-v-aplikaci]
---

**Past:** `white-space: nowrap` zabrání zalomení, ale **nezmenší** element.
V gridové buňce s `minmax(13rem, 1fr)` proto text prostě přeteče ven a
vykreslí se přes sousední sloupec. Prohlížeč nic nehlásí, konzole mlčí.

Souhrn na obrazovce Jídelny (17. 8.): buňka 269 px, obsah 330 px — „40
obědů/den" se vykreslilo přes text „Jídelen v provozu · v přípravě". Na
okně 900 px přetékaly tři údaje ze čtyř.

```css
/* ŠPATNĚ: popisek se nezalomí a vyleze ze své buňky */
.udaj > .popisek { white-space: nowrap; }

/* SPRÁVNĚ: zalomit se smí popisek, nowrap zůstává jen hodnotě (je krátká) */
.udaj > .popisek { color: var(--inkoust-slaby); }
```

**Jak to změřit, ne odhadnout** — v prohlížeči přes Playwright:

```js
[...document.querySelectorAll('.udaj')]
  .filter(u => u.scrollWidth > Math.round(u.getBoundingClientRect().width) + 1)
```

`scrollWidth > clientWidth` je důkaz přetečení. Screenshot ukáže, že to
vypadá špatně; tohle řekne o kolik a kde.

**Širší sloupce nejsou obecná oprava.** `minmax` se zvětšuje jen tam, kde
jsou popisky dlouhé (`.souhrn.siroky` na Jídelnách). Globální zvětšení na
17rem zlomilo kartotéce („Firem", „Obcí") čtyři sloupce na 3 + 1 a souhrn
narostl z 90 na 153 px — oprava jedné obrazovky rozbila druhou, která
stejnou třídu sdílí. **Než měníš sdílenou třídu, najdi si, kdo ji ještě
používá** (`.souhrn`: `Jidelny.tsx`, `SeznamFirem.tsx`).

Nechytily to testy (696 zelených) ani typecheck ani build — jen proklikání
([[zelene-testy-nejsou-hotova-obrazovka]]).
