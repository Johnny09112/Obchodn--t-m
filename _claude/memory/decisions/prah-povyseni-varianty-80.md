---
name: prah-povyseni-varianty-80
description: Práh pro automatické povýšení varianty šablony snížen ze 150 na 80 zpráv na rameno — se 165 firmami by test se 150 nikdy nedoběhl
type: decision
status: active
created: 2026-08-18
updated: 2026-08-18
related: [cena-v-osloveni, odesilani-zakazano-jen-docasne]
---

**Rozhodl majitel 18. 8. 2026. Je to změna SPEC kap. 10.5**, ne konfigurace —
zapsaná přímo v zadání i s důvodem.

| | Před | Po |
|---|---|---|
| Zpráv na rameno testu | 150 | **80** |
| Oslovení na celý test (dvě varianty) | 300 | 160 |
| Doba při deseti zprávách denně | ~měsíc na rameno | **~týden na rameno** |

**Proč:** kvalifikovaných firem je 165 a podle TP-5 se každá osloví jen
jednou. Se 150 na rameno by první A/B test **nikdy nedoběhl** — chyběly by
firmy. S 80 se do dnešní kartotéky vejde.

**Co to stojí:** menší statistickou jistotu. Při osmdesáti zprávách na rameno
se pozná jen výrazný rozdíl, řádově deset procentních bodů v odpovědích
a víc. Jemnější rozdíl splyne s náhodou a hrozí nasazení varianty, která
lepší není. Majitel to ví a zvolil rychlejší učení před přísnější
statistikou.

**Do té doby schvaluje varianty majitel** — jeho vlastní podmínka.
