---
name: js-hranice-slova-a-diakritika
description: \b v JavaScriptu nezná diakritiku — /\bvaší\b/ nenajde nic, protože „í" není slovní znak; použij hranice přes \p{L}
type: pattern
status: active
created: 2026-08-18
updated: 2026-08-18
related: [automaticka-uprava-textu-potrebuje-guard]
---

**Past:** `\b` v JavaScriptu je definované nad ASCII třídou `[A-Za-z0-9_]`.
České znaky s diakritikou do ní nepatří, takže hranice slova na nich
**neexistuje**:

```js
/\bvaší\b/.test("od vaší firmy")   // false — „í" není slovní znak
/\bvás\b/.test("u vás doma")       // false
/\bvám\b/.test("dáme vám")         // false
```

Kontrola vykání v `src/styl-zpravy.ts` kvůli tomu mlčela na všech tvarech
končících diakritikou (18. 8. 2026) — a přitom test na „vaší" byl napsaný
správně.

**Správně** přes Unicode vlastnost písmene a lookaround:

```js
const TVARY = /(?<!\p{L})(vy|vás|vám|váš|vaše|vaší)(?!\p{L})/gu;
```

Flag `u` je povinný, jinak `\p{L}` nefunguje.

**Kde to hrozí i jinde:** jakékoli hledání celých slov v češtině — názvy
firem („s.r.o."), obce, jména osob v adresách ([[uroven1-merena-ze-spatneho-zakladu]]
používá `includes`, takže tam problém není).

**Jak se to projeví:** kontrola nikdy nic nenajde a vypadá, že je vše
v pořádku. Test s českým slovem v obou rolích (má najít / nemá najít) to
odhalí hned.
