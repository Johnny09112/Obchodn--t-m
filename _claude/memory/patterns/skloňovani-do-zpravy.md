---
name: sklonovani-do-zpravy
description: Údaj do české věty potřebuje pád — skloňuj jen tam, kde je pravidlo jisté, jinak ustup na tvar, který je vždycky správně
type: pattern
status: active
created: 2026-08-18
updated: 2026-08-18
related: [personalizace-jen-z-whitelistu, jedna-sablona-a-uplnost-blokuje]
---

**Naráželo se na to 18. 8. 2026 třikrát za sebou** při skládání oslovení —
pokaždé u jiného údaje a pokaždé to vypadalo jako maličkost.

| Údaj | Věta chce | Past |
|---|---|---|
| příjmení | 5. pád: „Vážený pane Procházk**o**" | -ek a -ec mají vypadávající -e- (Duchek → Duchku) |
| obor | 2. pád: „od Vaší truhlárn**y**" | uložený obor je popisná věta, ne slovo |
| vzdálenost | počítaný tvar: „2 kilometr**y**" vs „5 kilometr**ů**" | desetinné číslo je jednotné („3,2 kilometru") |

**Pravidlo, které z toho plyne:** skloňuj jen tam, kde je tvar jistý.
Kde jistý není, **ustup na formulaci, která je vždycky správně** —
„Dobrý den,", „od Vás", nebo údaj rovnou vynech. Špatně sklohované slovo
v první větě studeného mailu zahodí celý zbytek dopisu; obecná formulace
neurazí nikoho.

**Cena té opatrnosti, změřeno na ostrých datech:**

| Údaj | Vyjde jmenovitě | Ustoupí obecně |
|---|---|---|
| oslovení | 32 ze 78 firem s e-mailem | 46 |
| označení firmy | 1 z 91 firem s oborem | 90 |

Označení proto dostalo **vlastní atribut `oznaceni`** (migrace 0049) —
jedno slovo opsané z webu firmy i s citací. Agent ho **nesmí vymýšlet**,
jen opisovat; upozornil na to majitel: *„pozor, abychom nezvolili špatné
slovo — víceméně se jen posune problém o krok před při agentní práci."*

**Kde to hledat v kódu:** `src/osloveni.ts` (obojí jmenné),
`src/geo.ts` → `dobaCestyMin` (vzdálenost), `src/cestina.ts` (počty).
