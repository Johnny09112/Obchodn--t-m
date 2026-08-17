---
name: detail-firmy-ma-porad-sekci
description: Detail firmy má pevné pořadí sekcí od oboru po chybějící údaje a ukazuje pět nejbližších jídelen do 50 km
type: decision
status: active
created: 2026-08-17
updated: 2026-08-17
related: [dve-vrstvy-znalost-a-zprava, dosah-je-tabulka-ne-sloupec, spojeni-neni-pocet-kontaktu]
---

**Odsouhlasil majitel 17. 8. 2026** podle návrhu nanečisto
(`docs/vizualizace/navrh-detail-firmy-2026-08-17.html`).

**Pořadí sekcí je závazné**, protože kopíruje pořadí otázek, které si majitel
klade: čím se firma zabývá → co rozhoduje o oslovení (stravování, směny,
vlastní jídelna) → jídelny v okolí → kudy se ozvat → odkud to víme → co ještě
nevíme. Dřív ležela všechna evidence v jedné řadě, kde obor podnikání vážil
stejně jako záznam o geokódování.

**Jídelny v okolí:** pět nejbližších do 50 km, s vzdáleností, stavem
(v provozu / příprava) a příznakem „v zóně“. Počítá se v prohlížeči nad pěti
jídelnami, které aplikace stejně načítá — dotaz navíc není potřeba
(`src/nejblizsi-jidelny.ts`).

**Tři prázdné stavy se nesmí slít do jednoho** — každý znamená něco jiného:

| Co se stalo | Co obrazovka řekne |
|---|---|
| firma nemá souřadnice | „Vzdálenost spočítat nejde — neznáme polohu.“ |
| jídelny jsou, ale daleko | „V okolí 50 km není žádná jídelna.“ (73 firem) |
| rešerše neproběhla | „Rešerše u téhle firmy ještě neproběhla.“ |

**Technické záznamy nejsou údaje o firmě.** Atribut `adresa` drží souřadnice
z geokódování (všech 167 zápisů), ne adresu — v detailu je označený jako
„naše práce, ne údaj o firmě“ a nemíchá se mezi zjištěné údaje.
