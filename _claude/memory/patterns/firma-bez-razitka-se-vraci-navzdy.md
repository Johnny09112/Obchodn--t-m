---
name: firma-bez-razitka-se-vraci-navzdy
description: Firmu, kterou agent tiše přeskočí, nikdo nerazítkuje — vrací se do každé další dávky a fronta nikdy nedojde
type: pattern
status: active
created: 2026-08-13
updated: 2026-08-13
related: [tri-kopie-seznamu-atributu, dva-profily-sber-a-reserse]
---

**Past:** razítko `companies.obohaceno_at` nastavuje `oznacProverenou`, a ta
se volá jen tehdy, když agent u firmy něco vrátí — nález, kontakt, nebo
aspoň položku v `bezNalezu`. **Firma, kterou agent tiše vynechá, razítko
nedostane.**

`firmyProReserse` vybírá firmy s `obohaceno_at is null`, takže se taková
firma vrátí do každé další dávky. A protože je vynechaná ze stejného důvodu
jako minule (nemá web, nemá inzerát, hledá se u ní nejhůř), vynechá se
znovu. **Fronta nikdy nedojde.**

## Jak se to projevilo

Doběh posledních 12 firem kampaně „Zkouška průzkumu" 13. 8. 2026:

| Dávka | Nabídnuto | Zpracováno | Zbývá po dávce |
|---|---|---|---|
| 1 | 15 | 7 | 5 (čekáno) |
| 2 | 10 | 6 | **7** |

Součet zpracovaných (13) je vyšší než původní počet (12), a přesto zbývá
sedm. Čísla nesedí právě proto, že „zpracováno" počítá firmy s razítkem
mezi nabídnutými — a nerazítkované se do další dávky vrátily.

## Co s tím

**Nepouštět další dávku na tytéž firmy.** Konvergovat to nebude a agentní
čas se protopí. U zbylých sedmi to navíc nemá cenu: všechny jsou mikro se
skóre 11–26, šest ze sedmi už kontakt má, dvě jsou školy (vaří si samy,
tedy vylučovací cíl) a jedna je fyzická osoba.

**Skutečná oprava** je zaznamenat i pokus, který nic nenašel: razítko (nebo
počítadlo pokusů) nastavit vždy, když firma dávkou prošla, ne jen když
z ní něco vypadlo. Pak fronta dojde a rozdíl mezi „nenašlo se" a „nezkusilo
se" bude vidět.

**Souvislost:** je to tentýž tvar chyby jako u nulové dávky
([[tri-kopie-seznamu-atributu]]) — prázdný výsledek se tváří stejně jako
„neproběhlo" a systém to sám nepozná.
