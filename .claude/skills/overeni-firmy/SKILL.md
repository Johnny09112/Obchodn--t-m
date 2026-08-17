---
name: overeni-firmy
description: Postup, jak založit firmu a doložit o ní údaj — použij, kdykoli se má do kartotéky dostat nová firma, nový kontakt nebo nový atribut. Drží tvrdá pravidla TP-1 (ARES) a TP-2 (zdroj a citace u každého údaje).
---

# Ověření firmy a doložení údaje

Tvrdá pravidla se vynucují v kódu a v databázi, ne v hlavě. Tenhle postup
říká, **kudy** se k tomu jde, aby se na pojistky nenaráželo omylem.

## Firma vzniká jedině přes ARES (TP-1)

- Jediná cesta do `companies` je `zalozFirmu()` v `src/repo.ts`.
- Přímý `insert` do `companies` je porušení pravidla — i kdyby prošel.
- Bez shody v ARES se firma **zahazuje**, nedohaduje se.
- IČO se ověřuje kontrolní číslicí (`src/ico.ts`) dřív, než se posílá dotaz.

## Každý údaj má zdroj a doslovnou citaci (TP-2)

Zápis jde přes `zapisAtribut()` / `zapisKontakt()`, které vyžadují:

| Co | Proč |
|---|---|
| `zdrojUrl` | stránka, kde údaj **doopravdy stojí** — ne domovská stránka webu |
| `citace` | doslovný úryvek z té stránky, ne parafráze |

**Bez obojího zůstává pole NULL.** Prázdno je legitimní výsledek; vymyšlená
nebo odvozená hodnota je porušení pravidla.

Praktické důsledky, na které se naráží nejčastěji:

- **Katalogový záznam není web firmy.** ARES, firmy.cz, zivefirmy.cz,
  kurzy.cz — jako zdroj citace projdou, ale do atributu `web` nepatří.
- **Citace musí odpovídat hodnotě.** Když citace mluví o počtu volných míst,
  nesmí být hodnotou obor podnikání (skutečná chyba, 7 firem, 17. 8. 2026).
- **Sbírá se jen to, co určuje profil produktu** (`atributy.hleda_agent`),
  ne co se zrovna hodí. Kontrola běží při zápisu a odmítne zbytek.

## Kontakt a jeho úroveň (TP-6)

Úroveň se určuje podle **účelu, ke kterému firma adresu zveřejnila** — a ten
musí být na stránce vidět, ne odhadnutý:

| Úroveň | Co to je | Příklad |
|---|---|---|
| 1 | adresa pro nabídky | „cenové nabídky: nabidky@…" |
| 2 | obecná firemní adresa | „info@…", „napište nám" |
| 3 | jmenná adresa osoby | „jan.novak@…" |

Nižší číslo = lepší cíl. Když účel na stránce není, patří kontakt do úrovně 2
nebo 3 podle tvaru adresy — **nikdy se nepovyšuje na jedničku dohadem**.

## Co se nesbírá nikdy

Sociální sítě, finanční údaje, recenze, odhady. LinkedIn se nescrapuje.
Pracovní inzeráty se číst smějí (jsou veřejná data MPSV), ale jejich obsah
nesmí do zprávy — to hlídá whitelist (`src/whitelist.ts`, TP-3).

## Když ověření selže

Firma bez shody v ARES se zahodí. Firma, u které se nic nenašlo, se
**označí jako prozkoumaná** (`reserse_pokusu`), aby se nevracela do každé
další dávky — jinak fronta nikdy nedojde.
