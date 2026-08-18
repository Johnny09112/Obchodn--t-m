---
name: podobnost-mailu-zmereno
description: Dva personalizované maily z jedné kostry se shodují na 80–88 %, různě stavěné varianty na 42–45 % — pravidlo o 70 % tedy u krátkých zpráv trestá stručnost
type: research
status: active
created: 2026-08-18
updated: 2026-08-18
related: [prah-povyseni-varianty-80, cena-v-osloveni]
---

**Měřeno 18. 8. 2026** poté, co majitel namítl, že jeden vyšperkovaný mail
rozeslaný dvaceti firmám je totéž, jako kdyby ho psal ručně.

Metoda: trigramová podobnost (totéž, co dělá `pg_trgm`) a Jaccard nad
slovníkem. Zprávy dlouhé 62 slov, personalizace mění oslovení, obor
a vzdálenost.

| Co se porovnává | Shoda |
|---|---|
| **jedna kostra, jiná firma** | **80–88 %** |
| tři různě stavěné varianty | 42–45 % |
| dva nesouvisející obchodní maily | 4 % |

## Co z toho plyne

**SPEC kap. 6 odmítá zprávu shodnou s jinou odeslanou na víc než 70 %.**
Jeden mail personalizovaný pro dvacet firem by tedy neprošel — ale ne proto,
že je lajdácký. **U krátké zprávy mění personalizace pět slov ze šedesáti
dvou**, takže vysoká shoda je matematicky nevyhnutelná. Pravidlo tak
paradoxně tlačí k delším mailům, což je proti záměru.

**Riziko není v podobnosti, ale v objemu.** Sto stejných zpráv denně je pro
spamové filtry vzorec; dvacet personalizovaných ne — filtry váží hlavně
reputaci domény, autentizaci a stížnosti.

## Návrh (čeká na rozhodnutí majitele)

1. Kontrolu podobnosti **vázat na objem**: do dvaceti zpráv denně se neřeší,
   nad to se vyžadují varianty. Fáze 3 začíná s deseti denně, takže by
   startovala s jedním vypiplaným mailem.
2. **Kategorie odvodit z reakcí, ne z tabulky** — majitelův nápad. Poslat
   všem stejný text a rozdělit ho teprve podle toho, kdo jak odpovídá.
   Podmínka: u každé odpovědi se musí vědět, s jakým textem odešla
   (`messages.finalni_text` to drží, TP-13).

Obojí je **změna SPEC**, takže se nedělá bez pokynu.
