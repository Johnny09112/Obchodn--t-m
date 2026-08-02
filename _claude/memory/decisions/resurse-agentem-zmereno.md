---
name: resurse-agentem-zmereno
description: Rešerše Čmuchalem změřená na 20 firmách — 64 s na firmu, e-mail u 19 z 20
type: decision
status: active
created: 2026-08-02
updated: 2026-08-02
related: [kontakty-i-nad-oblasti, velikost-ze-souboru-a-slozeni]
---

**Kontext:** rešerše agentem nikdy naostro neběžela, takže se nedalo
rozhodnout, jestli se vyplatí pustit ji na 432 plzeňských firem. Majitel
schválil zkoušku na 20 firmách (2. 8.).

**Vzorek:** cílová velikost (25+), jméno jednatele známé z rejstříku,
ale **žádný e-mail ani telefon** — tedy přesně ty firmy, kde rešerše může
přidat nejvíc.

## Naměřeno

| Údaj | Hodnota |
|---|---|
| Firem | 20 |
| Čas | **21 minut** (~64 s na firmu) |
| Tokenů | 201 152 |
| Volání nástrojů | 125 |
| **E-mail po rešerši** | **19 z 20** (předtím 0) |
| Telefon | 15 z 20 |
| Zapsaných kontaktů | 29 |
| Bez jakéhokoli nálezu | 1 (EXTETO — nemá webovou stopu) |

**Přepočet na zbytek:** 432 firem ≈ **7,5 hodiny** agentní práce.

## Co to stojí

**Nic navíc.** Čmuchal běží jako podagent uvnitř Claude Code, tedy
z předplatného. Placená cesta je jiná — `src/enrich.ts` přes Anthropic SDK,
která potřebuje `ANTHROPIC_API_KEY`; ten **v `.env` není** a nikdy nebyl,
proto je v přehledu 0 USD. Majitel na to upozornil správně, mé váhání bylo
mířené na špatnou cestu.

## Co rešerše NEdohledá

**Stravování zjistila jen u 1 z 20.** Weby to téma neřeší; u městských
organizací (zoo, divadlo, magistrátní útvary) nikdy. Vlastní jídelnu
nedoložila ani jedna firma — což **neznamená, že ji nemají**, jen že o tom
nepíšou. Na kvalifikaci se tenhle atribut spoléhat nedá.

**Kontakt úrovně 1** (`poptavky@`, `nabidky@`) nenašla ani jednou. Ve vzorku
byla výroba, bytová družstva, spolky a příspěvkovky, kde taková schránka
prakticky neexistuje.

## Past, kterou zkouška odhalila

Fronta `firmyKObohaceni` se ptala na `stav = 'kvalifikovany' and v_zone is true`
— **stejná díra jako u doplňování kontaktů**. V Plzni by z 620 cílových firem
nabídla 16. Doplněn rozsah `oblastId` (`k-obohaceni --oblast <id>`).

Poučení: kdykoli přibude cesta „nad oblastí", zkontroluj **všechny** fronty,
které se ptají na zónu jídelny. Tahle chyba se objevila už potřetí.
