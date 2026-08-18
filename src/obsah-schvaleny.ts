/**
 * Obsah oslovení schválený majitelem 18. 8. 2026 (session S0.5).
 *
 * **Zdroj pravdy pro to, co je v databázi.** Do `claims` a `templates` se
 * nahrává odsud příkazem `obsah nahraj`, ne ručním INSERTem — jinak by
 * nikdo nevěděl, odkud se text v databázi vzal a kdo ho schválil.
 *
 * Podklad, který majitel schvaloval:
 * `docs/vizualizace/tvrzeni-a-maily-ke-schvaleni-2026-08-18.html`.
 *
 * Změna textu = změna tohoto souboru + nové spuštění příkazu. Vznikne nová
 * verze šablony; stará zůstane, protože odeslané zprávy se na ni odkazují.
 */

import type { SablonaVstup, Tvrzeni } from "./obsah.js";

/**
 * Osm doložitelných tvrzení o službě. Co tu není, to se do zprávy psát
 * nesmí — ani „jinými slovy“.
 *
 * Čtyři věci, které se tvrdit NESMÍ (zdravější zaměstnanci, srovnání se
 * stravenkami, „splňujeme výživové normy“, jakákoli zmínka o zkušenosti
 * s firmami), tu schválně nejsou ani jako zákaz: seznam je whitelist, ne
 * blacklist. Jejich rozbor je v podkladu výše.
 */
export const TVRZENI: Tvrzeni[] = [
  {
    tvrzeni: "Ve školní jídelně se vaří denně mimo školní prázdniny.",
    doklad: "Provoz partnerské jídelny; sezónnost plyne ze školního roku.",
  },
  {
    tvrzeni:
      "Menu je polévka, hlavní jídlo, obvykle přídavek a na místě nápoj (voda, čaj nebo džus).",
    doklad: "Skladba jídelníčku partnerské jídelny.",
  },
  {
    tvrzeni:
      "Cena za celé menu je u každé jídelny jiná a je uvedená v kartě té jídelny, ze které se pro danou firmu vaří — včetně naší provize.",
    doklad:
      "Cena dohodnutá s konkrétní jídelnou. Přepsáno 18. 8. 2026: pevný ceník neexistuje.",
  },
  {
    tvrzeni:
      "Objednává se dopředu z vystaveného jídelníčku v aplikaci; objednávka se obvykle uzavírá den před varným dnem.",
    doklad: "Fungování systému Cantinero.",
  },
  {
    tvrzeni:
      "Platit může každý strávník sám přes platební bránu, nebo firma souhrnně na fakturu — počty jsou v systému.",
    doklad: "Fungování systému Cantinero, firemní profil.",
  },
  {
    tvrzeni:
      "Jídlo lze sníst v jídelně, odnést ve vlastním jídlonosiči nebo jednorázovém obalu, odvézt hromadně firmou, nebo ho jídelna doveze a dopravu doúčtuje.",
    doklad: "Provozní varianty partnerských jídelen podle majitele.",
  },
  {
    tvrzeni:
      "Školní jídelny vaří dětem podle výživových norem (spotřebního koše) daných vyhláškou č. 107/2005 Sb.; obědy pro firmy vznikají z téhož jídelníčku.",
    doklad:
      "Vyhláška č. 107/2005 Sb., o školním stravování, ověřeno 17. 8. 2026. Formulace je záměrná — normy platí na dětské porce, ne na dospělé strávníky.",
  },
  {
    tvrzeni:
      "Firemní obědy se vaří ve volné kapacitě vedle hlavní činnosti, tedy vedle stravování dětí.",
    doklad: "Doplňková činnost školní jídelny; hlavní činnost nesmí být omezena.",
  },
];

/**
 * Hlavní šablona — majitelova vlastní formulace, 62 slov ve vyplněné podobě.
 *
 * Rozhodl 18. 8. 2026: **jedna šablona pro všechny**. Varianta pro neznámé
 * jméno se rozpustila do náhrady u slotu `[osloveni]`; varianta zmiňující
 * placení odpadla.
 *
 * `struktura_id` drží stavbu, ne slova — ta je jediné, co se přenese
 * k jinému zákazníkovi (viz paměť „sablona-ma-tri-vrstvy“).
 */
export const SABLONA_HLAVNI: SablonaVstup = {
  segment: "vsichni",
  kanal: "email",
  strukturaId: "vztah-nabidka-provoz-otazka",
  schvalenoKym: "majitel",
  predmet: "obědy ze školní jídelny pár minut od Vás",
  telo: `[osloveni]

[vzdalenost] [od_vasi_firmy] spolupracujeme se školní jídelnou, která navýšila kapacity i pro okolní firmy.

Kompletní menu vychází na [cena] s možností obědvat na místě nebo si jídlo odvážet v jídlonosičích. Veškeré objednávky i podklady pro rozúčtování přitom snadno vyřešíte přes naši aplikaci.

Řešíte aktuálně obědy pro zaměstnance hromadně, nebo si je každý zajišťuje sám?`,
};
