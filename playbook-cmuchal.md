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

Měření (dávka 20 firem, Hrobce/Židovice/Libotenice/Oleško, 2026-08-07 —
malé s.r.o., zemědělské a úklidové firmy plus 4 obce): kontakt doložen
u **13 z 20** firem, z toho jmenná osoba (úroveň 3, shodná se známým
jednatelem/starostou z rejstříku) u 7. Poptávková adresa úrovně 1 opět
**0 z 20**. Žádný z pěti sledovaných atributů kromě „spojeni" a jednou
„ucel_adresy" se nepodařilo doložit — u malých výrobních/zemědělských/
úklidových s.r.o. bez kariérní stránky nejsou informace o jídelně, směnném
provozu ani způsobu stravování veřejně vůbec zveřejňované.

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
10. **Nabídková stránka firmy na burze poptávek (epoptavka.cz apod.)** —
    když firma sama nabízí své služby/zboží na `dodavatele.epoptavka.cz`
    nebo obdobném tržišti, stránka nese telefon i web přímo od firmy a je
    to funkční náhrada, když má vlastní web rozbitý certifikát (viz níže).

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
IMONT spol. s r.o. a TJ Slavoj Plzeň, 2026-08-02). Stejná logika platí i pro
realitní/finanční poradenské firmy, kde je kontaktní formulář určený
zákazníkům („poskytneme vstupní konzultaci zdarma") — pořád je to poptávka
SMĚREM K firmě, ne od ní k dodavatelům, takže úroveň 2 (EVS Investment /
EVS Reality s.r.o., 2026-08-07).

**Skupinový kariérní/firemní portál sdílený víc IČy pod jednou značkou**
(např. `kariera.ave.cz` pro celou skupinu AVE) se **nepřiřazuje ke
konkrétní dceřiné právnické osobě**, pokud stránka výslovně nejmenuje její
IČO nebo obchodní jméno — obecně formulovaný benefit nejde bezpečně doložit
ke konkrétnímu s.r.o./a.s. Radši nezapsat, i když je nález lákavý (rozdíl
oproti bodu 8 výše, kde web mateřské firmy popisuje přímo tu jednu dceřinou
firmu, ne celou skupinu najednou).

**Dvě různé firmy na stejné adrese se stejným jednatelem mohou sdílet web
i telefon, ale ne e-mail** — nepřiřazuj automaticky kontakt jedné firmy
druhé jen podle shody adresy/osoby; drž se zdroje, který výslovně jmenuje
shodující se IČO (viz LITOUKLID/Proclean Facilities níže).

## Co funguje podle typu subjektu

| typ subjektu | co zabírá | co je slepé |
|---|---|---|
| Obce a města | stránka Kontakty s rozpisem podle agend; tajemník = nejbližší obdoba HR, podatelna = obecná adresa; odkaz z Kontaktů na **epusa.cz** (Portál veřejné správy) dá u jmenované osoby přímý e-mail, často označený „[oficiální]"; **risy.cz** (Regionální informační servis) je spolehlivá náhrada, když přímý web obce nejde načíst (spojení resetováno) nebo je nepřehledný | stravování zaměstnanců úřadu se neuvádí nikdy |
| Příspěvkové organizace města (zoo, divadlo, turismus, koncepční útvary) | vlastní stránka Kontakty s telefonním seznamem podle jmen a funkcí, obdoba úřadu — často jde dohledat přímo osobu odpovídající známému statutárovi z rejstříku | stravování zaměstnanců se na webu neřeší vůbec (ověřeno u zoo, divadla, turismu i ÚKR Plzně, 2026-08-02) |
| Bytová družstva (SBD) | stránka Kontakty bývá rozpadlá po jednotlivých pracovnicích/pracovnících se jmény, telefony i e-maily včetně předsedy představenstva/ředitele | — |
| Výroba s víc provozy | podstránka provozovny; sekce obchodních zástupců | obecné Kontakty vedou jen na ústředí |
| Sociální a pobytová zařízení | konkrétní podstránka o stravě („Přihláška a odhláška stravy") | obecné „O nás" jen odkáže bez detailu |
| Školy | stránka školní jídelny (`/informace-sj`) doloží vlastní jídelnu | — |
| Nově vzniklé s.r.o. bez webu | statutární orgán z rejstříku | nulová webová stopa — stavební/podnikatelské portály i katalogy typu merk.cz nenašly nic navíc (ověřeno na I.U.STAVBY, EXTETO s.r.o., znovu na dávce malých s.r.o. z Hrobce/Židovic 2026-08-07 i na čtyřech firmách z dávky 2026-08-13: ZPPL, GRANISAM, Zelw, Družstvo pro správu rekreačních objektů Šumava) |
| Spolky sdílející adresu s jinou organizací | **nevzdávej se u obecné stránky Kontakty** — hledej vlastní podstránku typu „Podpora a sponzoring", „Dary", „Výroční zpráva"; tam bývá kontakt na spolek samotný, oddělený od kontaktu na hlavní organizaci | obecná stránka Kontakty spolek často vůbec nezmíní — nedomýšlet, že sdílí kontakt s hlavní organizací, dokud to není doložené na jeho vlastní podstránce |
| Sportovní tělovýchovné jednoty (TJ, Sokol, z.s.) | stránka Kontakty rozpadlá po funkcích (předseda/předsedkyně, ekonom, provozní manažer), i s mailem přímo na předsedu; u jednot Sokol nese jmenovité kontakty (starostka, jednatel, náčelník) umbrella portál `sokol.eu` (`/sokolovna/<jednota>`), i když vlastní web jednoty žádnou osobu neuvádí; u menších oddílů může mít vlastní kontakt i trenér mládežnické přípravky na jeho podstránce, ne jen předseda | pozor na adresu s účelem „objednávky" (rezervace haly apod.) — není totéž co poptávková adresa |
| Firmy vlastněné zahraniční skupinou | kontaktní stránka bývá na mezinárodní doméně mateřské firmy (`.com/cs/kontakt`), ne na samostatné české doméně; hledej podle jména skupiny | samostatná `.cz` doména často vůbec neexistuje |
| Malé rodinné s.r.o. (řemeslo, zemědělství, úklid) s jedním jednatelem | katalogy typu info-cechy.cz, ifirmy.cz, zlatestranky.cz, ceskestavby.cz nebo nabídková stránka na epoptavka.cz často nesou telefon/e-mail přímo od firmy, i když vlastní web chybí nebo má rozbitý certifikát; hledej podle jednatele i podle „provozního" jména firmy (může se lišit od zapsaného obchodního jména) | vlastní web, pokud existuje, bývá jen vizitka bez zmínky o stravování/směnách/jídelně |
| Firma provozující e-shop/bistro/penzion pod úplně jiným obchodním jménem, než je zapsaná s.r.o. | ověř shodu přes IČO v patičce/obchodních podmínkách/kontaktu cíleného webu — vede k obor i kontaktu, i když název domény s obchodním jménem vůbec nesouvisí (funguje stejně u e-shopů i u penzionů/resortů, viz Penzion Jezerní s.r.o. → `jezerni.cz` / „Resort Jezerní", 2026-08-13) | hledání podle doslovného obchodního jména firmy samotného často nic nenajde, protože firma komunikuje pod jiným brandem; a pokud web na jméno nesedí a IČO nikde nejde ověřit, nepřiřazovat i přes lákavou shodu jména provozovny |
| Krajské soudy, magistráty a další velké veřejné instituce | způsob stravování (příspěvek/stravenky) bývá zveřejněný v jednotlivých inzerátech volných pozic na pracovních portálech (jenprace.cz, vlastní portál typu prace.plzen.eu), ne na obecné stránce Kontakty/O úřadu | obecná stránka Kontakty u velkých institucí stravování nikdy nezmiňuje |
| Katastrální úřady (ČÚZK) | oficiální stránka úřadu na cuzk.gov.cz uvádí jméno a funkci ředitele/ředitelky spolu s obecným e-mailem a telefonem pracoviště | — |
| Lékařská s.r.o. jednoho lékaře (ordinace vedená jako s.r.o.) | katalogy lékařů (kataloglekaru.cz, tvuj-lekar.cz) doloží obor i telefon, shodu s hledaným IČO ale potvrď přes shodu adresy sídla z rejstříku — katalog může uvádět jiné IČO téhož lékaře jako OSVČ | vlastní web s.r.o. u jednoosobové ordinace zpravidla neexistuje; ordinační hodiny (pro `smenny_provoz`) na katalogu lékařů často chybí i tam, kde je telefon uveden |
| Jednoosobová ordinace/OSVČ v malé obci s vlastním jednoduchým webem (např. `jméno-lékaře.cz`) | vlastní web nese shodně obor i ordinační hodiny jako katalogy (kataloglekaru.cz, zlatestranky.cz, firmy.cz) — ordinační hodiny fungují jako doklad `smenny_provoz` | stravování/vlastní jídelna nedoložitelné u tohoto typu subjektu prakticky nikdy |

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
  i když stránka vypadá provizorně. **Není to ale spolehlivé vždy** — u
  `extrarentsro.webmium.com` se stránka opakovaně nedala načíst
  (ECONNRESET, 2026-08-13), takže bez přímého načtení nešlo doložit citaci.
- **Souhrny z WebSearch mohou halucinovat konkrétní údaje** (telefonní
  čísla, e-maily, ale i celé věcné popisy činnosti firmy) které na cílové
  stránce vůbec nejsou — ověřeno u kurzy.cz, kde souhrn tvrdil telefon na
  osobu, ale přímé načtení stránky žádný telefon neobsahovalo; podobně u
  „Infinity Avenue s.r.o." souhrn vymyslel popis činnosti („nabízí investiční
  nemovitosti mimo běžné portály"), který se nepodařilo dohledat na žádné
  indexované stránce (2026-08-07). Telefon/e-mail/popis se **nikdy
  nezapisuje jen z textového souhrnu vyhledávače** — vždy až po přímém
  načtení a nalezení doslovné citace na stránce. Stejně tak katalogové
  stránky, kde přímé načtení skončí chybou (404/403), se nesmí nahradit
  jen souhrnem z vyhledávače (VH-HRBEK/BROM TRANS níže — nakonec šlo o
  záměnu IČO, kterou odhalilo právě přímé načtení). **Riziko je i
  jednosměrné jinak:** katalogový profil dohledaný přes odkaz z výsledků
  hledání může po přímém načtení patřit úplně jiné firmě na stejné adrese
  (GAFLOR GROUP s.r.o. → firmy.cz profil se stejným ID ukázal při načtení
  „Master Bull s.r.o." se svým vlastním e-mailem, 2026-08-13) — kontrola
  shody jména/IČO se dělá až po přímém načtení, ne podle URL nebo popisku
  ve výsledcích hledání.
- **IČO uvedené přímo v patičce/tiráži webu** je nejjistší způsob, jak
  potvrdit, že nalezený web opravdu patří firmě z rejstříku — obzvlášť
  když se provozní název domény liší od zapsaného obchodního jména
  (ověřeno u spravnyuklid.cz → Správná databáze s.r.o., dazs.cz →
  Dopravní a záchranná služba s.r.o., a evsinvestment.cz → EVS Reality
  s.r.o., kde patička výslovně uváděla „IČ: 06943586" pod jiným, marketingovým
  jménem „EVS Investment s.r.o."; podobně tafarma.cz → Vitafarm, s.r.o.,
  obchodní podmínky na z-therapy.cz → Z - Therapy s.r.o., a jezerni.cz
  („Resort Jezerní") → Penzion Jezerní s.r.o., 2026-08-13). Stejně tak
  katalogový profil s odkazem přímo na ARES podle hledaného IČO (ne jen
  textem, ale hypertextovým odkazem na `wwwinfo.mfcr.cz/.../darv_res.cgi?
  ico=...`) je stejně silné potvrzení jako patička vlastního webu —
  ZlatéStránky.cz to dělá u profilu obchodu vedle e-mailu a webu firmy
  (DIFFERENT FASHION s.r.o., 2026-08-13).
  Katalogové profily (zlatestranky.cz, ceskestavby.cz apod.) totéž IČO
  často uvádějí přímo v odkazu na ARES v rámci profilu — funguje jako
  stejně silné potvrzení, i když jde o katalog, ne vlastní web. **Platí i
  obráceně jako varování:** když patička webu uvádí JINÉ IČO, než hledáme,
  web nepatří naší firmě, i kdyby adresa i jméno domény byly nápadně
  podobné (izofill.cz → IZOFILL-A s.r.o. IČO 45356297, ne hledaná IZOFILL
  v.o.s. Plzeň IČO 00518565, 2026-08-13).
- **Rozbitý/neshodující se TLS certifikát blokuje přímé načtení** u řady
  malých firemních webů (ověřeno na benacz.cz, azfirma.cz, pro-clean.cz,
  a i na doméně řetězce se zavedenou značkou different.cz — chyba „unable
  to verify the first certificate" i na `www.` variantě). Funkční náhrada:
  nabídková stránka firmy na tržišti typu `dodavatele.epoptavka.cz`, kde
  firma sama zveřejnila telefon/web, nebo katalogový výpis (kurzy.cz
  rejstrik-firem, info-cechy.cz, zlatestranky.cz) — ale jen pokud výslovně
  uvádí shodné IČO, ne jen podobné jméno. **Chyba certifikátu může být i
  úplně jiná** — u `salonrelaxa.eu` šlo o hostname/altnames mismatch
  (certifikát patřil sdílenému hostingu `mujhost.net`, ne dané doméně) —
  stejný důsledek (bez přímého načtení žádná citace), ale jiná příčina než
  „unable to verify the first certificate" (2026-08-13). **Některé weby
  blokují WebFetch úplně (HTTP 403), na všech podstránkách i protokolech**
  (roldeco.cz, habla.cz, sanitaceservis.cz — vyzkoušeno kořen, `/kontakt`,
  `/o-nas`, s/bez `www.`, i `http://`, vše 403, 2026-08-13) — na rozdíl od
  certifikátové chyby jde zjevně o blokaci User-Agentu/bota. Funkční
  náhrada je stejná: konkrétní podstránka katalogu vázaná na dané IČO.
- **Dvě obce se stejným názvem** existují na více místech ČR zároveň
  (Židovice v okrese Jičín i v okrese Litoměřice) a jejich domény si můžou
  být nápadně podobné (`obeczidovice.cz` vs. `zidovice.cz`) — před citací
  vždy ověřit, že adresa/okres na stránce sedí s obcí ze zadání, ne jen
  podle názvu domény. **Stejné riziko platí i u spolků se stejným/podobným
  jménem na katalogových stránkách** — firmy.cz u regionální pobočky spolku
  dokázal uvést IČO celostátní centrály místo IČO hledané pobočky, přestože
  adresa i telefon na stránce seděly (Český svaz bojovníků za svobodu
  Plzeň, 2026-08-13) — kontakt z takového zdroje použít jen po ověření
  druhým zdrojem, který u něj výslovně uvádí shodné IČO. **Stejné riziko i
  u dvou firem se stejnou adresou a podobným názvem, kde jedna je vlastníkem
  druhé** — „Profesní sdružení - Sanitace nápojových cest" (IČO 22752790) a
  jí 100% vlastněná SANITACE SERVIS s.r.o. (IČO 25210505) sídlí na stejné
  adrese v Bezdružici a mají téměř totožný popis činnosti, ale katalogové
  kontakty (sanitacegastro.cz) patří výslovně jen mateřskému sdružení, ne
  dceřiné s.r.o. — bez zdroje jmenujícího přímo IČO 25210505 kontakt
  nepoužít (2026-08-13).
- **Automatizovaná extrakce textu z nepřehledně strukturovaných stránek
  (např. staré Webnode weby) může být nestabilní** — opakované načtení
  téže stránky (`olesko.cz/kontakt/`) přiřadilo stejné telefonní číslo
  jednou starostovi, podruhé místostarostce. Když se výsledek mezi pokusy
  liší, nezapisovat konkrétní jméno+telefon, spokojit se s tím, co zůstává
  stabilní (typicky obecný e-mail).
- **Nástroj na načítání stránek se umí zaseknout na nekonečné redirect
  smyčce http/https** u starších webů se starým hostingem (ověřeno na
  `jamil.cz`, kde `https://` přesměruje na `http://` a další pokus s
  `http://` tutéž stránku vrátí znovu jako „redirect na http://") — i na
  chybě spojení/certifikátu (`centrumplzen.cz`, `akjanak.com`), přestože
  stránka evidentně existuje a je indexovaná ve vyhledávači i s konkrétním
  telefonem/e-mailem v souhrnu. Bez přímého načtení nejde doložit povinná
  doslovná citace, takže takový kontakt musí zůstat bez nálezu, i když je
  vysoce pravděpodobně správný — zkusit ještě variantu bez `www.` a
  konkrétní podstránku (ne kořen), ale pokud to nepomůže, nevymýšlet
  citaci z toho, co ukázal jen souhrn vyhledávače.
- **Generický předmět podnikání z katalogů rejstříku** — „výroba, obchod
  a služby neuvedené v přílohách 1 až 3 živnostenského zákona" — nemá jako
  `obor` žádnou vypovídací hodnotu (jde o univerzální živnostenský rámec,
  který má skoro každá s.r.o.) a nezapisuje se. Konkrétnější formulace ve
  stejném rejstříkovém zdroji („provádění staveb, jejich změn a
  odstraňování", „pronájem nemovitostí, bytů a nebytových prostor", „správa
  budov", „výroba textilií, textilních výrobků, oděvů a oděvních doplňků",
  „zemědělská a živočišná výroba", „poskytování zdravotních služeb") už
  vypovídací hodnotu má a stojí za zápis, pokud jinde vlastní web chybí —
  je to slabší zdroj než firemní web (je to katalog/rejstřík, ne „vlastními
  slovy" popis), ale lepší než žádný nález (ověřeno u PENTA, spol. s r.o.,
  4GLW s.r.o., GAFLOR GROUP s.r.o. a SOMATICA s.r.o., 2026-08-13). **Stejné
  pravidlo platí i u katalogů třetích stran mimo přímý rejstřík** — konkrétní
  popis oboru z Centrum.cz/najisto.centrum.cz (např. „Čištění fasád, dlažeb,
  chodníků, střech a ostatních povrchů. Odstranění graffiti. Čištění hrobů.")
  stojí za zápis stejně jako konkrétní formulace z rejstříku, dokud vlastní
  web chybí (EXTRARENT s.r.o., 2026-08-13). **Když firma má víc předmětů
  podnikání zapsaných najednou, generický a konkrétní pohromadě, zapisuje
  se jen ten konkrétní** — STauEuro s.r.o. má zapsané „výroba, obchod a
  služby..." i „pronájem nemovitostí, bytů a nebytových prostor" zároveň;
  do nálezu jde jen ta druhá formulace (2026-08-13). **Podstránka
  `/zivnosti/` na rejstrik-firem.kurzy.cz** dá u firem s generickým hlavním
  předmětem podnikání konkrétnější seznam jednotlivých oborů činnosti, než
  nabízí hlavní stránka — u Lucie Šaškové (14253577, OSVČ) odhalila
  „zastavárenská činnost a maloobchod s použitým zbožím" navíc k obecné
  „výroba, obchod a služby..." (2026-08-13). Stojí za to zkusit tuhle
  podstránku vždy, když hlavní stránka dá jen boilerplate.
- **Firmy založené ve stejný den, na stejné adrese, se stejným statutárem
  a generickým předmětem podnikání, bez jakéhokoli katalogového záznamu,
  jsou typicky „shelf company"** (prázdná s.r.o./a.s. koupená přes
  zprostředkovatele zakládání firem a dál nevyužívaná) — u tohoto vzorce
  (PFRD s.r.o., PAMT s.r.o., PAMR s.r.o. — shodná adresa Františkánská
  118/3 Plzeň i shodná jednatelka; PANTA REI, a.s. — shodné datum založení
  25.–27. 2. 2013 a stejně generický předmět, i když jiná adresa a jiní
  statutáři) nemá smysl hledat dál než rejstřík; žádná webová stopa u nich
  reálně neexistuje (2026-08-13). **Stejná jednatelka a adresa se objevily
  znovu u dalších dvou firem** — Lizard jeans s.r.o. a Deepness s.r.o.
  (obě Hana Černá Bošková, Františkánská 118/3, obě zapsané jen s
  generickým předmětem podnikání) — vzorec „jedna osoba spravuje víc
  prázdných s.r.o. na stejné adrese" je zjevně širší než jen ty čtyři
  firmy z 2026-08-13 (potvrzeno týž den, dávka G).
- **Sdílené sídlo a jednatel nemusí nutně znamenat shelf company** — Face
  & Bodyline Etage s.r.o. a STauEuro s.r.o. sdílejí sídlo (Šafaříkovy sady
  2455/5, Plzeň) i jednatele (Mgr. Martin Zikmund), ale obě mají v rejstříku
  zapsaný konkrétní, ne-generický předmět podnikání (zdravotní/masérské
  služby, resp. pronájem nemovitostí) — rozlišuj podle toho, jestli je
  předmět podnikání generický, ne jen podle shody adresy/osoby (2026-08-13).
  **Stejný vzorec platí i u tří firem v Bezdružici** (Bezdružice 288,
  jednatelka Bc. Eva Čížková): ROLDECO spol. s r.o. a Habla CZ, s.r.o. mají
  konkrétní předmět (výroba chemických čisticích přípravků) a oba mají
  funkční web i kontakt, zatímco SANITACE SERVIS s.r.o. má zapsaný jen
  generický předmět a žádný vlastní web/kontakt se nenašel (2026-08-13).
- **Firma s insolvenčním likvidátorem („v likvidaci") nemá smysl dál
  obohacovat o kontaktní osobu** — likvidátor je externí subjekt (typicky
  „Společná kancelář insolvenčních správců, v.o.s." nebo podobná firma),
  ne zaměstnanec původní firmy, a rejstřík ho uvádí jako statutární orgán
  místo původního jednatele. Obor/adresu z rejstříku pořád zapisovat lze,
  ale další hledání kontaktu osoby už nemá smysl (UNI INVEST GROUP s.r.o.
  v likvidaci, 2026-08-13).
- **Kontakt vázaný na konkrétní IČO se použil, i když e-mail jménem
  neodpovídal jménu podnikatele** (Lucie Šašková, IČO 14253577 →
  `sasekmira@seznam.cz` dle rejstrik-firem.kurzy.cz stránky vázané přímo na
  její IČO) — jméno v e-mailové adrese se nedomýšlí ani neopravuje, bere se
  jen fakt, že zdroj tenhle e-mail výslovně přiřazuje ke shodujícímu se IČO;
  zapisuje se jako úroveň 2 (obecná adresa), ne úroveň 3, protože jmennou
  shodu nejde potvrdit (2026-08-13).

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

### Běh 2026-08-07 — 20 firem a obcí z okolí Hrobce/Židovic/Libotenic/Oleška

- **LITOUKLID s.r.o. (05594260) a Proclean Facilities s.r.o. (08940096)**:
  stejná adresa (Oleško 38), stejná jednatelka Šárka Dreslerová, stejný web
  `www.pro-clean.cz` a stejné telefonní číslo, ale KAŽDÁ firma má jinou
  e-mailovou adresu podle zdroje, který výslovně jmenuje její IČO
  (LITOUKLID → `dreslerova.sarka@seznam.cz` dle info-cechy.cz; Proclean
  Facilities → `info@pro-clean.cz` dle kurzy.cz rejstřík firem s uvedenou
  datovou schránkou). Nepřiřazovat kontakt podle shody adresy/osoby, ale
  podle explicitní shody IČO u zdroje.
- **Obec Židovice — pozor na záměnu se stejnojmennou obcí v jiném okrese**:
  `obeczidovice.cz` je oficiální web Židovic v okrese Jičín, ne hledané
  obce v okrese Litoměřice (IČO 00526479). Správný web je `zidovice.cz`.
  Bez kontroly adresy/okresu na stránce hrozí zápis kontaktu ke špatnému IČO.
- **U šesti z dvaceti firem (malé s.r.o. s jedním jednatelem, základní
  kapitál řádově 10-20 tis. Kč, žádná vlastní provozovna)** se nenašla
  žádná webová stopa nad rámec rejstříku ani v katalozích — potvrzuje to
  vzorec z EXTETO/I.U.STAVBY: Sejeto s.r.o., Infinity Avenue s.r.o.,
  NORDIC TECHNOLOGY GROUP spol. s r.o., Small Wonders s.r.o.,
  PORTA BOHEMICA EUROPE s.r.o. v likvidaci, SaJeTe s.r.o.
- **Atributy `ma_vlastni_jidelnu`, `smenny_provoz` a `zpusob_stravovani`
  se u malých výrobních/zemědělských/úklidových s.r.o. bez kariérní
  stránky nepodařilo doložit ani jednou z dvaceti** — na rozdíl od obcí,
  kde je to očekávaně slepé, tady prostě tento typ firmy takové informace
  veřejně nezveřejňuje vůbec (vlastní web bývá jen jednostránková vizitka).

### Běh 2026-08-13 — 25 firem z Plzně, Hrádku, Tlučné a Zbůchu (obor/web/spojeni)

- **Shodu doménového jména s obchodním jménem nelze předpokládat — vždy
  ověřit IČO na cílové stránce.** Vitafarm, s.r.o. provozuje web na úplně
  jiné doméně `tafarma.cz` (bistro/rozvoz obědů) a potvrzení dala až věta
  v patičce „Provozovatel: Vitafarm, s.r.o., IČO: 02869756". Podobně
  Z - Therapy s.r.o. má web `z-therapy.cz`, ale kontaktní e-mail vede na
  úplně jiný eshopový brand (`info@supertejpy.cz`) — shodu IČO potvrdily
  až obchodní podmínky e-shopu. Bez tohoto kroku hrozí přiřazení cizího
  webu jiné firmě.
- **Katalogová stránka se zveřejněnými ordinačními/otevíracími hodinami**
  (u zdravotnických zařízení typicky regionplzensko.cz, kataloglekaru.cz
  apod.) šla použít jako doklad `smenny_provoz` (jednosměnný provoz) i u
  OSVČ/s.r.o. bez vlastního webu — funguje obdobně jako firemní kariérní
  stránka u velkých firem.
- **Vzorek 25 malých plzeňských s.r.o. s IČO řady 02xxxxxx–03xxxxxx
  (rok vzniku většinou 2014)** potvrzuje dřívější pozorování u malých
  s.r.o.: 14 z 25 nemělo dohledatelný žádný vlastní web ani kontakt nad
  rámec rejstříku (INDBau DESIGN, 3 COOOL, INDEXO Plzeň, PRONAKON TRADE,
  MQM, Importex Service a dále mimo Plzeň GALAXY STAVBY, TROFLIM, HUK STAV,
  ŽULASTAV, Jedlička s.r.o., Miriama Blašková, Miroslav Škoda, JAMIL CITY
  LIGHT czech s.r.o.). Katalog Živéfirmy.cz u řady z nich explicitně
  přiznává „U této firmy nám zatím chybí spolehlivé kontaktní údaje" —
  rychlý signál, že další hledání už nemá smysl.
- **Poptávková adresa úrovně 1 se opět nevyskytla ani jednou** — vzorek
  (zdravotnictví, bistro, ocelové konstrukce, pojišťovací zprostředkovatel,
  autobazar, advokátní kancelář, e-shopy, doprava, sportovní klub, hudební
  škola) je typově zákaznicky orientovaný, ne dodavatelský; kontakty byly
  převážně úroveň 2 (obecný info@), výjimečně úroveň 3 u jednoosobových
  provozů nebo jmenovitě uvedených vedoucích osob.

### Běh 2026-08-13 (dávka B) — 25 firem z Plzně, Hrádku, Tlučné, Zbůchu a Křelova-Břuchotína

Jiná dávka téhož dne, IČO se s dávkou výše nepřekrývají. 10 z 25 firem s
doloženým nálezem (obor, web, kontakt nebo způsob stravování u dvou
veřejných institucí), 15 bez nálezu — z toho většina OSVČ/malých s.r.o. bez
jakékoli webové stopy nad rámec rejstříku, opět v souladu s dřívějším
pozorováním u firem tohoto typu.

- **Katalogy typu zlatestranky.cz a ceskestavby.cz fungují jako plnohodnotná
  náhrada vlastního webu u OSVČ řemeslníků** (elektrikář, zahradník) — nesou
  potvrzené IČO, krátký popis oboru i firemní e-mail/telefon, přestože OSVČ
  žádný vlastní web nemá. Pro `obor` i `spojeni` u tohoto typu subjektu je to
  nejrychlejší funkční zdroj.
- **Shoda jména osoby a obce v katalogu není dostatečná — vždy ověřovat
  shodu IČO.** VH-HRBEK s.r.o. (07490038, jednatel Václav Hrbek) má na
  firmy.cz zavádějící záznam na OSVČ Václav Hrbek s jiným IČO (72237082),
  jiným oborem (prodej pracovních oděvů) a poznámkou „firma již není
  aktivní". Stejně tak BROM TRANS s.r.o. (03442713, jednatelé manželé
  Bromovi) vede na OSVČ Jiří Brom s jiným IČO (69931216) a jinou adresou —
  jde o samostatné podnikání téže fyzické osoby vedle role jednatele, ne o
  firmu ze zadání. V obou případech zůstala firma bez nálezu, i když
  „nějaký" Hrbek/Brom kontakt dohledatelný byl.
- **Provozovna stejného jména na jiné adrese než sídlo firmy může být úplně
  jiný subjekt.** Chalupa na schůdkách s.r.o. (02347776, sídlo
  Křelov-Břuchotín) má funkční web `testchalupa.webnode.cz` popisující
  restauraci ve Svatém Kopečku u Olomouce — nápadně podobné provoznímu
  jménu, ale na webu se nepodařilo najít IČO 02347776 ani na úvodní
  stránce, ani v kontaktu, ani v (neexistujících) obchodních podmínkách.
  Bez téhle shody zůstala firma bez nálezu, přestože nález působil lákavě.
- **Způsob stravování u velkých veřejných institucí (krajský soud, městský
  magistrát) se dá doložit z jednotlivých inzerátů volných pozic**
  (jenprace.cz, vlastní pracovní portál typu `prace.plzen.eu`) — na konci
  inzerátu bývá heslovité shrnutí benefitů („příspěvek na stravování",
  „stravenky, flexi passy"). Obecná stránka Kontakty/O úřadu takovou
  informaci neobsahuje vůbec — hledat rovnou v inzerátech.
- **ČÚZK (katastrální úřady) uvádí jméno a funkci ředitele/ředitelky přímo
  na oficiální stránce úřadu** (cuzk.gov.cz) spolu s obecným e-mailem a
  telefonem pracoviště — funkční zdroj kontaktu i tam, kde rejstřík/
  `znameOsoby` žádnou osobu nenabídl.

### Běh 2026-08-13 (dávka C) — 10 firem/spolků z Plzně (skóre 27, různorodý vzorek)

Malá dávka (10 IČO): 5 s doloženým nálezem a/nebo kontaktem (Sokol Plzeň V,
Lidové bytové družstvo v Plzni, PENTA spol. s r.o., PRESAL 97 s.r.o.,
Oblastní organizace ČSBS Plzeň), 5 zcela bez nálezu (Družstvo pro správu
rekreačních objektů Šumava, Zelw s.r.o., IZOFILL v.o.s. Plzeň, ZPPL s.r.o.,
GRANISAM s.r.o.).

- **Umbrella portál `sokol.eu` (rozcestník `/sokolovna/<jednota>` České obce
  sokolské) nese jmenovité kontakty** na starostku/jednatele/náčelníky
  jednotlivých tělovýchovných jednot Sokol, včetně e-mailu a telefonu —
  tam, kde vlastní web jednoty (pokud vůbec existuje) žádnou osobu neuvádí.
  Funguje jako lepší zdroj než katalog firmy.cz, protože jmenuje konkrétní
  funkci (starostka, jednatel, náčelník), ne jen obecný telefon.
- **Shoda adresy a telefonu nestačí, když se IČO na zdroji neshoduje —
  platí i u spolků, ne jen u firem.** Firmy.cz u „Český svaz bojovníků za
  svobodu Plzeň" uvádí IČO 00442755 (celostátní organizace v Praze), ne
  hledané IČO 00424218 (oblastní organizace), přestože adresa i telefon na
  stránce sedí. Telefon šlo použít až po ověření druhým zdrojem
  (zlatestranky.cz), který u telefonu výslovně uvádí shodné IČO 00424218;
  e-mail z neshodujícího se zdroje se nepoužil.
- **Doména podobného/stejného jména může patřit jiné firmě i u v.o.s.
  vedle s.r.o. se shodnou adresou.** `izofill.cz` patří IZOFILL-A s.r.o.
  (IČO 45356297), ne hledané IZOFILL v.o.s. Plzeň (IČO 00518565) — sdílí
  adresu i téměř identické jméno, ale patička webu uvádí jiné IČO. U v.o.s.
  samotné žádný vlastní web ani kontakt nešel dohledat (zivefirmy.cz
  otevřeně přiznává „U této firmy nám zatím chybí spolehlivé kontaktní
  údaje").
- **Generický předmět podnikání z katalogů (kurzy.cz apod.) — „výroba,
  obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona" —
  nemá jako `obor` žádnou vypovídací hodnotu a nezapisuje se.** Konkrétnější
  formulace ve stejném zdroji („provádění staveb, jejich změn a
  odstraňování", „pronájem nemovitostí, bytů a nebytových prostor") už
  stojí za zápis, pokud jinde vlastní web chybí — u čtyř z deseti firem v
  této dávce (ZPPL, GRANISAM, Zelw, Družstvo pro správu rekreačních
  objektů Šumava) žádný vlastní web/kontakt nad rámec rejstříku neexistoval
  vůbec, potvrzuje to vzorec z předchozích dávek malých s.r.o. bez webu.

### Běh 2026-08-13 (dávka D) — 10 firem z Plzně (skóre 27, shodné `chybi`)

10 firem se shodným seznamem `chybi` (jídelna/obor/směny/účel adresy/web/
stravování/spojení) a prázdným `znameOsoby`. 5 s doloženým nálezem a/nebo
kontaktem (Penzion Jezerní s.r.o., 4GLW s.r.o., GAFLOR GROUP s.r.o.,
Nábytek Brückl spol. s r.o., SOMATICA s.r.o.), 5 zcela bez nálezu
(TechManagement s.r.o., Picturelise s.r.o. v likvidaci, Print-media
Koncept s.r.o., Žaneta Pospíšilová s.r.o., MIKO AGENCY s.r.o.).

- **Katalogový redirect/profil může tiše podstrčit kontakt JINÉ firmy sídlící
  na stejné adrese.** Firmy.cz vedený pod ID GAFLOR GROUP s.r.o. (02038978)
  po přímém načtení ukázal profil firmy „Master Bull s.r.o." na téže adrese
  (Pražská 79/5, Plzeň) s jejím vlastním e-mailem `@master-bull.cz`. WebSearch
  souhrny přitom opakovaně tvrdily, že jde o e-mail `@gaflor-group.cz` —
  teprve přímé načtení stránky odhalilo, že patří jiné firmě. Nepoužívat
  kontakt, dokud zdroj výslovně nejmenuje hledané IČO/obchodní jméno, i když
  katalogové ID vypadá jednoznačně.
- **Lékařská s.r.o. jednoho lékaře může mít na katalogových stránkách
  (tvuj-lekar.cz) uvedené jiné IČO, patřící témuž lékaři jako OSVČ.**
  U SOMATICA s.r.o. (01945700, MUDr. Petr Sinkule) tvuj-lekar.cz vedl na
  „Interní ordinace" IČO 45334536 — jinou právnickou osobu téže osoby.
  Kontakt/obor se nakonec potvrdil jiným zdrojem (kataloglekaru.cz), kde
  shoda adresy sídla („Nádražní 310/28, Plzeň") s adresou v rejstříku
  fungovala jako náhrada za chybějící přímé uvedení IČO.
- **Obchodní jméno provozovny se může zásadně lišit od zapsaného jména
  firmy i u penzionů/resortů, ne jen u e-shopů.** Penzion Jezerní s.r.o.
  provozuje web pod značkou „Resort Jezerní" na doméně `jezerni.cz`, ale
  stránka Kontakt v patičce výslovně uvádí „Penzion Jezerní s.r.o." a IČO
  01978233 — stejný vzorec jako dřív u tafarma.cz/Vitafarm, funguje i mimo
  e-shopy a stojí za to hledat podle adresy z rejstříku, ne jen podle
  doslovného obchodního jména.
- **Řada malých plzeňských s.r.o. s IČO řady 00–02xxxxxx bez vlastního webu
  nemá žádný nález ani v katalozích** (TechManagement, Picturelise v
  likvidaci, Print-media Koncept, Žaneta Pospíšilová s.r.o., MIKO AGENCY) —
  potvrzuje dřívější vzorec; katalogy typu kurzy.cz rejstrik-firem u nich
  otevřeně přiznávají „Tato firma není uvedena v katalogu Živéfirmy.cz".

### Běh 2026-08-13 (dávka E) — 7 firem z Plzně (skóre 27, shodné `chybi`)

7 firem se stejným seznamem `chybi` (jídelna/obor/směny/účel adresy/web/
stravování/spojení). 3 s doloženým nálezem (JV DESIGN – designový nábytek,
s.r.o., EXTRARENT s.r.o., DIFFERENT FASHION s.r.o.), 4 zcela bez nálezu
(PFRD s.r.o., PANTA REI, a.s., PAMT s.r.o., PAMR s.r.o.).

- **Čtyři firmy založené ve stejný den (25.–27. 2. 2013) se stejným
  generickým předmětem podnikání a bez jakékoli webové stopy vypadají jako
  vzorec „shelf company"** (prázdná s.r.o./a.s. koupená přes zprostředkovatele
  a dál nevyužívaná) — PFRD, PAMT a PAMR sdílejí i stejnou adresu
  (Františkánská 118/3, Plzeň) a stejnou jednatelku (Hana Černá Bošková),
  PANTA REI má jinou adresu i statutáry (rodina Prunnerových), ale stejné
  datum založení a stejně generický předmět. U žádné z nich
  Živéfirmy.cz firmu vůbec neregistruje. Když tenhle vzorec (shodné datum
  založení + generický předmět + žádný katalogový záznam) nastane, další
  hledání nad rámec rejstříku už zjevně nemá smysl.
- **Katalog najisto.centrum.cz (Centrum.cz) nese konkrétní, ne-generický
  popis oboru i u firmy bez vlastního funkčního webu** (EXTRARENT s.r.o. —
  „Čištění fasád, dlažeb, chodníků, střech a ostatních povrchů. Odstranění
  graffiti. Čištění hrobů.") — funguje jako plnohodnotná náhrada webu firmy
  pro `obor`, obdoba dřív ověřených kurzy.cz/info-cechy.cz.
- **Weby na webmium.com nejsou spolehlivě dostupné vždy** — na rozdíl od
  dřívějšího zjištění (H.B. TEXTILIE) se `extrarentsro.webmium.com`
  opakovaně nedal načíst (ECONNRESET) i po více pokusech s/bez `www.` —
  bez přímého načtení nejde doložit citace, takže zůstal bez nálezu.
- **ZlatéStránky.cz profil obchodu může nést pohromadě IČ firmy, web i
  jmenný e-mail v jednom bloku** (DIFFERENT FASHION s.r.o. → „DESIGUAL –
  Different Fashion" profil s „IČ: 01442112", „www.Different.cz" a
  „simona@different.cz") — funguje jako plnohodnotná náhrada přímého
  načtení vlastního webu firmy, když ten blokuje přístup certifikátovou
  chybou (`different.cz`: „unable to verify the first certificate").

### Běh 2026-08-13 (dávka G) — 7 firem z Plzně (skóre 27, shodné `chybi`)

7 firem se stejným seznamem `chybi` (jídelna/obor/směny/účel adresy/web/
stravování/spojení) a prázdným `znameOsoby`. 5 s doloženým nálezem (Face &
Bodyline Etage s.r.o., Kardio Michal Čepelák s.r.o., STauEuro s.r.o.,
uctovs s. r. o., UNI INVEST GROUP s.r.o. v likvidaci — vše jen `obor`
z rejstříku, u Kardio Michal Čepelák navíc kontakt), 2 zcela bez nálezu
(Lizard jeans s.r.o., Deepness s.r.o.).

- **Rejstřík (kurzy.cz) šel použít jako jediný zdroj `obor` u pěti firem
  z sedmi** — u malých plzeňských s.r.o. bez webu zůstává „konkrétní
  formulace předmětu podnikání" spolehlivě dostupná i tam, kde jiné
  atributy (web, spojení, stravování) nejdou doložit vůbec. Potvrzuje
  dřívější pozorování, že rejstřík je nejnižší společný jmenovatel.
- **Jednooborová lékařská s.r.o. (kardiolog) měla dostupný telefon na
  katalogu lékařů, ale ne ordinační hodiny** — na rozdíl od dřívějšího
  úspěchu s regionplzensko.cz (kde otevírací hodiny šly použít jako doklad
  `smenny_provoz`) kataloglekaru.cz u Kardio Michal Čepelák s.r.o. hodiny
  vůbec neuváděl, jen odkaz na externí rezervační portál — `smenny_provoz`
  proto zůstal nedoložený i u firmy, kde jinak šlo dohledat telefon i obor.
- **Dvě dvojice firem se stejnou adresou/jednatelem, ale s různým osudem**:
  Lizard jeans + Deepness (shodná adresa i jednatelka Hana Černá Bošková,
  generický předmět, bez webu → obě bez nálezu, potvrzuje vzorec shelf
  company z dávky E) vs. Face & Bodyline Etage + STauEuro (shodná adresa i
  jednatel Martin Zikmund, ale konkrétní předmět podnikání u obou → obor šel
  doložit u obou). Rozlišovací znak není sdílená adresa/osoba samotná, ale
  to, jestli je zapsaný předmět podnikání generický nebo konkrétní.
- **Weby s neplatným TLS certifikátem kvůli hostname mismatchi
  (`salonrelaxa.eu` → certifikát vystavený na sdílený hosting `mujhost.net`)
  blokují přímé načtení stejně jako klasické „unable to verify the first
  certificate"** — nadějná stopa (možná souvislost Face & Bodyline Etage
  s.r.o. s provozovnou „Studio Etage"/„Salón RELAXA" na Solní ulici) tak
  zůstala bez doložitelné citace; doktor.cz ke stejné stopě navíc vracel
  HTTP 403. Bez přímého načtení nejde ověřit shodu IČO, takže se nález
  nezapsal, i když adresa i název provozovny nápadně seděly.

### Běh 2026-08-13 (dávka H) — 10 firem/OSVČ z Bezdružice (okres Tachov)

10 subjektů se shodným seznamem `chybi` (jídelna/obor/směny/účel adresy/web/
stravování/spojení), vesměs OSVČ a tři s.r.o. sdílející adresu a jednatelku.
9 z 10 s alespoň jedním nálezem a/nebo kontaktem, jen SANITACE SERVIS s.r.o.
zcela bez nálezu.

- **roldeco.cz, habla.cz a sanitaceservis.cz blokují WebFetch úplně, na
  všech zkoušených cestách** (kořen, `/kontakt`, `/o-nas`, i s/bez `www.`,
  i přes `http://`) — na rozdíl od dřívějších firem, kde blokoval jen
  kořen nebo jen `https`. Funkční náhrada: konkrétní podstránka katalogu
  vázaná na dané IČO (`rejstrik-firem.kurzy.cz/<ičo>/<slug>/`,
  `zlatestranky.cz/profil/...`, `zivefirmy.cz/<slug>_f...`) — nesla web,
  telefon i e-mail přímo a šla načíst bez problémů.
- **Tři firmy na stejné adrese (Bezdružice 288) se stejnou jednatelkou
  (Bc. Eva Čížková) mají různý osud** — SANITACE SERVIS s.r.o. (25210505)
  žádný vlastní web/kontakt nemá (jen generický předmět podnikání), zatímco
  ROLDECO spol. s r.o. (48362956) a Habla CZ, s.r.o. (25230671) mají funkční
  web i firemní e-mail. **Past k nezaskočení:** na stejné adrese sídlí i
  „Profesní sdružení - Sanitace nápojových cest" s jiným IČO (22752790,
  web sanitacegastro.cz) — podobný název i obor, ale jde o vlastníka
  SANITACE SERVIS, ne o ni samotnou; jeho kontakt se nesmí přiřadit k
  IČO 25210505.
- **Habla CZ, s.r.o. má na vlastní stránce rejstrik-firem.kurzy.cz
  (vázané na její IČO) uvedený stejný e-mail jako sesterská firma ROLDECO**
  (`info@roldeco.cz`) — protože je to doslovně uvedené na stránce jmenované
  po Habla CZ, ne odvozené ze shody adresy, splňuje to pravidlo o explicitní
  shodě IČO. Nezávislý zdroj (zlatestranky.cz) navíc dal ještě jistější,
  vlastní e-mail `habla@habla.cz` a telefon jiný než u ROLDECO — použit
  přednostně.
- **Jednoosobové lékařské ordinace v malé obci** (MUDr. Kapicová, MUDr.
  Böhm) měly vlastní jednoduchý web i katalogové profily se shodně
  uvedeným oborem a ordinační dobou u obou zdrojů zároveň — ordinační
  hodiny opět posloužily jako doklad `smenny_provoz`, stravování/jídelna
  zůstaly nedoložitelné, jak už bylo pozorováno dřív u jiných ordinací.
- **Podstránka `/zivnosti/` na rejstrik-firem.kurzy.cz** dala konkrétnější
  seznam oborů činnosti tam, kde hlavní stránka nesla jen generický
  předmět podnikání — u Lucie Šaškové (14253577) odhalila „zastavárenská
  činnost a maloobchod s použitým zbožím" navíc k obecné „výroba, obchod a
  služby...". Stojí za to zkusit tuhle podstránku vždy, když hlavní stránka
  dá jen boilerplate.
- **Kontakt vázaný na konkrétní IČO se použil, i když e-mail vzhledem
  neodpovídal jménu podnikatele** (Lucie Šašková → `sasekmira@seznam.cz`) —
  jméno v adrese se nedomýšlí ani neopravuje, bere se jen fakt, že zdroj
  tenhle e-mail výslovně přiřazuje ke shodujícímu se IČO (úroveň 2, ne 3).

### Běh 2026-08-18 — dohledání `oznaceni` (jednoslovné sebeoznačení) u 16 firem

Cílená dávka na jediný atribut `oznaceni` (kontakty se nesbíraly). 6 z 16
firem s doloženým jednoslovným sebeoznačením (Centrum pobytových a
terénních sociálních služeb Zbůch → „centrum", MediSev s.r.o. → „ordinace",
Centrum látek s.r.o. → „prodejna", FARMACUM s.r.o. → „lékárna", PUNČOCHA
s.r.o. → „prodejna", Jan Šiman/Autodoprava Šiman → „autodoprava"), 10 bez
nálezu.

- **Vzor „Zámečnictví Novák nabízí…" ze zadání funguje i obráceně u
  živnostníků, kde branding webu je Obor+Příjmení, ne zapsané jméno
  OSVČ** — Jan Šiman (OSVČ, rejstříkové jméno jen „Jan Šiman") provozuje
  web pod značkou „Autodoprava Šiman", kde `<title>` stránky zní
  „Autodoprava Šiman | Expresní autodoprava a spedice" — platný zdroj pro
  `oznaceni`, i když jde o `<title>`/meta popis, ne o větu v běžném textu
  stránky. Stejně tak u PUNČOCHA s.r.o. posloužil `schema.org` popisek
  (`"description": "Specializovaná prodejna ponožek..."`) vložený přímo do
  zdrojového kódu stránky — je to doslovný text od firmy, i když není
  vidět v běžném vykresleném textu.
- **Generická slova jako „firma" a „společnost" se jako `oznaceni`
  nepoužívají, i když jde technicky o podstatné jméno v prvním pádě,
  kterým se firma sama nazývá** — ZEMAN-CNC obrábění s.r.o. („Jsme moderně
  vybavená rodinná firma…"), Jokex s.r.o. („Jokex s.r.o. je rodinná
  dopravní společnost…") a PS-power s.r.o. („Naše firma byla založena v
  roce 2019.") mají tahle slova doložená, ale nejsou obchod-specifická —
  věta „pár minut od Vaší firmy" nenese žádnou informaci. Zadání dává
  jako příklady výhradně oborová slova (truhlárna, pekárna, autoservis,
  lékárna, penzion, zámečnictví); `oznaceni` se hledá jako obdoba těchto
  slov, ne jako libovolné sebeoznačení.
- **Sloveso popisující činnost není totéž jako sebeoznačení místa/subjektu.**
  U Mobilní autosklo s.r.o. web píše „Poskytuje mobilní servis na opravu
  či výměnu autoskla" — „servis" je tu objekt slovesa (co firma
  poskytuje), ne to, jak firma sama sebe nazývá. Podobně u ZPServis
  (Mgr. Martina Procházková, servis manipulační techniky) věta „Odborný
  servis manipulační techniky je na velmi vysoké úrovni…" popisuje
  kvalitu služby, ne sebeoznačení. Oba případy zůstaly bez nálezu — na
  rozdíl od „Autodoprava Šiman", kde je slovo přímo součástí názvu/brandu.
- **Skupinový/mateřský web popisující víc sesterských firem najednou
  nejde bezpečně přiřadit k jedné konkrétní s.r.o.** — `efisan.cz` mluví
  za celou „skupinu Efisan" (tři IČO) větou „Jsme specialisté v oborech…",
  navíc v množném čísle — nešlo přiřadit konkrétně k EFISAN Infloor s.r.o.
  ani formu upravit na jednotné číslo prvního pádu bez domýšlení. Stejná
  logika jako už zapsaná past u skupinových kariérních portálů (viz výše).
- **JS-frame weby (frameset se skrytým obsahem v `leva.htm`/`prava.htm`,
  případně WAF blokující i běžné User-Agenty)** vrátily jen prázdný
  frameset nebo 403 i po přímém načtení (EMPS s.r.o. — účetní firma) —
  bez alternativního katalogu s delším popisem činnosti zůstala firma bez
  nálezu `oznaceni`.
- **`centrum` jako `oznaceni` je přípustné, i když jde o obecné slovo,
  pokud je to zároveň doslovně první slovo oficiálního zapsaného názvu
  firmy** — u Centrum pobytových a terénních sociálních služeb Zbůch
  (00411949) se homepage sama uvádí větou „Centrum pobytových a
  terénních sociálních služeb Zbůch je státní příspěvkovou organizací…";
  na rozdíl od „firma"/„společnost" tu jde o pojmenování, které funguje i
  samostatně jako typové označení (sociální centrum), ne o univerzální
  právní formu.
- **Doména z rejstříkových katalogů občas patří jinému, nesouvisejícímu
  webu (doména změnila majitele) — než z ní citovat, ověř, že text sedí
  k oboru firmy.** `amoto.cz` (A MOTO s.r.o., prodej motocyklů a dílů) po
  načtení ukazuje web stavební firmy „Specialisté na zemní, výkopové
  práce" — zjevně jiný subjekt na stejné doméně. Bez shody oboru = bez
  nálezu, i kdyby fetch vrátil hezkou větu se sebeoznačením.
- **Zaparkovaná/needitovaná doména (placeholder stránka registrátora,
  např. „Tato doména je umístěna na serveru adSYSTEM") nebo nedostupné
  DNS u domény z katalogu** — u TADOS Dřevovýroba s.r.o. i u dalších dvou
  firem v dávce byla doména z vyhledávání mrtvá; katalogové zápisy (typu
  Živéfirmy.cz) doménu uvádějí, i když už firma web dávno nemá.
- **Provozovna pod jiným jménem, než je zapsaný název firmy, se dá
  bezpečně přiřadit, když nezávislý katalog (firmy.cz) u ní uvádí přesně
  totéž IČO** — Modern design s.r.o. provozuje penzion „Barokní špejchar"
  na vlastní doméně `barokni-spejchar.cz`; přiřazení potvrdil firmy.cz
  záznam se stejným IČO 26317079 dřív, než se citovalo sebeoznačení
  „penzion" z webu provozovny.
- **U lékařů/OSVČ-podobných s.r.o. bývá firemní web na jméně lékaře, ne na
  jméně firmy, a vazbu na IČO potvrzuje až patička stránky.** Gynelone
  s.r.o. (MUDr. Ilona Holubová) má web na `gynekolog.cz/holubova` —
  copyright v patičce „Copyright © 2025 Gynelone s.r.o., MUDr. Ilona
  Holubová IČ: 23922168" spojil web s firmou; samo sebeoznačení
  („Gynekologická ambulance a poradna pro těhotné") bylo na stránce
  Kontakt, ne na Úvodu.
- **Výčet služeb/sortimentu v odrážkovém seznamu není totéž jako věta se
  sebeoznačením** — VITO CZ spol. s r.o. má na stránce „Služby a
  sortiment" mezi položkami i „autoservis" a „pneuservis", ale jde o
  položky dlouhého seznamu zboží a služeb obecné prodejny, ne o větu typu
  „Jsme autoservis…". Bez celé sebeoznačovací věty zůstala firma bez
  nálezu, přestože slovo na stránce doslova je.
