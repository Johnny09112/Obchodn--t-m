---
name: produkt-neni-vazany-na-obor
description: Cantinero se prodává firmám z jakéhokoli oboru — jídelny jsou jen jeden z use-caseů, žádná data se nesmí odepsat jako nepotřebná
type: decision
status: active
created: 2026-08-10
updated: 2026-08-10
related: [dve-vrstvy-znalost-a-zprava, dva-profily-sber-a-reserse]
---

**Majitel to musel zopakovat 10. 8. 2026** — je to tedy past, do které jde
šlápnout snadno.

Systém se prodává **firmám z jakéhokoli oboru**. Prodej obědů z partnerských
jídelen je **jeden z několika use-caseů**, ne účel produktu. Majitel ho chce
použít pro tři další vlastní projekty a případně prodat dál.

## Co z toho plyne pro rozhodování

**Nikdy neodepisuj datový zdroj nebo atribut jako „nepotřebný" na základě
obědů.** Co je u obědů bezcenné, může být pro jiného zákazníka to hlavní:

| Údaj | U obědů | Jinde |
|---|---|---|
| Finanční ukazatele | nic neřeknou | leasing, pojištění, financování — jádro kvalifikace |
| Vozový park | irelevantní | správa flotily, pneuservis, telematika |
| Certifikace a normy | irelevantní | BOZP, audit, poradenství |
| Směnný provoz | zajímavé | u nepřetržitých provozů zásadní pro spoustu služeb |

Konkrétní chyba, které jsem se dopustil: v návrhu signálů jsem napsal
„finanční ukazatele nepřebírat, u obědů nic neříkají". **To je špatná
úvaha** — správně je „u profilu obědů se nesbírají", což je nastavení
profilu, ne vlastnost produktu.

## Kde to naráží na dnešní stav

`atributy.do_zpravy` je **globální příznak**, ne per profil. Co smí do
zprávy, je tedy dnes rozhodnuté pro celý systém naráz — zatímco co se
**sbírá**, si každý profil určuje sám (`profil_atributy`). Pro produkt
prodávaný víc zákazníkům je to nesoulad: dva zákazníci můžou mít legitimně
jiný whitelist pro zprávu.

**Není to chyba k okamžité opravě** — dokud běží jediný produkt, globální
příznak stačí a je bezpečnější. Ale až se přidá druhý ostrý profil, tohle
je první místo, které se musí předělat.

Tvrdá pravidla SPEC (zákaz sociálních sítí, recenzí, odesílání bez svolení)
zůstávají **projektová, ne profilová** — ta se nemění nikdy.
