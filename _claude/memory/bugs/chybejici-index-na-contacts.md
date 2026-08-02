---
name: chybejici-index-na-contacts
description: Kartotéka se načítala 20+ s, protože contacts.ico neměl index — cizí klíč index nedělá
type: bug
status: fixed
created: 2026-08-03
updated: 2026-08-03
related: [postgrest-strop-na-radky, zapis-po-jedne-je-lokalne-neviditelny]
---

**Příznak:** majitel 2. 8.: „kartotéka se načítá extrémně pomalu, cca 20+
vteřin, to samé oblasti — Plzeň se načítala cca 5–10 vteřin."

**Příčina se našla v plánu dotazu, ne v odhadu:**

```
->  Seq Scan on contacts k  (actual time=0.136..0.140 rows=0 loops=13000)
      Rows Removed by Filter: 969
```

Seznam firem si u každé firmy nechává spočítat kontakty (`contacts(count)`).
Bez indexu na `contacts.ico` se **pro každou z 13 767 firem prošla celá
tabulka kontaktů** — přes dvanáct milionů porovnání na jedno načtení.

**Druhá brzda:** stránkovalo se přes `offset`. Databáze musí u každé další
stránky znovu přeskákat všechny předchozí řádky, takže poslední stránka je
nejdražší a celek roste s druhou mocninou.

## Naměřeno (poslední stránka po tisícovce)

| Stav | Čas |
|---|---|
| Před (bez indexu, `offset 12000`) | **1 889 ms** |
| Po přidání indexu | 63 ms |
| Po přechodu na stránkování podle IČO | **6,5 ms** |

Čtrnáct stránek: ~14 s → pod desetinu vteřiny čistého času databáze.
Zbytek jsou už jen cesty po síti.

## Oprava

- Migrace 0033: indexy na `contacts(ico)`, `evidence(ico)`,
  `evidence(contact_id)`, `companies(velikost_kategorie)`, `companies(stav)`,
  `oblast_firmy(ico)`.
- `nactiFirmy` a `nactiIcaVOblastech` stránkují **podle posledního IČO**
  (`gt("ico", posledni)`), ne přes `offset`.
- `test/indexy.test.ts` hlídá, že indexy existují, a u každého je napsané,
  co bez něj trvalo vteřiny.

## Ponaučení

**Cizí klíč index nedělá.** Postgres zakládá index automaticky jen
u primárního klíče a unikátních omezení; `references` sám o sobě nic
nevytvoří. Tabulky, do kterých se míří přes `ico`, ho potřebují ručně.

**Na malých datech to není vidět.** Dokud měla kartotéka pár set firem
a kontaktů pár desítek, běželo to svižně. Ukázala to až ostrá data — stejně
jako u zápisu po jedné ([[zapis-po-jedne-je-lokalne-neviditelny]]).
Než se něco prohlásí za pomalé „kvůli síti", vyplatí se pustit
`explain analyze`; tady to trvalo pět minut a ušetřilo hádání.
