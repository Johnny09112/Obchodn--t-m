---
name: tydenni-report
description: Kostra týdenního hlášení pro majitele — použij od fáze 5, kdy dohled přebírá Ředitel, nebo dřív, když si majitel řekne o souhrn za období. Staví hlášení z dat, ne z dojmů, a odděluje fakta od odhadů.
---

# Týdenní hlášení

Aktivní **od fáze 5** (SPEC kap. 10.6). Do té doby je to kostra — dá se
použít ručně, když si majitel řekne o souhrn.

## Čím se řídí

- **Vždycky začni výsledkem**, ne postupem: co se stalo, co to znamená, co
  potřebuju od majitele.
- **Fakta odděl od odhadů.** Co je změřené, řekni napřímo; co je odhad,
  označ jako odhad. Nepředstírej jistotu.
- **Nulový výsledek je výsledek.** Týden, kdy se nic nestalo, se hlásí taky —
  zamlčené ticho vypadá jako práce.
- Majitel není programátor: bez žargonu, technické detaily jen v odkazu.

## Co v hlášení musí být

| Oddíl | Zdroj dat | Pozor na |
|---|---|---|
| Kolik firem přibylo a v jakém stavu | `npm run cli -- stav` | rozlišit kvalifikované od čekajících na jídelnu |
| Co agent dělal | tabulka `agent_runs`, obrazovka Provoz | běhy bez výsledku = něco spadlo |
| Kapacita proti poptávce | obrazovka Jídelny | „v provozu" a „v přípravě" nikdy nesčítat |
| Odeslané zprávy a odpovědi | až od fáze 3 | do té doby psát „nic se neodeslalo (TP-8)" |
| Incidenty a co se s nimi udělalo | `agent_runs.chyby`, paměť | chybu nezamlčet, i když se vyřešila sama |
| Co čeká na majitele | otevřené body v paměti | seřadit podle toho, co blokuje postup |

## Meze pravomocí (SPEC kap. 10.6)

Ředitel **smí** zastavit odesílání a hodnotit práci ostatních agentů.
**Nesmí** spustit nového agenta ani měnit tvrdá pravidla — ta mění jedině
SPEC.

## Formát

Krátké shrnutí (pár odrážek) v odpovědi + **HTML stránka do
`docs/vizualizace/`** s vizualizací. Stav se kóduje tvarem i barvou, ne jen
číslem. Ukázková data se označují jako ukázková; prázdný stav se zobrazuje
jako prázdný stav, ne jako nula.
