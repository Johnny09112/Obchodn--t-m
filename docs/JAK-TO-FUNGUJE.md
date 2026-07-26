# Jak bude Cantinero fungovat — lidsky

> Pro majitele, bez programátorštiny. Cíl: potvrdit, že jsme se pochopili.
> Když něco nesedí s tvou představou, je to přesně to, co chceme doladit teď.

## Obraz celku

Cantinero je **digitální obchodní tým**, který prodává obědy z partnerských
školních jídelen okolním firmám. Skládá se ze tří vrstev:

1. **Kartotéka** (databáze) — jedno místo, kde je všechno: jídelny a jejich
   zóny, firmy, kontakty, každý dohledaný údaj i s „účtenkou" (odkud ho máme),
   historie všech běhů a později i všech zpráv.
2. **Tým agentů** — šest rolí s přesně vymezenou prací (níže). Agent je
   „digitální kolega": dostane úkol, používá povolené nástroje, výsledky
   zapisuje do kartotéky a všechno po něm zůstává dohledatelné.
3. **Pojistky** — pravidla zabudovaná přímo do kartotéky a nástrojů tak, že
   je agent **nemůže obejít, ani kdyby chtěl** (nejsou to „prosby v zadání",
   ale zámky). Např.: bez ověření firmy v státním rejstříku ARES nejde firmu
   vůbec založit; údaj bez zdroje nejde zapsat; odesílání je vypnuté vypínačem,
   který smí přepnout jen člověk.

## Šest rolí (kdo je kdo)

| Role | Co dělá | Co nikdy nedělá |
|---|---|---|
| **Čmuchal** | Hledá firmy v okolí jídelen, ověřuje je, sbírá povolené údaje, boduje vhodnost | Nikdy nic neodesílá |
| **Obchodník** | (od fáze 3) Píše individuální oslovení ze schválených šablon, max 10/den | Nevymýšlí si tvrzení, neposílá dvakrát |
| **Spojka** | (od fáze 2) Připravuje partnerství — obce, komory, HR firmy | Neodesílá bez tvého schválení |
| **Statistik** | (od fáze 4) Měří výsledky, hlídá prahy, umí zastavit odesílání | Nemění šablony ani limity |
| **Marketér** | (od fáze 4) Navrhuje vylepšení šablon | Nenasazuje nic do produkce |
| **Ředitel** | (od fáze 5) Týdenní hlášení, kontrola kvality, dohled | Nemění pravidla, nespouští nové agenty |

Ve fázi 1 pracuje **jen Čmuchal**. Ostatní role „nastoupí" až ve svých fázích.

## Jak vypadá jeden běh Čmuchala (krok za krokem)

1. Vezme jednu aktivní jídelnu s volnou kapacitou (např. „ZŠ Komenského,
   150 obědů denně volných, zóna 3 km").
2. Ze státního rejstříku ARES si vyjmenuje firmy sídlící v té obci.
3. Každou **ověří** — neexistující či pochybné rovnou zahodí.
4. Zjistí, kde firma přesně sídlí, a **změří vzdálenost** k jídelně:
   do 800 m pěšky, do 3 km „krátký dojezd", dál = mimo zónu (ta se buď
   zahodí, nebo uloží jako „čeká, až bude jídelna blíž").
5. U firem v zóně se podívá na jejich **veřejný web** (kariérní stránky,
   kontakty): mají vlastní jídelnu? jak řeší obědy? jaký e-mail zveřejňují
   a k čemu? Zapíše **jen to, co může doložit doslovnou citací s odkazem** —
   jako by ke každému údaji přikládal účtenku. Co doložit nejde, zůstává
   prázdné. Nikdy nekouká na soukromé profily, finance ani recenze.
6. Firmu **oboduje 0–100** (blízkost, velikost, nemá vlastní jídelnu,
   kancelářský obor, má poptávkový e-mail) a označí jako „kvalifikovanou" —
   tedy připravenou pro budoucí oslovení.
7. Celý běh se zapíše do deníku: kolik firem, co se povedlo, co ne, kolik
   stál. Postřehy („kariérní stránky fungují líp než kontakty") si Čmuchal
   ukládá do svého playbooku a příště hledá chytřeji.

**Cíl fáze 1: 200 takto ověřených firem.** Pak společně ručně zkontrolujeme
vzorek 30 firem, jestli je kvalita dat v pořádku.

## Jak to budeš ovládat ty (UX)

**Teď (fáze 0–2): konverzačně přes Claude Code** — stejně jako se bavíme
teď. Typicky:

- „Spusť Čmuchala na jídelnu Komenského, max 50 firem." → dostaneš lidské
  shrnutí: kolik firem přibylo, kolik čeká, kolik to stálo.
- „Jak jsme na tom?" → přehled: firmy podle stavu, kapacita jídelen vs.
  počet firem, metriky kvality (kolik údajů má zdroj, kolik kontaktů je
  „poptávkových").
- „Ukaž mi firmu XY" → vše, co o ní víme, včetně zdrojů u každého údaje.

Vedle toho existují **příkazy** (jedna řádka v terminálu) pro rutinu — ty
jsou spíš pro mě/automatiku, ty je znát nemusíš.

**Později (od fáze 3-4): jednoduché obrazovky** dle zadání — mapa Území,
Fronta (koho oslovíme, s náhledem přesného textu zprávy PŘED odesláním),
Partnerství, Výkon, Návrhy ke schválení, Incidenty. Vždy s viditelným stavem
odesílání a velkým červeným vypínačem.

**Co schvaluješ výhradně ty (systém to bez tebe neudělá):**
- zapnutí odesílání (a znovu-zapnutí po každém zastavení),
- tvrzení o produktu a šablony zpráv,
- prvních 50 zpráv jednotlivě, zvýšení denního limitu z 10,
- placené věci (databáze, doména, API rozpočet),
- partnerskou komunikaci (tu vždy odesílá člověk).

## Pojistky, které hlídají samy (bez tebe i beze mě)

- **Vypínač odesílání** je z výroby VYPNUTÝ. Ve fázích 0–2 kód odesílání ani
  neobsahuje.
- **Automatická stopka**: 1 stížnost na spam, 1 právní výhrada, moc odmítnutí
  či odhlášení → systém sám vypne odesílání, založí incident a čeká na tebe.
- **Jedna firma = jedno oslovení.** Žádné „ještě jednou pro jistotu".
- **Kdo řekl ne, má navždy pokoj** (trvalý zákaz na adresu i celou firmu).
- **Žádné sledovací pixely** v prvním oslovení; měříme odpovědi, ne otevření.
- **Vše dohledatelné**: každý běh, každý údaj se zdrojem, každá (budoucí)
  zpráva uložená přesně tak, jak odešla.

## Fáze a tvoje role v nich

| Fáze | Co běží | Co děláš ty |
|---|---|---|
| **0 příprava** (teď) | Prostředí, agenti, jídelny, tvrzení, doména, právník | Rozhodnutí (technologie, jídelny, doména…), schválení tvrzení |
| **1 Čmuchal** | Sběr 200 firem, žádné odesílání | Koukáš na čísla, zkontrolujeme vzorek 30 firem |
| **2 Spojka + inbound** | Partnerství, landing page, první souhlasy | Schvaluješ a odesíláš partnerské věci |
| **3 Obchodník** | 10 zpráv/den | Schvaluješ prvních 50 zpráv, čteš odpovědi (podepsaná osoba) |
| **4 Statistik + Marketér** | Měření, testy variant | Schvaluješ návrhy změn |
| **5 Ředitel** | Týdenní hlášení, dohled | Čteš pondělní report, schvaluješ návrhy |

## Co to stojí (řádově)

- **Databáze**: Supabase v řádu stovek Kč/měs (nebo alternativa dle S0.2).
- **AI náklady**: platí se za dohledávání na webu — hrubě jednotky USD na
  ~10 obohacených firem; 200 firem fáze 1 ≈ nižší desítky USD. Každý běh
  má útratu zapsanou, takže ji uvidíš černé na bílém.
- **Doména + e-mail**: stovky Kč/rok + případný nástroj na odesílání (fáze 3).
- **Právník**: jednorázově před fází 3.

## Otázky k potvrzení (tady se pochopíme, nebo doladíme)

1. Sedí ti rozdělení „ty schvaluješ / systém dělá sám"? Chceš něco přesunout?
2. Ovládání konverzací + později obrazovky — stačí, nebo chceš obrazovky dřív?
3. Souhlasíš, že fáze 1 poběží „nasucho" (jen sběr dat, nic ven), dokud
   neodsouhlasíš vzorek 30 firem?
4. Máš představu o jiné technologii, kterou zmiňuješ? (Proberu v S0.2 —
   varianty a doporučení jsou v `docs/FAZE-0.md`, kap. 3.)
