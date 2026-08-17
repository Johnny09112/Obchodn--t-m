---
name: dosah-je-tabulka-ne-sloupec
description: Dosah jídelen drží tabulka `dosah`, ne `companies.nejblizsi_jidelna_id` — dotaz na sloupec ukáže nulu i tam, kde dosah je
type: pattern
status: active
created: 2026-08-13
updated: 2026-08-13
related: [dva-profily-sber-a-reserse]
---

**Past:** `npm run cli -- dosah` zapisuje do tabulky **`dosah`** (všechny
dvojice jídelna × firma s příznakem `v_zone`). Sloupec
`companies.nejblizsi_jidelna_id` **nepřepisuje** — ten se nastavuje jen při
sběru, když firma vzniká.

Kdo se po přepočtu zeptá na `companies.nejblizsi_jidelna_id`, dostane starý
stav a vypadá to, že přepočet nic neudělal.

## Jak se to projevilo

13. 8. 2026 po přepočtu:

| Kde jsem se ptal | Výsledek |
|---|---|
| `companies` (sloupec) | 34. ZŠ Plzeň má **0 firem** v zóně |
| `dosah` (tabulka) | 34. ZŠ Plzeň má **2 301 firem** v zóně |

Ohlásil jsem majiteli chybu, která žádná nebyla. Výpis příkazu přitom
říkal pravdu rovnou — „v zóně 2914" — a neseděl s tím, co jsem tvrdil.

## Co s tím

**Na dosah se ptej tabulky `dosah`**, ne kartotéky:

```sql
select j.nazev, count(*) from dosah d
join jidelny j on j.id = d.jidelna_id
where d.v_zone is true group by j.nazev;
```

**A když výpis příkazu nesedí s tím, co ti vyšlo z databáze, věř výpisu
a hledej, kam se doopravdy zapisuje.** Příkaz ví, co udělal; dotaz vymyšlený
zpětně ne.

**Druhý důsledek, věcný:** přepočet dosahu **nemění stav firmy**. Firma
založená sběrem dřív, než jídelna vznikla, zůstane
`cekajici_na_jidelnu`, i když ji dnes jídelna v dosahu má. Překvalifikovat
je samostatný krok a samostatné rozhodnutí majitele.
