---
name: agent-jde-z-predplatneho
description: Rešerše Čmuchalem nic nestojí navíc — neblokuj ji dotazem na peníze
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 712d0c83-771e-4ec8-9ed4-091383e9c23d
  modified: 2026-08-03T12:54:17.993Z
---

Čmuchal běží jako **podagent uvnitř Claude Code**, tedy z majitelova
předplatného. Spuštění rešerše **není utrácení** a nemusí se kvůli němu
čekat na schválení.

Placená cesta je jiná: `src/enrich.ts` přes Anthropic SDK, která potřebuje
`ANTHROPIC_API_KEY`. Ten v `.env` **není a nikdy nebyl** — proto je
v přehledu 0 USD. Kdyby se někdy zapínala, to už rozhodnutí majitele je.

**Why:** 2. 8. jsem odmítl pustit zkušební rešerši s odůvodněním „byl by to
první placený běh" a čekal na svolení. Majitel musel odpovědět: „cena je ale
přeci 0, protože to je napojeno na předplatné ne?" — a měl pravdu. Zdržel
jsem práci opatrností mířenou na špatnou cestu.

**How to apply:** než něco zablokuješ kvůli penězům, **ověř, jestli to
opravdu stojí peníze**. Pravidlo „o penězích rozhoduje majitel" platí pro
placené služby, ne pro práci, kterou už předplatné pokrývá.
