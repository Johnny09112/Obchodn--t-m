---
name: personalizace-jen-z-whitelistu
description: Podle čeho firmu vybíráme a co o ní smíme napsat jsou dvě různé množiny — směnný provoz je signál, ale do zprávy nesmí
type: pattern
status: active
created: 2026-08-18
updated: 2026-08-18
related: [dve-vrstvy-znalost-a-zprava, kdo-vari-a-co-se-neprozrazuje]
---

**Past:** personalizace svádí použít nejsilnější signál, který o firmě máme.
Jenže profil produktu rozlišuje dvě věci a rozdíl je záměrný:

| Atribut | Hledá agent | Smí do zprávy | Máme |
|---|---|---|---|
| obor podnikání | ano | **ano** | 214 |
| způsob stravování | ano | ano | 8 |
| vlastní jídelna | ano | ano | 5 |
| účel adresy | ano | ano | 152 |
| **směnný provoz** | ano | **NE** | 26 |
| **web firmy** | ano | **NE** | 161 |

**Proč zrovna směnný provoz:** je to jeden z nejlepších důvodů, proč firmu
oslovit — lidé na směny jedí mimo obvyklou dobu oběda. Ale věta „všiml jsem
si, že jedete na tři směny“ zní, jako bychom firmu sledovali. **Vybírat podle
něčeho a psát o tom jsou dvě různé věci** — přesně tohle rozdělení zavedla
[[dve-vrstvy-znalost-a-zprava]].

**Pravidlo:** personalizovaná věta smí čerpat jen z atributů
s `do_zpravy = true`, plus z údajů, které jsou **náš vlastní výpočet**
(vzdálenost k jídelně, doba chůze). Kontrolu vynucuje whitelist (TP-3), ne
úsudek toho, kdo zprávu skládá.

**Prakticky** zbývá na personalizaci hlavně **obor** (91 kvalifikovaných
firem) a vzdálenost. Velikost firmy sice smí, ale „vaše firma o padesáti
lidech“ zní jako sledování — používat opatrně.
