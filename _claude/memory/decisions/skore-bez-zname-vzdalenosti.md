---
name: skore-bez-zname-vzdalenosti
description: Skóre bez vzdálenosti se přepočítává na stejnou stupnici, ne usekává
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Kontext:** Firmy z nakreslené oblasti nepatří k žádné jídelně, takže nemají
vzdálenost — a neměly proto skóre vůbec. Seznam v kampani se nedal setřídit.

**Rozhodnutí:** neznámá vzdálenost vypadne z čitatele i ze jmenovatele
a výsledek se přepočte na touž stupnici (skóre = podíl získaných bodů
z dosažitelných). Firma se známou vzdáleností má dosažitelných 100, takže se
jí nic nemění.

**Důvod:** bez přepočtu by firma z oblasti dosáhla nejvýš na 70 a v setříděném
seznamu by prohrála i s průměrnou firmou u jídelny, ať je jakkoli dobrá.

**Našla se u toho horší vada:** `vzdalenostM` bylo typované jako `number`,
ale `null` prošlo a `Math.min(null, 3000)` je 0 — firma bez jídelny by dostala
**plných 30 bodů za blízkost, kterou nikdo neměřil**. Poučení: když se údaj
v nějaké cestě legitimně neví, musí to říkat typ.
