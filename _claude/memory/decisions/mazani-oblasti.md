---
name: mazani-oblasti
description: Kdo smí mazat oblasti a co jim v tom brání — kampaň a průzkum, ne firmy
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: [sito-mezi-oblasti-a-kampani, zastup-spravce-a-zamceni-kampani]
---

**Kontext:** Majitel chtěl uklidit nepoužité oblasti: „oblast je jen plocha,
pro kterou bude spuštěna analýza." Souhlas — ale při přípravě se ukázalo, že
mazání **už bylo otevřené a nebezpečné**: pravidlo `oblasti_zapis` bylo psané
na `ALL` pro roli `uzivatel`, takže mazat směl kdokoli z týmu, a
`pruzkumy.oblast_id` byl `on delete cascade`, takže by se s oblastí tiše ztratil
i doklad o tom, jaké území se kdy analyzovalo. Rozhraní to nenabízelo, ale
pravidlo je to, co platí.

**Rozhodnutí (migrace 0028):**

- `pruzkumy.oblast_id` → `on delete restrict`. Průzkum je evidence, ne
  odvozenina; nesmí zmizet jako vedlejší účinek něčeho jiného.
- `oblasti_zapis` rozděleno: zakládat a upravovat smí celý tým
  (`oblasti_zalozeni`, `oblasti_uprava`), mazat jen admin (`oblasti_mazani`).
  Stejné pravidlo jako u kampaní — mazání dat rozhoduje majitel.
- `oblast_firmy` zůstává kaskádou schválně. To JE odvozenina z tvaru a spočítá
  se kdykoli znovu.

**Co drží oblast naživu:** kampaň (i archivovaná) a objednaný průzkum. Firmy
uvnitř ne.

**Důsledek:** aplikace se ptá dřív, než maže (`zjistiVyuzitiOblasti`), a řekne
to jménem: „Smazat nejde. Používá ji kampaň „Zkouška průzkumu". Objednal se nad
ní průzkum." Hláška Postgresu o porušení cizího klíče nikomu nic neřekne. Věta
se skládá v čistém `src/oblast-vyuziti.ts` — stejný vzor jako `pruzkum-postup.ts`.

**Ověřeno na ostré databázi** (v transakci, se zpětným odvoláním): role
`uzivatel` smaže 0 řádků, admin smaže nepoužitou oblast a na držené narazí
na cizí klíč. Z osmi oblastí je šest volných; drží se „Plzeň a okolí" a
„Klatovy a okolí".
