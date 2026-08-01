---
name: kampan-nad-vice-oblastmi
description: Kampaň stojí na množině oblastí (kampan_oblasti); sloupec kampane.oblast_id zrušen
type: decision
status: active
created: 2026-08-01
updated: 2026-08-01
related: [mazani-oblasti, prehled-oblasti-pohledem, sito-mezi-oblasti-a-kampani]
---

**Kontext:** Majitel 31. 7.: „chci kampaň přes více oblastí". Potvrdil, že jde
o výběr víc ploch — **geometrické slučování tvarů se nestaví**. Slučování by
navíc zahodilo evidenci o tom, které území se kdy analyzovalo.

**Rozhodnutí (migrace 0030):** vazební tabulka `kampan_oblasti`
(`kampan_id` cascade, `oblast_id` **restrict**, `poradi`), sloupec
`kampane.oblast_id` **zrušen**. Dva zdroje pravdy na totéž se rozejdou.

**Past, na kterou se muselo myslet:** mazání oblastí hlídal cizí klíč
`kampane.oblast_id` = `restrict` ([[mazani-oblasti]]). Se zrušeným sloupcem
musela ochranu převzít vazební tabulka, jinak by se úklid tiše otevřel.
Hlídá to test v `oblast-uklid.test.ts`.

## Jak to funguje

- `nastavUzemi(db, id, { oblastiIds })` **nahrazuje celou množinu**, nepřidává —
  jinak by z opravy výběru bylo hromadění.
- `naplnZOblasti` sjednocuje firmy přes všechny oblasti (`select distinct`).
  Firma v překryvu je jedna firma: TP-5 dovolí jedno oslovení. Vynechané se
  hlásí taky jednou.
- **Průzkum je jeden na oblast** — agent bere území po jednom a průzkum je
  evidence o konkrétním tvaru. `objednejPruzkumyProKampan` přeskočí oblast,
  která hotový průzkum má nebo na jeden čeká; po selhání objedná znovu.
  Bere se **nejnovější průzkum oblasti, ať ho zadal kdokoli** — oblast
  prozkoumaná jinou kampaní je pořád prozkoumaná.
- `souhrnPruzkumu` počítá **oblasti, ne obce**. Sčítat obce napříč objednávkami
  by lhalo, protože oblasti se můžou překrývat.

## V aplikaci

Krok 2 průvodce je **seznam oblastí se zaškrtávátky** (`SeznamOblasti`
s `vybrane`/`onVyber`), ne klikání do mapy — detail v seznamu je přesně to,
podle čeho se vybírá. Mapa zůstává pod ním na kreslení.

**Překryv se hlásí:** „1871 firem leží ve víc vybraných oblastech naráz."
Firma se započítá jednou, ale překryv bývá znamení, že výběr je omylem širší.

**Ověřeno naostro:** Rokycansko leží celé v Plzni → sjednocení zůstalo 12 762,
ne 14 633. Krok 3 poznal, že Plzeň hotová je, a objednal jen Rokycansko.
Testovací objednávka pak byla smazána, ať hlídka nespustí práci navíc.
