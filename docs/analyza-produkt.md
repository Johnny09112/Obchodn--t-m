# Má smysl Cantinero prodávat?

**Session S0.10** · připraveno 11. 8. 2026 · **rozhodovací podklad, ne doporučení
k investici**

> **Čtěte s tímhle vědomím:** o trhu nemám data. Nemám ceny konkurence
> z jednání, nemám rozhovory se zákazníky, nemám čísla o tom, kolik kdo za co
> platí. Co následuje je **úvaha z veřejně dostupných informací a z toho, co
> o systému vím**. Každý odhad je označený jako odhad. Nejcennější věta
> celého dokumentu je poslední kapitola: co udělat, aby tenhle dokument šel
> nahradit něčím podloženým.

---

## 1. Nejdůležitější zjištění dopředu

**Cantinero pro vlastní potřebu a Cantinero jako produkt jsou dva různé
produkty s různou ekonomikou.**

| | Pro sebe | Pro klienty |
|---|---|---|
| Mezní náklad běhu | **0 Kč** — jede z předplatného, které už platíte | tokeny za každého klienta |
| Hosting | není, běží lokálně | server, zálohy, dostupnost |
| Podpora | žádná | reakce na dotazy, výpadky |
| Právní odpovědnost | vaše, za vaše oslovení | **sdílená se zákazníkem** |
| Správa souhlasů | nepotřeba | **nevypnutelná součást** (SPEC kap. 13) |
| Izolace dat | nepotřeba | mezi klienty nutná |

Dosud systém spotřeboval **0 USD** na placené API. To číslo se produktizací
mění na první nákladovou položku, kterou budete mít.

## 2. Kdo by byl zákazník

Systém **není vázaný na obor** — dnes obsluhuje dva use-casy (obědy
z jídelen pro střední a větší firmy; docházkové systémy pro obce i firmy)
a nic nebrání dalším. To rozšiřuje trh, ale zároveň ztěžuje odpověď na
otázku „komu to prodávat".

Tři možné segmenty, seřazené podle toho, jak blízko jsou k tomu, co systém
umí dnes:

**A. Malé obchodní týmy s lokálním záběrem** (2–10 lidí)
Prodávají službu do firem v regionu. Dnes to řeší ručně: seznam z katalogu,
googlení, tabulka. Bolest je reálná a systém ji řeší celou.
*Riziko: mají nejmenší rozpočet.*

**B. Dodavatelé služeb pro firmy** — catering, úklid, BOZP, docházkové
a HR systémy. Mají stejný tvar problému jako vy: najít firmy v dosahu,
zjistit o nich provozní věci, oslovit konkrétního člověka.
*Nejlepší shoda s tím, co systém dnes doopravdy umí.*

**C. Obchodní oddělení středních firem**
Rozpočet mají, ale nejspíš už platí nějaký nástroj a chtěli by napojení na
svoje CRM. To je práce navíc, kterou systém dnes neumí.

**Odhad:** nejblíž je segment B. Ale je to odhad z tvaru produktu, ne
z rozhovoru s jediným zákazníkem.

## 3. Čím se to dnes řeší

| Náhražka | Co umí | Kde selhává |
|---|---|---|
| Databáze firem (od ~500 Kč/měs.) | seznam s filtry | statická, neřekne kdy oslovit, kontakty zastaralé |
| **BizMachine** a podobné | 11,7 mil. firem, 5,4 mil. kontaktů, 55+ obchodních signálů | česká cena neznámá; cílí na větší týmy |
| Ruční práce v tabulce | přesně to, co si člověk vymyslí | nešká­lovatelné, nikdo neví, odkud údaj je |
| Nákup studených databází | rychlé | právně nejrizikovější cesta |

**Kde je Cantinero jiný:** u každého údaje je **zdroj a doslovná citace**
a dá se na ně kliknout. Nástroje, které tvrdí věci bez doložení, tohle
nemají — a v okamžiku, kdy se někdo zeptá „odkud to víte", je to rozdíl
mezi odpovědí a rozpaky.

Druhá odlišnost: **pravidla jsou vynucená v databázi, ne v instrukci.**
Systém neumí odeslat víc než limit ani oslovit firmu podruhé — ne proto,
že by se to nemělo, ale proto, že to nejde.

## 4. Co by se muselo doprogramovat

Odhady v „sezeních" — jedno sezení je ucelený blok práce, jaké dnes děláme.

| Co | Proč | Odhad |
|---|---|---|
| **Správa souhlasů** jako nevypnutelná součást | vyžaduje SPEC kap. 13 i právní realita | 3 sezení |
| **Izolace dat mezi klienty** | jeden klient nesmí vidět na data druhého | 4 sezení |
| **Účtování a limity API** | mezní náklad přestává být nula | 2 sezení |
| Onboarding zákazníka bez nás | dnes to nastavuje člověk, který systém zná | 3 sezení |
| Napojení na CRM | segment C bez toho nekoupí | 3 sezení |
| Provoz: hosting, zálohy, dostupnost | dnes běží lokálně | 2 sezení + průběžně |
| **Podpora a dokumentace** | nekončí, jen začíná | průběžně |

**Součet zhruba 17 sezení** na první prodejnou verzi. To je řádově měsíce,
ne týdny — a podpora už nikdy neskončí.

## 5. Cenový model

Tři varianty, s tím, co o každé vím a co ne:

**Předplatné za místo, měsíčně.** Odpovídá tomu, jak nástroj funguje.
Vyžaduje, aby se zákazník vracel — což je právě to, co dělají signály.
*Cenu odhadnout neumím.*

**Jednorázová instalace u zákazníka.** Jednodušší právně (data zůstávají
u něj), horší ekonomicky — jednou zaplatí a podporu chce navždycky.

**Podíl z uzavřeného obchodu.** Zní spravedlivě, ale znamená, že vidíte
zákazníkovi do tržeb a nesete jeho neúspěch. *Nedoporučuju.*

**Co ovlivní cenu víc než sazebník:** jestli zákazník otevře nástroj jednou
za měsíc pro seznam, nebo každé ráno kvůli podnětům. Seznam se koupí jednou;
signály se předplácejí.

## 6. Rizika

**Právní.** Nabízet nástroj na oslovování znamená sdílenou odpovědnost.
Zadání je v tom nekompromisní: *„konzultujte to dřív, než napíšete první
prodejní stránku"*. Je to otázka C v podkladu pro advokáta.

**Rozptýlení.** Produktizace je jiná práce než prodej obědů. Dokud vlastní
use-case neběží naostro, je to stavba na neověřeném základu. **Systém dosud
neodeslal jedinou zprávu** — neví se tedy, jestli to, co prodáváme, funguje.

**Podpora.** Jeden klient je zvládnutelný. Pět klientů je práce na část
úvazku a nikdo jiný ji neudělá.

**Konkurence s hlubší kapsou.** BizMachine má data i tým. Na objemu s ním
nevyhrajete; na doložitelnosti a úzkém záběru možná ano.

## 7. Doporučení

**Neotevírat produktizaci teď.** Ne proto, že je to špatný nápad — protože
je předčasný. Chybí jediná věc, která by celý tenhle dokument nahradila
fakty: **ověření, že systém funguje pro vás.**

Pořadí, které dává smysl:

1. **Dokončit fázi 0** (tvrzení, šablony, doména, právní konzultace) —
   nutné tak jako tak.
2. **Projít fází 3 s vlastním produktem** a změřit: kolik oslovení, kolik
   odpovědí, kolik schůzek, kolik uzavřených. **Tohle číslo je jediný
   prodejní argument, který bude mít váhu.**
3. **Teprve pak tři rozhovory** s někým ze segmentu B — čím to řeší dnes,
   co by ho přimělo změnit, kolik za to platí.
4. Podle nich se rozhodnout.

**Minimální ověřovací varianta, kterou lze udělat hned a levně:** ty tři
rozhovory. Nepotřebují ani řádek kódu a odpovědí na víc otázek než tenhle
dokument. Kdybyste z celé analýzy měl udělat jednu věc, je to tahle.

## 8. Co by tenhle dokument nahradilo něčím pořádným

| Otázka | Jak ji zodpovědět |
|---|---|
| Kolik kdo platí za podobný nástroj? | tři rozhovory, nebo ceník konkurence z jednání |
| Funguje vůbec oslovení? | fáze 3 s vlastním produktem |
| Kdo je zákazník? | rozhovory, ne úvaha nad tvarem produktu |
| Unese to právně produktizaci? | otázka C pro advokáta |
| Kolik stojí provoz na klienta? | první ostrý běh s placeným API |

Dokud tyhle řádky nemají odpověď, je každé číslo v téhle analýze odhad —
a já to raději napíšu takhle natvrdo, než abych vám dal jistotu, kterou nemám.
