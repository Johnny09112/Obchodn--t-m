---
name: jidelna-se-nepriradi-rucne
description: Jídelna se k oblasti nevybírá ručně — ukazuje se, které v tom tvaru leží
type: decision
status: active
created: 2026-08-03
updated: 2026-08-03
related: [obrazovka-oblasti-a-listovani]
---

**Majitel to řekl dvakrát**, podruhé 3. 8. s poznámkou „znovu požadavek":

> Jídelna se primárně nepřiřazuje k oblasti ručně, ale ukazuje se jako
> zahrnutá v oblasti. Až pro další use-cases budeme řešit přiřazení
> jídelny/bodu k firmě (ale to bude pro sales účely).

**Rozhodnutí:** panel oblasti nemá výběr jídelny. Místo něj počítá a vypisuje
**„Jídelny uvnitř"** — partnerské jídelny, jejichž poloha leží v nakresleném
tvaru (`bodVOblasti`).

**Proč to dává smysl:** oblast je plocha na mapě. Co v ní leží, se dá
spočítat; ručně vybraná jídelna se s každým překreslením tvaru rozešla
s realitou a nikdo by si toho nevšiml.

**Co zůstalo:** sloupec `oblasti.jidelna_id` v databázi je pořád a plní ho
příkazová řádka (`oblast prirad`). Z aplikace se nenastavuje. Až přijde
přiřazení jídelny ke konkrétní firmě pro obchod, řeší se samostatně —
**není to totéž co jídelna oblasti.**
