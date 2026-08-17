---
name: uroven1-merena-ze-spatneho-zakladu
description: Metrika „podíl kontaktů úrovně 1" počítala i jednatele bez adresy a agent dával jmenným adresám obchodníků jedničku — dvě různé chyby dávající totéž číslo
type: bug
status: fixed
created: 2026-08-17
updated: 2026-08-17
related: [pootocene-urovne-adres, spojeni-neni-pocet-kontaktu]
---

**Příznak:** metriky fáze 1 hlásily „podíl kontaktů úrovně 1: 1 %". Číslo,
o které se opírá argumentace oprávněného zájmu podle TP-6.

Vyšetřování našlo **dvě nezávislé příčiny** — obě shodou okolností tlačily
číslo dolů, takže se maskovaly navzájem.

## 1. Špatný jmenovatel (chyba měřidla)

`podilKontaktuUrovne1` se počítal ze **všech** 1 319 kontaktů. Jenže **877
z nich je jednatel z rejstříku bez e-mailu i telefonu** — kontakt, ale ne
adresa. Poptávkovou adresou se stát nemůže, takže do jmenovatele nepatří.

Zdroje kontaktů: rejstřík ARES 854 (všechny úroveň 3), MPSV 124 (úroveň 3),
web a katalogy 341. Adres, na které jde napsat, je **442**.

**Oprava:** `src/metriky.ts` počítá jen z kontaktů s e-mailem nebo telefonem.
Metrika navíc nese absolutní čísla a rozpad po úrovních — samotné procento
u malých čísel klame: 6 ze 442 i 11 z 1 319 se zaokrouhlí na „1 %".

## 2. Jmenné adresy zařazené jako poptávkové (chyba dat)

Z 11 kontaktů úrovně 1 bylo **5 jmenných adres obchodníků**:
`richardbayer@bbs.eu`, `pavel.prochazka@signumcz.com`,
`martin.vochoc@vochoc.cz`, `zdenka.masinova@signumcz.com`.

Agent je zařadil podle **funkce člověka** („obchodní zástupce = kontakt pro
nabídky") místo podle **tvaru adresy**. Je to táž záměna jako u
[[pootocene-urovne-adres]]: TP-6 není pořadí podle rozhodovací pravomoci,
ale právní žebříček — u jmenné adresy zpracováváme osobní údaj získaný
odjinud a do zprávy patří poučení podle **čl. 14 GDPR**.

Dva z těch záznamů vznikly **týž den** v dávce, kterou jsem sám zadával —
v zadání jsem TP-6 nezopakoval a agent si ho vyložil po svém.

**Oprava:** pravidlo je nově **v kódu, ne v promptu** (`src/uroven-adresy.ts`,
volané ze `zapisKontakt`): je-li jméno nebo příjmení v adrese před zavináčem,
úroveň se srovná na 3. Hledá se jen před zavináčem — firma Vochoc má doménu
`vochoc.cz`, ale `info@vochoc.cz` jmenná adresa není. Zadání agenta
(`.claude/agents/cmuchal.md`) dostalo zkoušku „je jméno v adrese?".
Pět záznamů v ostré databázi opraveno na úroveň 3.

## Jak to dopadlo

| Údaj | Před | Po |
|---|---|---|
| Jmenovatel podílu | 1 319 kontaktů | **442 adres** |
| Úroveň 1 | 11 (z toho 5 chybně) | **6** |
| Úroveň 2 · 3 | — | 174 · 262 |
| Hlášený podíl | 1 % | 1 % *(ale 6 ze 442, ne 11 z 1 319)* |

**Číslo zůstalo stejné, význam se změnil.** A zbytek je realita, ne chyba:
poptávkové adresy (`nabidky@`, `poptavky@`) jsou u malých a středních
českých firem vzácné — pracovní většinu tvoří `info@` (174 adres, 39 %).

## Poučení

**Dvě chyby, které táhnou stejným směrem, se maskují.** Kdybych opravil jen
jednu, číslo by se skoro nehnulo a vypadalo by to, že příčina je jinde.
Proto se u podezřelé metriky ověřuje **čitatel i jmenovatel zvlášť**, ne jen
výsledek.

**Procento bez absolutního čísla je past.** „1 %" nerozlišilo situaci před
opravou a po ní. Metriky proto nesou i počty.
