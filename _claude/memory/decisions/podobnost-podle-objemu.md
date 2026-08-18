---
name: podobnost-podle-objemu
description: Kontrola podobnosti zpráv se zapíná až nad 20 mailů denně a segmenty vznikají z reakcí, ne z tabulky velikostí
type: decision
status: active
created: 2026-08-18
updated: 2026-08-18
related: [podobnost-mailu-zmereno, prah-povyseni-varianty-80, cena-v-osloveni]
---

**Schválil majitel 18. 8. 2026. Změna SPEC kap. 6 a 10.5.**

## 1. Podobnost se řeší až od objemu

Kontrola „shoda nad 70 % = odmítnout" **platí až nad 20 odeslaných zpráv
denně**. Do té doby stačí, že je zpráva adresovaná konkrétnímu člověku
a nese doložený údaj o jeho firmě. Nad 20 denně platí pravidlo beze změny
a generátor musí střídat varianty.

**Proč:** změřeno ([[podobnost-mailu-zmereno]]) — u zprávy o 62 slovech mění
personalizace pět slov, takže dvě takové zprávy se shodují na **80–88 %**.
Vysoká shoda je matematicky nevyhnutelná; pravidlo by tlačilo k delším
mailům, což je proti záměru kapitoly 6. Riziko doručitelnosti neroste
s podobností, ale s objemem.

**Důsledek pro fázi 3:** začíná se **jedním vypiplaným mailem** pro všechny
(deset denně), ne třemi šablonami podle velikosti firmy.

## 2. Segmenty vznikají z reakcí

Nedělit oslovení dopředu podle velikosti firmy. Poslat všem stejný text
a rozdělit ho teprve podle toho, **kdo jak odpovídá** — segment je pak nález,
ne domněnka. Nápad majitele.

**Podmínka:** u každé odpovědi musí být známý text, se kterým zpráva odešla.
Drží ho `messages.finalni_text` (TP-13), takže technicky nic nechybí.
