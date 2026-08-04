---
name: male-firmy-a-nezname-jde-pribrat
description: Firmy bez známé velikosti i firmy do 24 zaměstnanců jde do kampaně přibrat dodatečně, každé vlastním tlačítkem
type: decision
status: active
created: 2026-08-04
updated: 2026-08-04
related: [sber-neukladal-velikost, velikost-ze-souboru-a-slozeni, sito-mezi-oblasti-a-kampani]
---

**Kontext:** volba „vzít i firmy bez známé velikosti" šla udělat jen při
zakládání kampaně, a nepamatovala si sama sebe — po znovuotevření byla
odškrtnutá, i když ty firmy v kampani dávno byly.

## Co se rozhodlo

**Volba patří ke 4. kroku**, k seznamu firem, ne do 2. kroku. Panel se ukáže
při každém otevření kampaně a nabízí dvě věci **zvlášť**:

- přidat firmy, u kterých registr neuvádí velikost,
- přidat firmy do 24 zaměstnanců.

Jsou to dvě různá rozhodnutí, proto dvě tlačítka a dvě potvrzení.

**Počet se nikam neukládá** — dopočítá se z dat pokaždé znovu (`spocitejCekajici`
nad `roztridKandidaty`, tedy tímtéž pravidlem, kterým se kampaň plní). Číslo
v panelu proto nemůže zastarat: co je napsané, to tlačítko přidá.

**Přidání je jednosměrné.** Hromadné odebrání není — kdo nesedí, vyřadí se po
jedné s důvodem. Jinak by se smazala i rozhodnutí udělaná mezitím.

## Proč malé firmy vůbec

Majitel u revize řekl, že o firmy do 24 zaměstnanců stojí a o společenství
vlastníků ne. Kontrola SPEC.md mu dala za pravdu:

- **SPEC kap. 10.2 zná mikropodnik (do 25) jako plnohodnotný segment**
  s vlastním úhlem oslovení („krátce, cena, jednoduchost, žádná administrativa").
  `src/score.ts` jim přiděluje body, ne nulu.
- Pravidlo **„mikro se do kampaně neberou nikdy" v SPEC nikde nebylo** — bylo
  zadrátované v `naplnKampanZOblasti` s komentářem „obědy pro pět lidí
  nedávají smysl". Aplikace tedy zahazovala segment, se kterým zadání počítá.

**Společenství vlastníků a bytová družstva se tím nepřibírají** — vyřazuje je
síto jako bytový dům (`jeBytovyDum`, právní formy 145 a 233) bez ohledu na
velikost. Drží se to samo od sebe, ale je na to test, protože je to přesně
ten rozdíl, o který majiteli šlo.

Ověřeno naostro na Čachrovu 4. 8.: 5 + 18 malých + 68 bez velikosti = 91 firem
v území. Mezi 18 malými ani jedno společenství — samé s.r.o., farmy, dílny,
elektrárna, čerpací stanice a jedna obec.
