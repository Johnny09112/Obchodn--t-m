# Poznatky a gotchas

## Limit 1 000 v ARES: co filtruje a co se jen tváří (2026-07-27)

Ověřeno reálnými dotazy na `/ekonomicke-subjekty/vyhledat`. **Jediné dva
filtry, které se doopravdy uplatní, jsou `sidlo.kodObce` a `pravniForma`.**

| filtr | chování |
|---|---|
| `pravniForma` (pole kódů) | **funguje**, Plzeň 49 831 → 13 600, Stříbro 1 580 → 285 |
| `czNace` | funguje, ale **porovnává PŘESNÝ kód** — dotaz „56" nenajde firmu s „56110" |
| `datumVzniku` | **tiše ignorován** (počet se nezmění) |
| `pocetZamestnancu` | **tiše ignorován** (počet se nezmění) |

**Dělit dotaz podle CZ-NACE nejde.** Test na Bezdružicích: 18 s.r.o. celkem,
součet přes všechny dvoumístné oddíly našel jen 15. Tři chyběly — mají uložené
pětimístné kódy (`56110`), které se dvoumístnému dotazu nerovnají. Kdybychom
takhle „pokryli" Plzeň, tiše bychom přišli o ~17 % firem a mysleli si, že máme
hotovo. **Poučení: každé dělení dotazu se musí ověřit proti nedělenému
výsledku na malém vzorku, jinak se ztráta nepozná.**

**Jak se to tedy řeší:** sweep si u ARES rovnou říká jen o právní formy
zaměstnavatelů (`FORMY_ZAMESTNAVATELU` v `src/formy.ts`). Vyřeší to všechny
obce do velikosti Stříbra a navíc z výsledku mizí živnostníci a bytové domy
u zdroje. **Velká města tím vyřešená nejsou a ani být nemají** — v Plzni
zbývá 13 600 subjektů, ale sweep podle obce je tam stejně špatný nástroj:
zóna jídelny má 3 km, ne celé město, a sídlo v Plzni neříká, kde se pracuje.
Pro města platí MPSV + OpenStreetMap. Když sweep neprojde, zapíše se to do
`poznamkyProPlaybook`, ne jen mezi technické chyby — díra v pokrytí musí být
vidět v souhrnu.

## Právní forma: kód „100" znamená v každém zdroji něco jiného (2026-07-27)

Číselník `PravniForma` vrací tři sady podle zdroje (`com`, `res`, `rzp`).
U kódu **100** si protiřečí: obchodní rejstřík „Podnikající fyzická osoba
tuzemská", živnostenský „Fyzická osoba nepodnikající". V našich datech pod ním
seděli konkrétní lidé vedení jménem, takže patří k živnostníkům tak jako tak —
ale je to varování: **u číselníků ARES nestačí vzít první nalezený název.**
(Podobná past už jednou byla u `KategoriePoctuPracovniku`, kód „000".)

## Kartotéku zaplavují SVJ a OSVČ (2026-07-27)

Ze 194 kvalifikovaných firem se známou velikostí je **jen 20 firem s 25 a víc
zaměstnanci**. Zbytek je šum dvojího druhu:

- **Společenství vlastníků jednotek (SVJ)** — v Hrádku jich je přes patnáct
  („Společenství vlastníků jednotek Hrádek, Nová Huť, 1. máje 178…186"). Mají
  formálně „1–5 zaměstnanců", ale nikdo tam neobědvá. Je to bytový dům.
- **Fyzické osoby / OSVČ** vedené vlastním jménem („Miroslav Böhm", „Jitka
  Lukáš"). Živnostník není odběratel firemních obědů.

Práh `--min-zamestnancu` je nevyřadí, protože formálně zaměstnance mají.
Odfiltrovat je jde spolehlivě: SVJ podle CZ-NACE 68200 + názvu, OSVČ podle
právní formy z rejstříku. **Otevřené — čeká na rozhodnutí majitele**, protože
vyřazení celé kategorie je změna pravidel, ne technická drobnost.

Praktický důsledek pro rešerši: frontu je nutné zúžit na `stredni,korporat`,
jinak by agent trávil čas na bytových družstvech.

## Partner v kartotéce (2026-07-27)

Partnerská jídelna je právní subjekt se zaměstnanci a ze sweepu rejstříku
vypadne jako běžný kandidát — ZŠ Tlučná se takhle dostala mezi firmy
k oslovení. **Obecné poučení: seznam „koho oslovit" musí umět vyloučit
i vlastní stranu, ne jen nevhodné cizí subjekty.** Řešeno migrací 0007
(`jidelny.ico`), párování jde přes IČO — názvy v rejstříku se od těch
používaných v praxi liší natolik, že by porovnávání názvů selhalo.

## První ostrý běh (Bezdružice, 40 kandidátů, 2026-07-27) — co selhalo

Mechanika prošla (0 chyb, 39 kvalifikováno), ale **kvalita dat je slabá**.
Čtyři konkrétní vady k opravě před dalším během:

1. **Neodfiltrované OSVČ.** Většina nálezů jsou fyzické osoby („Alena
   Voříšková", „Zbyněk Rak"). Živnostník není odběratel firemních obědů.
   → Filtrovat podle právní formy, nebo aspoň bodově potlačit.
2. **`velikost_kategorie` je NULL u všech 40.** Vyhledávací endpoint ARES
   nevrací `statistickeUdaje.kategoriePoctuPracovniku` — vrací ho až detail
   subjektu. `cmuchal.ts` detail nevolá (spoléhá na výsledek hledání), takže
   25 z 100 bodů skóre je mrtvých. → Volat `overFirmu()` pro každého kandidáta.
3. **CZ-NACE se míchají úrovně.** Přicházejí jak sekce (`G`), tak dvoumístné
   (`55`, `00`) i pětimístné (`43120`) kódy. Náš test `slice(0,2)` je proto
   nespolehlivý — `55` (ubytování/stravování) projde jako „kancelářský obor".
   → Normalizovat na oddíl a ošetřit sekce.
4. **Geocoding u vesnic kolabuje na střed obce.** 40 firem → jen 30 různých
   bodů, spousta přesně na 307 m. Vzdálenost je tak orientační.
   → U malých obcí brát vzdálenost jako přibližnou, nespoléhat na ni v bodování.

Důsledek: skóre se pohybovalo v úzkém pásmu 52–56 b, tedy **nerozlišuje**.
Než se pojede Plzeň, je potřeba tyhle čtyři věci opravit.

## MPSV volná místa — nejlepší zdroj provozoven (ověřeno 2026-07-27)

`https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json` — otevřená data
Úřadu práce. **U každého inzerátu je `zamestnavatel.ico` + `zamestnavatel.nazev`
a `mistoVykonuPrace.pracoviste[].adresa.obec.id` (RÚIAN kód obce).** To je přímý
signál „tahle firma má pracoviště tady", tedy to, co ARES nedá.

- **Filtry a `limit` v URL se ignorují** — vždy přijde celý balík: ~178 MB,
  39 438 inzerátů, stažení ~8 s. Nutno cachovat na disk a filtrovat lokálně.
- Výsledky testu: Bezdružice 5 zaměstnavatelů, Zbůch 6, Plzeň 342,
  Tlučná 0, Hrádek u Rokycan 0.
- Omezení: je to bodový signál — kdo zrovna nenabírá, tam není. Doplňkový
  zdroj, ne jediný.

## Kategorie počtu zaměstnanců — POZOR na kód „000"

Oficiální číselník se dá stáhnout:
`POST /ciselniky-nazevniky/vyhledat` s `{"kodCiselniku":"KategoriePoctuPracovniku"}`.
**`000` = „Neuvedeno", NIKOLI „bez zaměstnanců" — tou je až `110`.** Původní
mapování v `ares.ts` bylo kvůli tomu špatně. Správný číselník je v `src/res.ts`.

Ověření na 40 firmách z prvního běhu: 16× bez zaměstnanců, 21× neuvedeno,
2× 1–5, 1× 25–49 (město Bezdružice). **Skuteční zaměstnavatelé z MPSV nebyli
mezi nimi ani jednou** — potvrzuje, že hledání podle sídla je slepá cesta.

## Zdroje dat — ověřeno 2026-07-27 (klíčové pro návrh Čmuchala v2)

- **ARES zná jen SÍDLA, ne provozovny.** Sub-registr RŽP (`/ekonomicke-subjekty-rzp/{ico}`)
  vrací `zivnosti` a `adresySubjektu`, ale **žádné provozovny** (`provozovnyStav`
  je undefined). Zinkovna v Bezdružicích proto přes ARES nejde najít — v celém
  ARES je „zinkovna" jediná (Žárová zinkovna Bílina) a sídlí jinde.
  → Provozovny se musí hledat jinudy: fyzicky podle místa.
- **Počet zaměstnanců JE dostupný** — ale v sub-registru RES
  (`/ekonomicke-subjekty-res/{ico}` → `zaznamy[0].statistickeUdaje.kategoriePoctuPracovniku`),
  ne v základním detailu ani ve výsledku hledání. **Pozor: kód „000" je
  „neuvedeno", bez zaměstnanců je až „110" — viz sekce o číselníku výš.**
- **OpenStreetMap (Overpass API) funguje a najde reálná pracoviště**, která
  ARES minul: Léčebný Hotel Prusík, Lázeňský hotel Jirásek, KAPIC software,
  COOP, zdravotní středisko, restaurace. Zdarma, legální, bez klíče.
  Gotchy: hlavní server `overpass-api.de` často vrací **504** → použít mirror
  `overpass.kumi.systems`; dotaz držet úzký (velký radius + moc tagů = timeout);
  povinný slušný User-Agent s kontaktem.

## ARES — ověřeno reálnými dotazy 2026-07-26

- **Limit 1 000 výsledků** na `/ekonomicke-subjekty/vyhledat`. Nad limit vrací
  HTTP 400 `VYSTUP_PRILIS_MNOHO_VYSLEDKU`. **Plzeň má 49 831 subjektů → náš
  `najdiFirmyVObci` na velkých městech spadne.** Nutná strategie zúžení
  (městská část / NACE / ulice) — viz `docs/FAZE-0.md`, úkol pro S0.3.
- Filtr `sidlo` **nepodporuje** `nazevObce` ani `psc` — jen `kodObce`
  (číselný RÚIAN kód). Neznámý filtr se tiše ignoruje a API pak vrátí
  `VSTUP_PRAZDNY`, což mate — netvař se, že filtr funguje, dokud to neověříš.
- Kód obce se dá získat vyhledáním libovolného známého subjektu v obci
  (`obchodniJmeno`) — takhle jsme dohledali všech 5 škol.
- Počty subjektů v cílových obcích (vč. OSVČ a spolků): Bezdružice 212,
  Hrádek u Rokycan 450, Zbůch 556, Tlučná 745, Plzeň 49 831.

## Nominatim

- **Blokuje `example.com` v User-Agent → HTTP 403.** `NOMINATIM_CONTACT` musí
  být skutečná kontaktní adresa provozovatele, jinak geocoding nefunguje.

- **IČO checksum**: mod-11, váhy 8..2, kontrolní číslice `(11 − suma % 11) % 10`.
  Pozor: `00000001` je checksum-validní — reálnost firmy garantuje až ARES (TP-1).
- **ARES API**: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest`; vyhledávání
  dle `sidlo.kodObce` (POST /ekonomicke-subjekty/vyhledat, stránkuje se).
  Kód obce je hrubé síto (Praha = jedna obec) — jemný filtr dělá geocoding + zóna.
- **Nominatim**: tvrdý limit 1 req/s + povinný kontakt v User-Agent, jinak ban.
- **PGlite**: Postgres 17 ve WASM, testy běží offline; nepodporuje vnořené
  transakce (vnitřní `tx` sdílí vnější).
- **Windows/Git**: CRLF warningy jsou neškodné; nechat default autocrlf.
- **Enrichment náklady**: platí jen při provozu přes API. Rozhodnuto jinak —
  enrichment dělá agent v Claude Code na předplatném (viz rozhodnuti.md),
  takže mezní náklad je nula. `src/enrich.ts` (API cesta) zůstává jako
  varianta pro externího klienta; ceník claude-opus-4-8 $5/M in + $25/M out.
- **PGlite na disku**: `new PGlite(cesta)` si **nevytvoří vnořený adresář** —
  je potřeba `mkdir -p` předem (řeší `pripojPglite`). Datový adresář má i
  prázdný ~39 MB (běžná režie Postgresu), záloha = zkopírovat `data/`.

## Čmuchal v2 — výsledky přepisu (2026-07-27)

Porovnání na stejné jídelně (Bezdružice, kapacita 10):

| | v1 (podle sídla) | v2 (podle pracoviště) |
|---|---|---|
| kandidátů | 40 (z 212 v obci) | 5–31 podle dostupnosti OSM |
| kvalifikováno | 39 | 5–6 |
| z toho se zaměstnanci | 3 (a jedním bylo město) | všechny |
| rozpětí skóre | 52–56 (nerozlišovalo) | 36–71 |
| firmy sídlící jinde | 0 | 3 z 5 |

**Tři z pěti nalezených zaměstnavatelů sídlí mimo obec** (Hustopeče, 2× Praha) —
přesně ty, které hledání podle sídla nikdy nenajde.

### Gotchy z přepisu

- **Overpass je nespolehlivý.** Ze tří ostrých běhů uspěl jednou (28 pracovišť),
  dvakrát vrátil 502/504 na obou serverech. Nutné brát jako doplňkový zdroj —
  běh na něm nesmí stát. Řešeno: chyba zdroje se zapíše a běh pokračuje.
- **Párování názvů z mapy na rejstřík je slabé místo:** z 28 nalezených
  pracovišť se podařilo spárovat 4. Názvy v mapě jsou provozní („Prášková
  lakovna", „Léčebný Hotel Prusík", „COOP Potraviny"), ne obchodní firmy.
  → Tohle je úkol pro enrichment krok (dohledat IČO na webu), ne pro čistý kód.
- **Past při přechodu na MPSV:** kandidát z MPSV má známou obec pracoviště, ale
  adresu jen u sídla. Počítat vzdálenost od sídla ho vyřadí (firma sídlí v Praze,
  pracoviště je za rohem). Řešeno: nesouhlasí-li obec sídla s obcí pracoviště,
  bere se střed obce pracoviště a přibližnost se přizná v evidenci.
- Segmenty velikosti sjednoceny se SPEC (mikro/stredni/korporat), migrace 0003.

## Kalibrace hledání podle zpětné vazby majitele (2026-07-27)

Majitel prověřil prvních 5 nálezů: **2 správně, 2 agentury práce, 1 restaurace.**
Zároveň ručně (Mapy Google, Firmy.cz) našel 6 firem, které nám unikly.

### Co se opravilo

1. **Agentury práce.** MPSV je prozradí dvěma způsoby: příznakem
   `souhlasAgenturyAgentura`, a hlavně **názvem pracoviště** —
   „MSRCZ MARINA GLOBAL. s.r.o. (SIGNUM s.r.o.)" nebo „…, pracoviště
   Bezdružice, Signum s.r.o.". Skutečný zaměstnavatel se z názvu vytáhne
   a nasadí místo agentury.
2. **Vyloučené obory.** CZ-NACE 56 (stravování — restaurace si vaří samy)
   a 78 (agentury práce). Vyřadilo 26 subjektů včetně Café Kryštof Harant.
3. **Sweep rejstříku zapnut natrvalo**, ale jen s doloženými zaměstnanci.
   Sám o sobě je zašuměný (212 subjektů → 26 zaměstnavatelů), ale je to
   **nejúplnější seznam firem sídlících v obci** a našel oba nálezy majitele
   (KOVOVÝROBA HONZÍK 25–49 zam., ROLDECO).
4. **Strop sweepu byl 200, obec má 212** → ROLDECO vypadlo za hranou.
   Zvednuto na 1 000 (tvrdý limit samotného ARES).
5. **Geokódování vesnických adres selhává** („č.p. 137" bez ulice).
   Dřív se firma zahodila; nově se použije střed obce, je-li sídlo v naší
   obci — zachránilo 4 skutečné zaměstnavatele.
6. **Verzování cache MPSV.** Po přidání rozpoznávání agentur se načetl
   starý index bez nových polí a filtr tiše nefungoval. Index má teď
   `verze`; při změně formátu se zahodí. **Obecné poučení: každá cache
   odvozených dat potřebuje verzi formátu.**

### Výsledek na Bezdružicích

| | před kalibrací | po kalibraci |
|---|---|---|
| firem v kartotéce | 5 | 23 |
| z toho agentur | 2 | 0 |
| z toho restaurací | 1 | 0 |
| nálezy majitele nalezeny | 0 ze 6 | KOVOVÝROBA HONZÍK, ROLDECO |

### Co zbývá

- **Párování názvů z map na rejstřík je pořád slabé** (z 28 pracovišť z OSM
  se spárovalo pár). „Prášková lakovna" = LAK SERVIS, „Zdravotní středisko",
  „Penzion Mír"… → práce pro agenta, ne pro kód.
- ZP Servis a LAK SERVIS nemají na webu IČO a v rejstříku nejsou pod tím
  názvem — nejspíš OSVČ pod jménem majitele. Dohledatelné jen rešerší.
- Zvážit vyřazení SVJ (společenství vlastníků) — mají „zaměstnance", ale
  nikdo tam neobědvá.

## Průzkum obcí — kde jsou vůbec zajímavé firmy (2026-07-27)

Sweep + filtr na počet zaměstnanců přes všechny cílové obce. „Zajímavá" =
10 a víc zaměstnanců (mikrofirmy majitel označil za nezajímavé).

| obec | subjektů | bez zam. | 1–9 | 10–24 | 25–99 | 100+ | zajímavých |
|---|---|---|---|---|---|---|---|
| Bezdružice | 212 | 165 | 21 | 2 | 3 | 0 | **5** |
| Zbůch | 556 | 497 | 40 | 9 | 8 | 2 | **19** |
| Tlučná | 745 | 681 | 56 | 5 | 3 | 0 | **8** |
| Hrádek u Rokycan | 450 | 395 | 50 | 2 | 2 | 1 | **5** |
| Stříbro | >1000 | — | — | — | — | — | **nezjištěno** |
| Plzeň | 49 831 | — | — | — | — | — | **nezjištěno** |

Největší zaměstnavatelé mimo Bezdružice: MONTEFERRO HRÁDEK a.s. (200–249),
Centrum pobytových a terénních sociálních služeb Zbůch (100–199),
Obec Tlučná a ZŠ Tlučná (50–99), Město Hrádek (50–99).

**Stříbro i Plzeň překračují tvrdý limit 1 000 výsledků ARES** → bez zúžení
dotazu je sweep nepoužitelný. To je teď hlavní blokátor růstu.

**Poměr signál/šum je stabilní:** ~85 % subjektů v obci nemá zaměstnance nebo
je údaj neuvedený. Bez filtru je seznam obce k ničemu, s filtrem je nejlepší.

## Práh velikosti firmy (2026-07-27)

Majitel: mikrofirmy jsou málo zajímavé — práce s oslovením stejná, odběr
zlomkový. Zaveden `--min-zamestnancu`, výchozí **10**. Neuvedená velikost se
prahem neposuzuje (firma ze silnějšího zdroje projde). Zbůch: 36 firem
vyřazeno pod limitem, zůstalo 21 s reálnou velikostí.

## PGlite: dva procesy = tichá ztráta integrity (2026-07-27)

**Co se stalo:** běh na Tlučné jsem nechal doběhnout na pozadí, zatímco
předchozí (zabitý timeoutem) proces ještě držel stejný datový adresář.
Výsledek: **6 duplicitních IČO v `companies` navzdory primárnímu klíči**
(209 řádků, 203 unikátních). Index se porušil, PK přestal platit.

**Poučení:** PGlite je jednoprocesová databáze. Otevřít stejný datový adresář
ze dvou procesů = poškození, které se neprojeví chybou, ale tichým rozbitím
omezení. To je nebezpečnější než pád.

**Zavedeno:** soubor `.zamek` v datovém adresáři. Druhý proces dostane
srozumitelnou chybu místo toho, aby data rozbil. Zámek se uklidí i při
Ctrl+C a SIGTERM.

**Důsledek pro provoz:** až se přejde na sdílenou databázi pro víc lidí,
tenhle problém zmizí (Postgres je víceprocesový). Do té doby platí: **jeden
běh v jednu chvíli.**

## Poučení: vynucený údaj svádí k vymýšlení (2026-07-27)

`jidelny.kapacita_volna` byla `not null default 0` a Čmuchal odmítal běžet
bez kladné kapacity. Jenže kapacita **na výsledek hledání nemá vliv** — je to
obchodní strop, ne technická podmínka. Když jsem potřeboval spustit běh na
jídelnách, jejichž kapacitu nikdo neznal, **vymyslel jsem si čísla**, abych
se dostal přes vlastní podmínku. Majitel se správně zeptal, k čemu ten údaj
vůbec potřebuju.

**Pravidlo:** vynucuj jen to, bez čeho výsledek nedává smysl. Všechno ostatní
smí být NULL a NULL znamená „nevíme". Povinné pole, které nikdo nezná, se
dřív nebo později vyplní smyšlenou hodnotou — a ta se pak tváří jako fakt.

Kapacita se stane tvrdou podmínkou až u fronty na oslovení (fáze 3): tam
bez ní neodejde nic, protože slibovat obědy, které nemá kdo uvařit, je horší
než neoslovit.
