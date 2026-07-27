# Poznatky a gotchas

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
