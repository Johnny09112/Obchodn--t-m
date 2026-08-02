# Playbook — Čmuchal

Živý dokument agenta (SPEC 10.1). Čmuchal si ho smí upravovat sám, protože
neovlivňuje nic navenek. **Je to znalost, ne log** — kdo přesně neprošel a
proč, patří do tabulky `vyrazeni`, ne sem. CLI po běhu připojí jen poznatky,
které jsou obecné a ještě tu nejsou.

## Hlavní úkol

**Najít u firmy konkrétní osobu, na kterou se dá obrátit** — jméno, pozici,
telefon nebo e-mail. Stačí jeden z těch údajů, ale musí být doložený.

**Nikoho neoslovuješ, ani kvůli zjištění kontaktu.** Žádný telefon na
centrálu, žádný dotaz na `info@`. Kontakty se smí jen dohledávat ve veřejně
dostupných zdrojích (rozhodnutí majitele 2026-07-28).

## Měřítka (SPEC)

- podíl firem, u kterých je doložená konkrétní osoba
- podíl kontaktů úrovně 1 (poptávkové adresy)
- podíl firem s ověřeným stavem stravování

Poslední měření (dávka 20 firem, 2026-07-27): kontakt u 17 z 20, jmenná
osoba u 10, poptávková adresa u 4, stav stravování u 0 z 20.

Měření (zkušební dávka 20 firem z Plzně, 2026-08-02 — vzorek pro rozhodnutí
o zbylých ~600 firmách): kontakt (e-mail/telefon) doložen u **19 z 20** firem,
jediná bez nálezu byla EXTETO s.r.o. (bez jakékoli webové stopy). Poptávková
adresa úrovně 1 u **0 z 20** — vzorek (výroba, bytová družstva, spolky,
příspěvkové organizace města) adresy tohoto typu prakticky nemá, převažovala
úroveň 2. Jméno **shodné se známým jednatelem/statutárem z rejstříku
doplněné o e-mail nebo telefon** (přímé vyřešení „spojeni") u 8 z 20 firem.
Stav stravování doložen u 1 z 20, vlastní jídelna u 0 z 20.

## Odkud kontakty brát — pořadí podle výtěžnosti

Body 1 a 2 zajišťuje kód automaticky při sběru. Body 3 a dál jsou tvoje práce.

1. **Otevřená data MPSV** — u inzerátu je pole „komu se hlásit" se jménem,
   pozicí, e-mailem i telefonem. Zaměstnavatel to zveřejnil sám. Nejlevnější
   zdroj vůbec. Omezení: jen firmy, které nabírají. **Účel adresy je nábor,
   ne nabídky dodavatelů** — zapisuje se to a je to při schvalování vidět.
2. **Statutární orgán z veřejného rejstříku** — jméno a funkce prakticky ke
   každé s.r.o. a a.s. Zachránil i firmy bez webu (REVIANT, I.U.STAVBY).
   **Bere se jen jméno a funkce, nikdy datum narození ani bydliště.**
   U firmy do ~50 lidí je jednatel často ten pravý; u velké rozhodně ne.
3. **Stránka Kontakty / Vedení společnosti na vlastním webu firmy, hledaná
   cíleně podle JIŽ ZNÁMÉHO jména jednatele/statutára z rejstříku** — u firem
   s vlastním webem to byl nejrychlejší způsob, jak k jménu doplnit e-mail
   nebo telefon (dávka 2026-08-02: 8 z 20 firem takto). Efektivnější než
   hledat „nějaký kontakt" — hledej rovnou danou osobu.
4. **Sekce pro nabídky na webu firmy** — „cenové nabídky", „obchodní
   zástupci", „pro dodavatele". Dá kontakt úrovně 1, tedy ten nejlepší.
   Hledej ji cíleně; obecné „Kontakty" vedou na centrálu.
5. **Podstránka konkrétní provozovny** u firem s víc pobočkami
   (`/zinkovna/bezdruzice/`). Tam bývají místní lidé, ne ústředí.
6. **Sekce Tým, Vedení, O nás, tiráž.**
7. **Dokumenty ke stažení** — ceníky, katalogy, obchodní podmínky, formuláře.
   Bývá pod nimi podepsaný konkrétní člověk s přímým kontaktem.
8. **Web mateřské firmy**, když česká doména mlčí (MONTEFERRO: kontakt byl
   na `monteferro.it/network-contacts/`; stejně tak MEA Metal Applications
   měl českou kontaktní stránku až na `mea-metal.com/cs/kontakt/`, ne na
   samostatné `.cz` doméně, a schambeck bohemia na `schambeck-group.com`).
9. **Archiv webu** u firem, jejichž stránky už neexistují.

**Registr smluv se neosvědčil** — metadata nesou jen název, IČO, adresu a
datovou schránku, žádnou kontaktní osobu. Jména by byla až uvnitř PDF smluv.
Ověřeno 2026-07-28, nestavíme.

**LinkedIn a sociální sítě nikdy**, ani ke čtení. Platí i přes to, že jinak
je při hledání dovoleno prakticky vše.

**Odhadované adresy se neukládají.** Odvodit `jmeno.prijmeni@firma.cz` ze
vzoru je vymýšlení, které se v kartotéce tváří jako fakt.

**Adresa s účelem „objednávky" / „pro zasílání objednávek" není úroveň 1.**
Je to opačný směr než hledáme — příjem objednávek OD zákazníků, ne příjem
nabídek OD dodavatelů. Snadno se plete s `poptavky@`/`nabidky@`. Zapisuje
se jako `ucel_adresy`, kontakt se ale řadí do úrovně 2, ne 1 (ověřeno u
IMONT spol. s r.o. a TJ Slavoj Plzeň, 2026-08-02).

**Skupinový kariérní/firemní portál sdílený víc IČy pod jednou značkou**
(např. `kariera.ave.cz` pro celou skupinu AVE) se **nepřiřazuje ke
konkrétní dceřiné právnické osobě**, pokud stránka výslovně nejmenuje její
IČO nebo obchodní jméno — obecně formulovaný benefit nejde bezpečně doložit
ke konkrétnímu s.r.o./a.s. Radši nezapsat, i když je nález lákavý (rozdíl
oproti bodu 8 výše, kde web mateřské firmy popisuje přímo tu jednu dceřinou
firmu, ne celou skupinu najednou).

## Co funguje podle typu subjektu

| typ subjektu | co zabírá | co je slepé |
|---|---|---|
| Obce a města | stránka Kontakty s rozpisem podle agend; tajemník = nejbližší obdoba HR, podatelna = obecná adresa; odkaz z Kontaktů na **epusa.cz** (Portál veřejné správy) dá u jmenované osoby přímý e-mail, často označený „[oficiální]" | stravování zaměstnanců úřadu se neuvádí nikdy |
| Příspěvkové organizace města (zoo, divadlo, turismus, koncepční útvary) | vlastní stránka Kontakty s telefonním seznamem podle jmen a funkcí, obdoba úřadu — často jde dohledat přímo osobu odpovídající známému statutárovi z rejstříku | stravování zaměstnanců se na webu neřeší vůbec (ověřeno u zoo, divadla, turismu i ÚKR Plzně, 2026-08-02) |
| Bytová družstva (SBD) | stránka Kontakty bývá rozpadlá po jednotlivých pracovnicích/pracovnících se jmény, telefony i e-maily včetně předsedy představenstva | — |
| Výroba s víc provozy | podstránka provozovny; sekce obchodních zástupců | obecné Kontakty vedou jen na ústředí |
| Sociální a pobytová zařízení | konkrétní podstránka o stravě („Přihláška a odhláška stravy") | obecné „O nás" jen odkáže bez detailu |
| Školy | stránka školní jídelny (`/informace-sj`) doloží vlastní jídelnu | — |
| Nově vzniklé s.r.o. bez webu | statutární orgán z rejstříku | nulová webová stopa — stavební/podnikatelské portály i katalogy typu merk.cz nenašly nic navíc (ověřeno na I.U.STAVBY i EXTETO s.r.o.) |
| Spolky sdílející adresu s jinou organizací | **nevzdávej se u obecné stránky Kontakty** — hledej vlastní podstránku typu „Podpora a sponzoring", „Dary", „Výroční zpráva"; tam bývá kontakt na spolek samotný, oddělený od kontaktu na hlavní organizaci | obecná stránka Kontakty spolek často vůbec nezmíní — nedomýšlet, že sdílí kontakt s hlavní organizací, dokud to není doložené na jeho vlastní podstránce |
| Sportovní tělovýchovné jednoty (TJ, z.s.) | stránka Kontakty rozpadlá po funkcích (předseda/předsedkyně, ekonom, provozní manažer), i s mailem přímo na předsedu | pozor na adresu s účelem „objednávky" (rezervace haly apod.) — není totéž co poptávková adresa |
| Firmy vlastněné zahraniční skupinou | kontaktní stránka bývá na mezinárodní doméně mateřské firmy (`.com/cs/kontakt`), ne na samostatné české doméně; hledej podle jména skupiny | samostatná `.cz` doména často vůbec neexistuje |

## Technické fígle

- **Cloudflare-obfuskované e-maily** jdou přečíst přímým načtením syrového
  HTML — adresa bývá čitelná v `application/ld+json` markupu i tam, kde ji
  viditelný text maskuje.
- **JS-obfuskace e-mailů má i jiné podoby než Cloudflare** — skládání adresy
  z `data-` atributů přes `onclick`/JS (`data-jmeno`, `data-domena`,
  `data-pripona`, viz Leuze Engineering) nebo z HTML entit v JS proměnných
  (`'j&#97;k&#117;b...' + '&#64;' + ...`, viz Divadlo ALFA). Obojí čitelné
  přímo v syrovém HTML, jen je potřeba je poskládat ručně — nevzdávat se
  hned, když viditelný text žádnou adresu neukazuje.
- **Weby postavené na React/Next.js** (např. `ave.cz`) nesou kontakty jako
  strukturovaná JSON data přímo v HTML zdroji (`"emails":[{"email":...}]`),
  čitelná i bez vykreslení JS prostým stažením stránky a hledáním v
  syrovém textu.
- **Malé pracovní agregátory (nyransko.cz, volnamista.cz, volnamistaunas.cz)
  rychle expirují** — do pár měsíců až týdnů 404. Úryvek z vyhledávače
  nestačí, vždy ověřuj přímým načtením stránky, jinak zdroj do měsíce zmizí.
- **Katalogy třetích stran** (Firmy.cz, Živé firmy, RegionPlzeň) jsou
  poslední možnost — údaj tam může být roky starý. Označuj je jako slabší
  zdroj, ať je to při schvalování vidět.
- **Weby drobných firem na platformě webmium.com** ukazují kontakt jako
  součást stránky (pagelet) — funguje jak kořenová URL, tak `/kontakt`,
  obsah je stejný. Je to přímo web firmy, tedy lepší zdroj než firmy.cz,
  i když stránka vypadá provizorně.
- **Souhrny z WebSearch mohou halucinovat konkrétní údaje** (telefonní
  čísla, e-maily), které na cílové stránce vůbec nejsou — ověřeno u
  kurzy.cz, kde souhrn tvrdil telefon na osobu, ale přímé načtení stránky
  žádný telefon neobsahovalo. Telefon/e-mail se **nikdy nezapisuje jen
  z textového souhrnu vyhledávače** — vždy až po přímém načtení a nalezení
  doslovné citace na stránce.
- **IČO uvedené přímo v patičce/tiráži webu** je nejjistší způsob, jak
  potvrdit, že nalezený web opravdu patří firmě z rejstříku — obzvlášť
  když se provozní název domény liší od zapsaného obchodního jména
  (ověřeno u spravnyuklid.cz → Správná databáze s.r.o. a dazs.cz →
  Dopravní a záchranná služba s.r.o.).

## Vyjasněno

- **SIGNUM spol. s r.o. (IČO 18200061) je žárová zinkovna**, ne agentura
  práce. Dřívější podezření vzniklo záměnou s firmami MSRCZ MARINA GLOBAL
  a MARCIUS PLUS, které pro její bezdružický provoz najímaly pracovníky.
  Ty byly vyřazené správně, SIGNUM samo je kvalifikovaný cíl.

## Poznatky z běhů

(připojuje se automaticky — jen to, co je nové a obecné)

### Běh 2026-07-28 — dohledání spojení u 4 firem se známým jménem, bez kontaktu

- **Centrum Zbůch, z.s.** (22906291): telefon na předsedkyni Radku
  Prokešovou se nenašel na obecné stránce Kontakty (ta patří jen sesterské
  organizaci Centrum pobytových a terénních sociálních služeb Zbůch), ale
  na podstránce „Podpora a sponzoring", kde je zapsaný spolek uveden
  odděleně i s vlastním číslem účtu a kontaktem.
- **H.B. TEXTILIE, s.r.o.** (47719427): e-mail `hbtextilie@volny.cz`
  známý dřív jen z katalogu firmy.cz se potvrdil na vlastním webu firmy
  (webmium.com), kde navíc přibyl telefon.
- **Obec Tlučná** (00258385): jmenný e-mail na starostu se našel přes
  odkaz „Zaměstnanci OÚ a volené orgány obce" na stránce Kontakty, který
  vede na epusa.cz — detail osoby tam má pole Email označené „[oficiální]".
- **I.U.STAVBY s.r.o.** (11913991): bez webu, bez zmínky jako subdodavatel
  na cizích webech, bez záznamu v katalozích typu merk.cz — u firem tohoto
  typu (jednatel, kapitál 2000 Kč, žádná webová stopa) je statutární orgán
  z rejstříku zřejmě jediný dostupný údaj vůbec.

### Běh 2026-08-02 — zkušební dávka 20 firem z Plzně (referenční vzorek)

- **Cílené hledání stránky Kontakty/Vedení podle jména jednatele z
  rejstříku** se ukázalo jako nejvýnosnější jediný krok dávky — u 8 z 20
  firem (TUEBOR, DAZS, SBD Plzeň-sever, ÚKR Plzně, schambeck bohemia,
  TJ Slavoj, Divadlo ALFA, DRUSO) šlo přímo dohledat e-mail nebo telefon
  k JIŽ ZNÁMÉ osobě, čímž se rovnou vyřešila mezera „spojeni".
- **desseq.eu s.r.o. a schambeck bohemia s.r.o.**: názvy vypadají jako
  zahraniční/technická značka, ale obě mají funkční a dohledatelný web
  (`desseq.eu`, resp. `schambeck-group.com`) — nevzdávat se hledání jen
  proto, že jméno nezní jako běžná česká firma.
- **EXTETO s.r.o.** (02133130): žádný vlastní web ani v katalozích, ani
  ve vyhledávání — jediný dostupný údaj zůstává jednatel z rejstříku,
  který ale u této firmy nešlo obohatit o žádné spojení. Bez nálezu.
- **Poptávková adresa (úroveň 1) se u tohoto vzorku nevyskytla ani
  jednou** — vzorek byl výroba, bytová družstva, spolky a příspěvkové
  organizace, ne obchodní/dodavatelské firmy. Pro měřítko „podíl kontaktů
  úrovně 1" bude nutné počítat s tím, že u některých typů subjektů je
  reálně nedosažitelné, a nehodnotit to jako selhání rešerše.
