---
name: firma-smi-byt-prilezitost-i-neoslovovat
description: Firma může mít současně příležitostní i vylučovací podnět — je to platný stav, ne chyba; podněty se netřídí podle firem a nic se neskrývá
type: decision
status: active
created: 2026-08-17
updated: 2026-08-17
related: [use-casy, produkt-neni-vazany-na-obor, spojeni-neni-pocet-kontaktu]
---

**Rozhodl majitel 17. 8. 2026**, když se při proklikání ukázalo, že Centrum
pobytových a terénních sociálních služeb Zbůch stojí zároveň
v „Příležitosti" (vícesměnný provoz) i v „Neoslovovat" (má vlastní jídelnu).

**Není to vada a nic se kvůli tomu neskrývá.** Vylučovací podnět platí vůči
**dnešní** nabídce; příležitostní podnět může být správný vůči jiné nabídce
nebo pozdější strategii, do které firma zatím nespadá. Obrazovka „Co je
nového" proto **třídí podněty, ne firmy** — a tak to zůstane.

Navazuje na [[produkt-neni-vazany-na-obor]] a [[use-casy]]: co je dnes
nezajímavé pro obědy, může být zítra zajímavé pro jiný use-case. Podnět se
nezahazuje jen proto, že se s jiným podnětem u téže firmy tluče.

**Důsledek pro kód:** nepřidávat filtr, který by firmu s vylučovacím
podnětem z příležitostí odebíral. Návrh na varovný štítek majitel
nepožadoval — bez jeho slova se nedělá.
