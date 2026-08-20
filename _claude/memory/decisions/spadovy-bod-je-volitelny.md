---
name: spadovy-bod-je-volitelny
description: Nabídka nemusí mít místo, ke kterému se počítá vzdálenost — profil nese příznak ma_spadovy_bod a bez něj se vzdálenost ani cena nevyžadují
type: decision
status: active
created: 2026-08-20
updated: 2026-08-20
related: [druha-firma-vlastni-instance, cena-v-osloveni, jedna-sablona-a-uplnost-blokuje, reserse-i-bez-jidelny]
---

**Postaveno 20. 8. 2026** jako bod 1 plánu druhé firmy.

Cantinero má spádovou jídelnu: v mailu je vzdálenost k ní i cena oběda a firma
bez těch dvou údajů se neosloví. **Druhý zákazník žádnou jídelnu nemá** —
území se u něj ohraničuje stejně jako dnes, jen v něm není bod, ke kterému by
se vzdálenost počítala.

## Jak je to udělané

- `profily.ma_spadovy_bod` (migrace 0057), **výchozí `true`** — dosavadní
  profily i Cantinero zůstávají beze změny.
- `nahled_kampane` si vezme profil kampaně (`kampane.profil_kod`, jinak
  aktivní profil) a **bez spádového bodu odečte `vzdalenost` a `cena`
  z povinných polí**. Ostatní povinnosti (e-mail, obor) platí dál.
- `zpracujFirmuVOblasti` bez spádového bodu ukládá firmu rovnou jako
  `kvalifikovany`, ne `cekajici_na_jidelnu` — čekat na jídelnu, která nikdy
  nepřijde, by firmu jen drželo mimo kampaň.
- `Profil.maSpadovyBod` v `src/profil.ts`.

## Proč „spádový bod", a ne „jídelna"

Majitel 20. 8.: u dalšího zákazníka může být spádovým bodem třeba **obchodní
konzultant** — a výslovně řekl, že se to teď neřeší. Obecný spádový bod se
proto **nestaví**, ale pojmenování ho nezavírá. Až to přijde na řadu, zobecní
se `jidelny`; příznak zůstane, jak je.

## Co se tím NEmění

Kvalifikace o jídelnách nikdy nevěděla (`src/kvalifikace.ts` to má i napsané),
takže se jí to netýká. Schvalování kampaně na kapacitě jídelen nestojí —
kontroluje jen doběhlý průzkum a aspoň jednu firmu s doloženým kontaktem
(spoušť z migrace 0018). Zadrátované `cena_obeda`/`provize`/`cantinero`
v `nahled_kampane` zůstávají — u nabídky bez spádového bodu se na ně nikdo
nezeptá, a pro cizí spádový bod se to bude řešit, až bude existovat.
