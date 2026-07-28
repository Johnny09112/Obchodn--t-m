# Nová oblast — postup od začátku do konce

> **Pro Claude:** tohle je závazný postup, když majitel řekne jen název obce
> nebo města („pusť Stříbro“, „pojďme na Rokycany“). Není potřeba se doptávat
> na nic, co se dá zjistit z dat — ptej se jen na to, co ví jenom majitel
> (kapacita jídelny, jestli tam vůbec partnera máme).
>
> Aktualizováno 2026-07-28. Když se postup změní, změň i tenhle soubor.

## Než začneš

Aktivní data jsou v `data/pgdata-v5`, ne ve výchozím `data/pgdata`. Ke všem
příkazům patří `CANTINERO_DATA_DIR=data/pgdata-v5`.

**Databázi smí otevřít jen jeden proces naráz.** Nikdy nespouštěj dva příkazy
sahající na data současně a nespouštěj je na pozadí souběžně s vlastními
dotazy — hlídá to zámek, ale čekání je zbytečné.

## Krok 1 — je tam jídelna?

```
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- stav
```

- **Jídelna existuje** → přeskoč na krok 3.
- **Neexistuje** → potřebuješ partnera. **To je obchodní rozhodnutí majitele,
  ne tvoje.** Nezakládej jídelnu „na zkoušku“ jen proto, aby běh prošel —
  vymyšlený partner je horší než žádný běh. Zeptej se.

## Krok 2 — založení jídelny

Potřebuješ IČO, adresu, souřadnice a kód obce. **Nic z toho nehádej.**

**a) Najdi školu v registru ČSÚ** — offline, v souboru, který už máme:

```js
// projdi data/cache/res_data.csv, filtruj OBEC_TEXT = obec a název na /škol/i
// vezmi ICO, FORMA, KATPO, ICZUJ, PSC, ULICE_TEXT, CDOM
```

Pozor: příspěvková organizace má FORMA 331, ZŠ jako právní forma je 621.
Ve větších obcích bývá škol víc — vyber podle ulice, kterou řekl majitel.

**b) Zaměř adresu** pomocí `vytvorGeokoder({ kontakt })`; kontakt se načte
z `.env` (`NOMINATIM_CONTACT`). Ověř **dvěma až třemi variantami adresy** —
musí vyjít shodně do desítek metrů, jinak je zaměření nespolehlivé.

**c) Založ:**

```bash
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- seed-jidelna \
  --nazev "..." --adresa "..." --obec "..." \
  --lat ... --lng ... --kod-obce ... --ico ...
```

`--kapacita` **vynech, pokud ji majitel neřekl.** Prázdná kapacita znamená
„nevíme“ a je to poctivější než číslo, které si vymyslíš. Na sběr nemá vliv,
tvrdou podmínkou se stane až u fronty na oslovení (fáze 3).

`--ico` je důležité ze dvou důvodů: brání tomu, aby se partnerská jídelna
objevila mezi kandidáty, a slouží k dohledání městských obvodů.

## Krok 3 — sběr

```bash
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- run --jidelna <id>
```

Co se děje: kandidáti se sbírají ze tří zdrojů — otevřená data MPSV
(pracoviště), OpenStreetMap (fyzická místa) a kompletní registr ČSÚ
(všechny firmy sídlící v území). Každý se ověří v ARES (TP-1), profiltruje
a obodouje.

**Odhad času:** hlavní brzdou je zaměřování adres — smí běžet jen 1× za
vteřinu. Sto firem ≈ 2 minuty jen na tenhle krok, 700 firem ≈ 12 minut.
U velkého města pusť běh na pozadí a mezitím nedělej nic s databází.

**Velké město:** registr je má rozdělené na obvody a `jednotkyObce()` je
dohledá z IČO jídelny automaticky. Plzeň má 10 obvodů, Praha 57.

**Práh velikosti:** výchozí je 10 zaměstnanců (`--min-zamestnancu`).
Uplatní se už v registru, takže se malé firmy vůbec nestahují.

## Krok 4 — doplnění kontaktů

```bash
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- doplnit-kontakty
```

**Nezapomínej na tenhle krok.** Běžný sběr firmu, kterou už zná, přeskočí —
takže u dřív posbíraných firem by nový zdroj kontaktů nikdy nezafungoval.

Doplní se jméno, pozice, e-mail a telefon z otevřených dat MPSV, a kde ta
nejsou, aspoň jednatel z veřejného rejstříku.

## Krok 5 — rešerše na webu (agent)

```bash
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- k-obohaceni --segmenty stredni,korporat
```

Seznam předej agentovi `cmuchal` (definice v `.claude/agents/cmuchal.md`).
Agent dohledá, co rejstříky nedají: stav stravování, účel adresy a kontakty
z webu. Zapisuje přes `zapis-nalezy`, který kontroluje zdroje a citace.

Agentovi vždy připomeň: aktivní data jsou v `pgdata-v5`, příkazy spouštět
jeden po druhém, **nikoho neoslovovat ani kvůli zjištění kontaktu**.

## Krok 6 — výstupy pro majitele (POVINNÉ)

```bash
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- kartoteka
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- mapa
```

- **Kartotéku publikuj jako artifact** (odkaz, který jde otevřít v prohlížeči).
- **Mapu pošli jako soubor**, ne jako artifact — publikované stránky mají
  zakázané stahování z internetu, takže by se v ní nenačetl mapový podklad.
- U většího celku práce přidej i **samostatnou HTML stránku se shrnutím**
  do `docs/vizualizace/` (viz `reserse-2026-07-27.html`, `trh-cr-2026-07-27.html`).

Majitel není programátor a výstupy si prohlíží vizuálně. Text v chatu
nestačí — na tohle už jednou upozorňoval.

## Krok 7 — zápis do paměti

- `memory/stav.md` — kde jsme a co je další krok
- `memory/rozhodnuti.md` — každé rozhodnutí (datum · kdo · co · proč)
- `memory/poznatky.md` — každá past, na kterou jsi narazil

## Na co si dát pozor

| past | co s tím |
|---|---|
| **Stejnojmenné obce** — „Hrádek“ je v ČR šestkrát | Filtruj podle kódu územní jednotky, nikdy podle názvu obce |
| **Firma už v kartotéce je** | Sběr ji přeskočí; kontakty doplní až krok 4 |
| **Velikost neuvedena** (480 tis. subjektů v ČR) | Prahem se neposuzuje; ze slabého zdroje se vyřazuje |
| **Vymýšlení chybějících údajů** | Prázdno je legitimní stav. Nikdy nedoplňuj kapacitu, souřadnice ani e-mail odhadem |
| **Dva procesy nad databází** | Tiše rozbijí data. Jeden běh v jednu chvíli |

## Co rozhoduje majitel, ne ty

- jestli v oblasti vůbec chceme jídelnu (a kterou)
- kapacity jídelen
- vyřazení celé kategorie firem z cílení
- **jakýkoli nový způsob hledání kontaktů** — nápad napiš, ale nepoužívej,
  dokud ho neschválí
- cokoli, co míří ven z firmy
