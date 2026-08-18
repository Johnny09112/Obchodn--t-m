---
name: jedna-sablona-a-uplnost-blokuje
description: Jedna hlavní šablona pro všechny; chybějící jméno se nahradí „Dobrý den“, chybějící ostatní údaj firmu z kampaně vyřadí a je vidět v tabulce
type: decision
status: active
created: 2026-08-18
updated: 2026-08-18
related: [cena-v-osloveni, sablona-ma-tri-vrstvy, podobnost-podle-objemu, personalizace-jen-z-whitelistu]
---

**Rozhodl majitel 18. 8. 2026** po prohlédnutí tří navržených mailů.

**Jedna hlavní šablona pro všechny** — varianta A (jeho vlastní text, 62
slov). Varianty B a C se jako samostatné šablony neuloží; C se rozpustila
do fallbacku na oslovení, B odpadla.

**Dvě různé reakce na chybějící údaj:**

| Chybí | Co se stane |
|---|---|
| **jméno adresáta** | mail se pošle, oslovení je „Dobrý den,“ — neblokuje |
| **cokoli dalšího** (obor, vzdálenost, cena jídelny) | firma se do kampaně **nezahrne** a v tabulce má **výrazné upozornění**, že potřebuje doplnit |

**Proč zrovna takhle:** jméno je jediný údaj, jehož absence má zavedenou
a neztrapňující náhradu — „Dobrý den“ je běžný český dopis. U oboru
a vzdálenosti náhrada neexistuje: bez nich zbyde obecná věta, která je
přesně tím hromadným mailem, kterému se má systém vyhnout. Radši firmu
neoslovit než ji oslovit slabě — oslovit jde jen jednou (TP-5).

**Upozornění patří do tabulky firem, ne do logu.** Chybějící údaj je práce
pro Čmuchala, ne porucha — musí být vidět tam, kde se na firmy kouká.

### Změřeno na ostrých datech 18. 8. 2026

Ze 165 kvalifikovaných firem:

| Stav | Počet |
|---|---|
| **Připraveno k oslovení** (e-mail + obor + vzdálenost) | **62** |
| Z toho jde oslovit jménem | 39 |
| Z toho dostane „Dobrý den“ | 23 |
| Vypadne — chybí e-mail i obor | 58 |
| Vypadne — chybí e-mail (obor má) | 29 |
| Vypadne — má e-mail, chybí obor | 16 |

Vzdálenost nechybí ani jedné firmě — dosah je dopočítaný u všech.
**Cena u jídelny chybí u všech pěti jídelen**, protože sloupec zatím
neexistuje ([[cena-v-osloveni]]); do doby, než se doplní, je připravených
firem fakticky nula.

**Nejlevnější zvednutí čísla:** 16 firem má e-mail a chybí jim jen obor —
to Čmuchal dohledá a nic to nestojí ([[resurse-agentem-zmereno]]).
62 → 78 firem proti volné kapacitě 80 obědů denně.
