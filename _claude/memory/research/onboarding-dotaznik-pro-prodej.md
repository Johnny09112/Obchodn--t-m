---
name: onboarding-dotaznik-pro-prodej
description: Při prodeji systému jinému podniku si musí agent nejdřív sám vyptat, čím zákazník podniká — jinak neví, co má psát do šablon
type: research
status: navrzeno
created: 2026-08-18
updated: 2026-08-18
related: [odesilaci-domena-a-adresa, produkt-neni-vazany-na-obor, cena-v-osloveni]
---

**Nápad majitele 18. 8. 2026** („jen tak bokem", neimplementuje se teď).

**Pozorování:** knihovnu tvrzení a tři šablony jsme sestavili tak, že majitel
popsal službu vlastními slovy a agent z toho vytáhl, co je doložitelné.
**U cizího zákazníka tenhle rozhovor nikdo nepovede.** Systém proto musí umět
udělat totéž sám: vyptat se na podnikání, pochopit ho a z odpovědí navrhnout
tvrzení i šablony.

**Souvisí s [[odesilaci-domena-a-adresa]]:** tam padlo, že odesílací doména
musí být nastavení, ne konstanta. Tohle je táž myšlenka o úroveň výš —
**celý obsah oslovení je nastavení zákazníka**, ne konstanta systému.

## Co by onboarding musel zjistit

Odvozeno z toho, co bylo doopravdy potřeba u obědů:

1. **Čím se podnik živí** — vlastními slovy, ne z rejstříku.
2. **Co přesně zákazník dostane** a v jakých variantách (u nás čtyři způsoby
   odběru).
3. **Jak se objednává a platí** — co z toho patří do prvního oslovení a co ne.
4. **Cena nebo rozpětí** a kde je doložená ([[cena-v-osloveni]]).
5. **Co už reálně běží** — reference existují, nebo se začíná? Určuje, co se
   smí tvrdit v přítomném čase.
6. **Proti čemu se stojí** — co zákazník dnes používá místo toho.
7. **Sezónnost a omezení** — u nás školní rok; jinde otevírací doba, region.
8. **Co se tvrdit nesmí** — právní hranice oboru (u nás výživové normy).

## Proč to není jen dotazník

U každé odpovědi musí systém rozlišit **doložitelné tvrzení od přesvědčení
majitele**. U obědů se to ukázalo čtyřikrát: „zdravější zaměstnanci",
srovnání se stravenkami, slovo „jedinečné" a zmínka o zkušenosti, kterou
zákazník zatím nemá. Bez tohohle třídění by systém rozesílal nedoložitelná
tvrzení — a to je porušení TP-2 v duchu i právní riziko pro zákazníka.

**Nejtěžší část tedy není ptát se, ale odmítat.**

## Stav

Nápad. Patří k produktizaci (`docs/analyza-produkt.md`), ne k fázi 0.
Než se do toho půjde, měl by být hotový aspoň jeden ostrý prodej vlastní
službou — jinak se bude zobecňovat z jednoho nevyzkoušeného případu.
